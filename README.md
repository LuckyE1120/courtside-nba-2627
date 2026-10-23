# COURTSIDE · NBA 每日看板

2026–27 NBA 赛季中文赛程、即时比分和赛后总结。比赛按北京时间归档。关注球队保存在浏览器本地。

[打开网站](https://luckye1120.github.io/courtside-nba-2627/)

数据直接从 ESPN 公开比分接口读取，网站在打开且可见时每 60 秒刷新一次；ESPN 数据可能延迟或暂时不可用。每日总结仅根据比分和球员得分等已验证字段生成。本站非 NBA 官方网站。

## 本地运行

```sh
npm ci
npm run dev
```

打开 http://localhost:3000/courtside-nba-2627/ 。

## 发布到 GitHub Pages

GitHub Pages 使用 `gh-pages` 分支根目录。源码在 `main` 分支；更新网站时运行 `npm run build`，再把 `out/` 文件和 `.nojekyll` 提交推送至 `gh-pages`。Pages 会在该分支更新后重新发布。
