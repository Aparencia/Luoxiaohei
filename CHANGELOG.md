# 变更日志

> 只追加，不改写历史条目。本文件是**版本索引**；详情写 `docs/versions/vX.Y.Z.md`，发布锚点是 git tag。
> 5-2 卡门禁：CHANGELOG 版本号 / `docs/versions/vX.Y.Z.md` / git tag 三处必须对齐，缺一不可。
> 每条写"对使用者有什么变化"，不写"改了哪个文件"。

## [未发布]（目标首版 0.1.0）

### 新增

- 项目初始化：Tauri 2 + React 19 + TypeScript 桌面应用骨架（选型见 `docs/decisions/STACK_2026-10-06_桌面摆件技术栈.md`）
- Roadbook V6 流程骨架：`AGENTS.md` 宪法、`STATE.md` 状态源、`docs/` 文档地图、五个守护脚本
- 角色形象基准（通体漆黑 / 圆头圆脑 / 眼白占全脸约 2/3 / 黑瞳 / 长尾）落 `docs/specs/2026-10-06_desktop-pet/SCOPE.md` §8——**改自原「落 docs/DESIGN_TOKENS.md」一句**：色值、比例、间距是 3-5 卡产物，当前仅有骨架，原文属未兑现的声明
- MVP 需求边界与验收标准就绪：`docs/specs/2026-10-06_desktop-pet/SCOPE.md`（Must 8 / Should 5 / Could 5 / Won't 14；**待用户确认**）
- 非功能阈值与检查命令就绪：`docs/specs/2026-10-06_desktop-pet/NFR.md`（性能/容量/可用性/安全/可维护/兼容六维共 28 条阈值行，26 条实阈值 + 2 条 `N/A（理由）`）+ `scripts/nfr.ps1`（一条命令产出一个裁决，退出码 0/1/2 三态）——**待用户逐条确认**
- 首次 Rust 依赖编译产物 `src-tauri/Cargo.lock` 入库（458 个 crate 的锁定版本；属**依赖锁定**变更，不是新增依赖）

### 变更

- 无

### 废弃

- 无

### 修复

- 无
