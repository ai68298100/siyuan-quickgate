## 变更说明

<!-- 描述用户可见行为、影响范围，以及必要的迁移或发布信息。 -->

## 验收清单

- [ ] `corepack pnpm run check`
- [ ] `corepack pnpm test`
- [ ] `corepack pnpm run smoke:mcp`（无内核环境可设置 `SMOKE_SKIP_LIVE=1`）
- [ ] 若涉及发布包，已运行 `corepack pnpm run build` 和 `corepack pnpm run check:release`
- [ ] 未包含 Token、个人路径或真实工作区数据
- [ ] 协议、README、CHANGELOG 或路线文档已按需同步
