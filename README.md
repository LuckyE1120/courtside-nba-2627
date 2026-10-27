# COURTSIDE · 2026–27 NBA 赛程与观赛日记

[打开网站](https://luckye1120.github.io/courtside-nba-2627/)

按北京时间查看赛程、比分、单场统计和每日战报。网页可见时，比分每 60 秒刷新一次；赛程快照保证实时接口暂不可用时仍可查场次。本站非 NBA 官方网站。

观赛日记支持圈选比赛、Emoji 心情、预设文案、文字笔记及每场最多 3 张照片。登录后，记录、周记或月记及照片保存在个人云端；未登录时无法保存观赛记录。照片存放在私有存储桶。服务端 Edge Function 调用 DeepSeek，浏览器不会收到 API Key。Supabase Cron 每天北京时间 10:00 检查上一完整周期，已有日记不会重复生成。

30 支球队图标已保存在 `public/team-logos/`；更新时运行 `npm run cache:logos`。

## 本地运行

```sh
npm ci
cp .env.example .env.local
# 在 .env.local 填写 Supabase 项目 URL 和 publishable key
npm run dev
```

打开 http://localhost:3000/courtside-nba-2627/ 。运行 `npm run typecheck`、`node --test tests/*.test.mjs` 和 `npm run build` 验证静态站点。

## 云端配置

依次运行 `supabase/migrations/20261027000000_journal.sql` 和 `supabase/migrations/20261027010000_schedule.sql`。部署 `supabase/functions/journal-generate/`，将该函数的 **Verify JWT with legacy secret** 设为关闭；函数内部自行校验登录 JWT 或 Vault 中的定时令牌。Edge Function Secrets 中配置 `DEEPSEEK_API_KEY`。Supabase Auth 的 Site URL 与 Redirect URLs 指向 GitHub Pages 站点。发布前核对数据库 RLS 与私有图片桶策略。

Supabase 免费项目可能因不活跃而暂停；定时生成和登录依赖项目处于运行状态。DeepSeek 调用依赖对应账号可用余额。

## 发布到 GitHub Pages

GitHub Pages 使用 `gh-pages` 分支根目录。源码在 `main` 分支。配置公开 Supabase URL 与 publishable key 后运行 `npm run build`，将 `out/` 和 `.nojekyll` 提交推送至 `gh-pages`。不要提交 DeepSeek Key、Supabase secret key 或用户备份。赛程快照更新可运行 `npm run build:schedule`。

详细产品范围、数据流和验收标准见 [观赛日记 PRD](docs/观赛日记-PRD.md)。

赛程快照通过 GitHub Actions 每天北京时间 10:30 自动重新抓取并发布到 GitHub Pages；页面同时会向 ESPN 请求当前比赛日的最新比分。
