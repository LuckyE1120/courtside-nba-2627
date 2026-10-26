import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getDb } from "../db";
import { journalSettings } from "../db/schema";
import { dateInChina } from "../lib/journal";
import { generateDueDiaries } from "../lib/journal-server";

const accessKeys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function authenticatedRequest(request: Request, env: Cloudflare.Env): Promise<Request | Response> {
  if (!env.CF_ACCESS_AUD || !env.CF_ACCESS_TEAM_DOMAIN) {
    return new Response("Cloudflare Access is not configured", { status: 503 });
  }
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) return new Response("Sign in with Cloudflare Access", { status: 401 });
  try {
    const domain = new URL(env.CF_ACCESS_TEAM_DOMAIN);
    if (domain.protocol !== "https:" || !domain.hostname.endsWith(".cloudflareaccess.com")) throw new Error("Invalid Access domain");
    const issuer = domain.origin;
    let keys = accessKeys.get(issuer);
    if (!keys) {
      keys = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer));
      accessKeys.set(issuer, keys);
    }
    const { payload } = await jwtVerify(token, keys, { issuer, audience: env.CF_ACCESS_AUD });
    if (typeof payload.email !== "string" || !payload.email) throw new Error("Missing email claim");
    const headers = new Headers(request.headers);
    for (const key of [...headers.keys()]) if (key.toLowerCase().startsWith("oai-authenticated-")) headers.delete(key);
    headers.set("oai-authenticated-user-id", `cloudflare:${payload.sub || payload.email}`);
    headers.set("oai-authenticated-user-email", payload.email);
    return new Request(request, { headers });
  } catch {
    return new Response("Cloudflare Access token is invalid", { status: 401 });
  }
}

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    if (!import.meta.env.DEV) {
      const verified = await authenticatedRequest(request, env);
      if (verified instanceof Response) return verified;
      request = verified;
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
  async scheduled(_controller: ScheduledController, _env: Cloudflare.Env, ctx: ExecutionContext) {
    const users = await getDb().select({ userId: journalSettings.userId }).from(journalSettings);
    const today = dateInChina(new Date().toISOString());
    for (const { userId } of users) {
      ctx.waitUntil(generateDueDiaries(userId, today).catch(error => {
        console.error(`Diary generation failed for ${userId}:`, error);
      }));
    }
  },
};

export default worker;
