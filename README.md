# AI 日记生成器 - 静态 Pages 版

这是原项目改造后的纯前端静态版本，适合直接部署到 GitHub Pages。

## 特点

- 不依赖后端 API
- 不依赖 Vercel Blob
- 可直接静态导出
- 适合 GitHub Pages / 任意静态托管

## 本地运行

```bash
pnpm install
pnpm build
```

构建产物会输出到 `out/` 目录。

## GitHub Pages 部署建议

1. 将仓库推送到 GitHub
2. 在仓库设置里开启 **Pages**
3. Source 选择 **Deploy from a branch**
4. Branch 选择 `gh-pages`
5. 推送到分支 `v0/menghui759-5417-807a2827-2` 后，Actions 会自动构建并把静态站点发布到 `gh-pages`

如果你需要手动上传，也可以把 `out/` 目录部署到任意静态站点托管服务。

## 说明

当前页面是演示性质，保留了原项目的视觉布局和结果展示结构，但不再调用模型与上传接口。
