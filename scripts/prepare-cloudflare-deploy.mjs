import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [databaseId, audience, teamDomain] = process.argv.slice(2);
if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(databaseId ?? '')) {
  throw new Error('Pass the D1 database UUID as the first argument.');
}
if (!audience || !/^[a-z0-9]{20,}$/i.test(audience)) {
  throw new Error('Pass the Cloudflare Access application AUD as the second argument.');
}
let domain;
try { domain = new URL(teamDomain); } catch { throw new Error('Pass the Cloudflare Access team URL as the third argument.'); }
if (domain.protocol !== 'https:' || !domain.hostname.endsWith('.cloudflareaccess.com')) {
  throw new Error('The team URL must be https://<team>.cloudflareaccess.com.');
}
const path = resolve('dist/server/wrangler.json');
const config = JSON.parse(readFileSync(path, 'utf8'));
config.name = 'courtside-nba-journal';
config.topLevelName = config.name;
config.d1_databases = [{ binding: 'DB', database_name: 'courtside-nba-journal', database_id: databaseId }];
config.vars = { ...config.vars, OPENAI_MODEL: 'gpt-5-mini', CF_ACCESS_AUD: audience, CF_ACCESS_TEAM_DOMAIN: domain.origin };
config.triggers = { crons: ['0 1 * * *'] };
writeFileSync(path, JSON.stringify(config, null, 2));
console.log('Prepared dist/server/wrangler.json for Cloudflare Workers.');
