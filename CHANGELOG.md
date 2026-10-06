# 变更日志

> 只追加，不改写历史条目。本文件是**版本索引**；详情写 `docs/versions/vX.Y.Z.md`，发布锚点是 git tag。
> 5-2 卡门禁：CHANGELOG 版本号 / `docs/versions/vX.Y.Z.md` / git tag 三处必须对齐，缺一不可。
> 每条写"对使用者有什么变化"，不写"改了哪个文件"。

## [未发布]（目标首版 0.1.0）

### 新增

- 项目初始化：Tauri 2 + React 19 + TypeScript 桌面应用骨架（选型见 `docs/decisions/STACK_2026-10-06_桌面摆件技术栈.md`）
- Roadbook V6 流程骨架：`AGENTS.md` 宪法、`STATE.md` 状态源、`docs/` 文档地图、五个守护脚本
- 角色形象基准（通体漆黑 / 圆头圆脑 / 眼白占全脸约 2/3 / 黑瞳 / 长尾）落 `docs/specs/2026-10-06_desktop-pet/SCOPE.md` §8——**改自原「落 docs/DESIGN_TOKENS.md」一句**：色值、比例、间距是 3-5 卡产物，当前仅有骨架，原文属未兑现的声明
- MVP 需求边界与验收标准就绪：`docs/specs/2026-10-06_desktop-pet/SCOPE.md`（Must 8 / Should 5 / Could 5 / Won't 14；**2026-10-06 用户确认，档位落 L**）
- 非功能阈值与检查命令就绪：`docs/specs/2026-10-06_desktop-pet/NFR.md`（性能/容量/可用性/安全/可维护/兼容六维共 28 条阈值行，26 条实阈值 + 2 条 `N/A（理由）`）+ `scripts/nfr.ps1`（一条命令产出一个裁决，退出码 0/1/2 三态）——**2026-10-06 用户逐条确认**
- 首次 Rust 依赖编译产物 `src-tauri/Cargo.lock` 入库（458 个 crate 的锁定版本；属**依赖锁定**变更，不是新增依赖）
- 实现方案设计定稿：`docs/specs/2026-10-06_desktop-pet/DESIGN.md`（九节齐备；钉死 14 个待建文件 + 6 个待改文件、7 条 IPC 命令契约、6 个窗口配置键、6 个模块签名；改动面 140% 判**重写**；六轴自评 26/30）——**待用户批准**
- 接口清单首次落地：`docs/registry/APIS.md` 登记 7 条 Tauri IPC 命令（命令字符串与 payload 逐条从已装包源码核出）+ 3 个自定义错误码 `E-IPC-01/02/03`
- 组件注册表新增「首个功能组件」节 20 行（14 个待建 + 6 个待改），供 4-1 逐批销行
- 系统边界与取舍就绪：`docs/ARCHITECTURE.md` §6~§8 补齐（3-7 卡）——边界三问（这是什么 / 不做什么 5 条 / 外面有什么 4 条）、上下文 · 模块 · 运行时 · 数据四张视图、5 条带阈值的质量属性场景（阈值逐字取自 `NFR.md`）、3 条权衡记录（含代价与翻案条件）、3 条演化口子；并就地写明"实线 = 运行时承载、虚线 = 依赖"的方向判据（禁双向、禁环、禁跨层）

### 变更

- `docs/specs/2026-10-06_desktop-pet/SCOPE.md` 行数账勘误：补登 `src/character/geometry.ts` 与 `geometry.test.ts` 两行 → 预估改动行数 `1150 → 1242`，范围蔓延触发线 `1725 → 1863`（依据：`DESIGN.md` §12 G1）
- `docs/registry/APIS.md` 换掉脚手架示例行（`POST /api/v1/bills`）——本项目无服务端，留着假接口会让 4-2 的"错误码必须登记"grep 核到不存在的码

### 废弃

- 无

### 修复

- 无
