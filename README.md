# COURTSIDE · NBA 每日看板

2026–27 NBA 赛季中文赛程、即时比分和赛后总结。比赛按北京时间归档。关注球队保存在浏览器本地。

[打开网站](https://luckye1120.github.io/courtside-nba-2627/)

每日场次优先从仓库内的赛季快照显示，可按球队、对手和北京时间日期查找具体比赛。ESPN 公开比分接口在页面打开且可见时每 60 秒更新一次比分。打开已开始的单场详情时，页面另行获取球队命中率、篮板、助攻、失误和球员技术统计；未开赛或接口暂不可用时会明确提示。实时接口不可用时仍可查询快照中的场次，页面会提示比分可能延迟。每日总结仅根据比分和球员得分等已验证字段生成。本站非 NBA 官方网站。

30 支球队的图标已保存在 `public/team-logos/`，页面直接读取站点静态文件。浏览器可复用同一图片缓存，切换日期无需再次请求 ESPN 图片服务。如需更新图标，运行 `npm run cache:logos`（删除旧文件后可强制重新获取）。

## 本地运行

```sh
npm ci
npm run dev
```

打开 http://localhost:3000/courtside-nba-2627/ 。

## 发布到 GitHub Pages

GitHub Pages 使用 `gh-pages` 分支根目录。源码在 `main` 分支；赛程更新时运行 `npm run build:schedule`，然后运行 `npm run build`，再把 `out/` 文件和 `.nojekyll` 提交推送至 `gh-pages`。Pages 会在该分支更新后重新发布。
