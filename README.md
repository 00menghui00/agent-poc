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
2. 在 GitHub Actions 中执行 `pnpm build`
3. 将 `out/` 目录部署到 GitHub Pages

或者使用你自己的静态站点托管服务直接上传 `out/`。

## 说明

当前页面是演示性质，保留了原项目的视觉布局和结果展示结构，但不再调用模型与上传接口。
