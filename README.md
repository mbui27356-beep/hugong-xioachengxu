# 陪护预约 · 本地联调原型

需求见 [docs/开发文档_V1.md](docs/开发文档_V1.md)，视觉规范见 [docs/design-system.md](docs/design-system.md)，测试结果、模拟边界与云开发替换清单见 [docs/交付说明.md](docs/交付说明.md)。

## 结构

```text
miniprogram/      微信原生小程序（TS + Less），通过 HTTP 调用本地后端
admin-web/        管理后台（Vue 3 + TS + Vite），通过 Vite 代理调用本地后端
backend/          本地 Node.js + TS 后端：两端唯一数据源
  src/core/         调用上下文（身份、权限、原子提交）、仓储接口
  src/modules/      admin（后台接口）、customer（小程序接口）、shared（订单/支付/退款共用写操作）、demo（演示专用）
  src/adapters/mock/  模拟身份、模拟支付渠道（仅演示）
  src/repositories/   JSON 文件仓储与演示种子数据
  src/entrypoints/local/  本地 HTTP 入口
  tests/e2e.ts      两端联动验收脚本
packages/
  contracts/        后台与后端共用的类型、状态枚举；customer.ts 为小程序 DTO
  domain/           计价、状态动作、权限、退款额度、排班冲突等规则
```

## 启动

先启动后端（端口 3100，数据保存在 `backend/data/db.json`，重启不丢失）：

```bash
npm --prefix backend install && npm --prefix backend run dev
```

管理后台（http://localhost:5173）：

```bash
npm --prefix admin-web install && npm --prefix admin-web run dev
```

小程序：微信开发者工具导入本目录，已关闭“校验合法域名”，直接编译即可。真机预览需把 [miniprogram/config.ts](miniprogram/config.ts) 的 `API_BASE` 改为电脑局域网地址。

## 常用命令

```bash
npm --prefix backend run test:e2e
```

```bash
npm --prefix backend run sync:contracts
```

修改 `packages/contracts/customer.ts` 后必须执行第二条，把小程序 DTO 同步到 `miniprogram/core/types.ts`。

要重置演示数据：在后台「系统设置 → 演示工具」中重置，或停止后端后删除 `backend/data/db.json`。
