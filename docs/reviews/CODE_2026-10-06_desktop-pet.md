# CODE_2026-10-06_desktop-pet · 代码审查（卡 4-2）

> 本条由 AI 生成（代码审查）｜ 生成者：卡 4-2 的两个**新鲜上下文**轴审查者（标准轴 / 规格轴，互不可见），由未参与审查判定的 Lead 机械聚合与复核 ｜ 依据：卡 `playbook/4-2-代码审查.md` §② + `SCOPE.md` §4/§5/§6/§7 + `NFR.md` + `docs/UI.md` + `docs/MOTION.md` + `docs/DESIGN_TOKENS.md` + `docs/registry/*` + 实跑命令 ｜ 只看本次 diff 及其直接关联调用

## 0. 审查元信息（派单输入单 + 席位声明）

| 项 | 值 |
| :-- | :-- |
| DESCRIPTION | 罗小黑桌面摆件 MVP：M1 窗口 8 键、M2 四条具名授权、M3 造型、M4 三组 idle 动画、M5 瞳孔 60Hz 跟随、M6 透明区命中与穿透、M7 左键拖拽 + 右键原生菜单「退出」、M8 工程使能 |
| PLAN_OR_REQUIREMENTS | `docs/specs/2026-10-06_desktop-pet/SCOPE.md`（§5 验收标准原文已随派单逐字下达） |
| BASE_SHA（`$anchor`，从 `STATE.md` 的 `起点锚点` 读出） | `3eac5b5baa6ac4330d9b080866472fae17c1360a`（`git rev-parse --verify "$anchor^{commit}"` 通过 = 锚点断言成立） |
| HEAD_SHA | `c449ec7d2c71ae17cb511df6be92eae7c6da21c8` |
| diff 规模 | `git diff --shortstat 3eac5b5..HEAD` → **50 files changed, 9041 insertions(+), 594 deletions(-)**（变更总行数 = 9635；`git diff` 文本 10202 行，含 hunk 头与上下文） |
| 席位声明 | 编码会话不参与审查判定：两个轴各由一个**全新上下文**子代理执行（卡 §① 「或派一个新鲜上下文的子代理」+ §② 「每个轴一个子代理」）；Lead 只做派单、机械复核与聚合，**未新增任何轴内发现**；审查者未再派子代理（卡内禁令） |
| 引用报告清单 | **无**（`docs/reviews/` 在本次审查前只有 `.gitkeep`）⇒ 无未核销旧 P0/P1、无从沿用旧编号 |
| 人审替代车道 | **不开放**：变更总行数 9635 ≫ 150（卡 §① 的机械判据） |

---

## 1. 覆盖地图（文件 × 维度勾选）

图例：`✓` 已审 ｜ `—` N/A（原因见注）｜ `○` 未审（附原因）。**三阶段均有 diff 覆盖，无阶段跳过。**

### 表 A · 标准轴（判据 = 本仓库已写下的标准 + 气味基线表）

维度位序：①接入装配 ②逻辑 ③牵连 ④性能 ⑤冗余死码 ⑥开发规范 ⑦安全 ⑧UI 可访问性 ⑨外部调用 ⑩性能预算 ⑪数据隐私

| 文件 | ① | ② | ③ | ④ | ⑤ | ⑥ | ⑦ | ⑧ | ⑨ | ⑩ | ⑪ |
| :-- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 阶段 1 `tauri.conf.json` / `capabilities/default.json` / `src/lib.rs` / `Cargo.toml` | ✓ | —¹ | ✓ | —² | ✓ | ✓ | ✓ | —⁴ | —⁵ | ✓ | —⁶ |
| 阶段 1 `src/main.rs` / `build.rs`（未改） | ✓ | —¹ | —³ | —² | —³ | ✓ | ✓ | —⁴ | —⁵ | —² | —⁶ |
| 阶段 1 `src-tauri/Cargo.lock`（生成物 4382 行） | —⁷ | —⁷ | —⁷ | —⁷ | —⁷ | —⁷ | —⁷ | —⁷ | —⁷ | —⁷ | —⁷ |
| 阶段 2 `App.tsx` / `App.css` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | —⁶ |
| 阶段 2 `character/geometry.ts` / `HeiCat.tsx` / `heicat.css` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | —⁵ | ✓ | —⁶ |
| 阶段 2 `interaction/{gaze,hitTest,useCursorFollow,usePointerPassthrough,useDragExit}.ts` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | —⁶ |
| 阶段 3 `src/**/*.test.ts`（6 个） | ✓ | ✓ | ✓ | ✓ | —⁸ | ✓ | ✓ | —⁴ | —⁵ | ✓ | —⁶ |
| 阶段 3 `check.ps1` / `gate.ps1` / `orphans.ps1` / `scripts/nfr.ps1` / `package.json` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | —⁴ | ✓ | ✓ | —⁶ |
| 阶段 3 `tsconfig*.json` / `vite.config.ts`（越界出口定点查，见 S-05） | ✓ | —¹ | ✓ | —² | ✓ | ✓ | ✓ | —⁴ | —⁵ | —² | —⁶ |
| 阶段 3 `docs/**` + `STATE.md` + `CHANGELOG.md`（同步性，判标准用） | ✓ | —¹ | ✓ | —² | ✓ | ✓ | ✓ | —⁴ | —⁵ | —² | —⁶ |
| `docs/decisions/IDEA_*.md`（83 行）、`RUNBOOK` / `OBSERVABILITY` / `PRIVACY` / `USER_GUIDE` 骨架 | ○ **未审**：不在本批 diff（`git diff --name-only` 实测未改） |

注：¹无可执行分支（纯数据/配置）②静态文件或一次性初始化，无热路径 ③未修改，仅确认无删改 ④窗口本体即全部界面，无 DOM 控件/媒体查询分支 ⑤不新增外部调用 ⑥无个人数据、无落盘、无外发 ⑦生成物只看 `--stat` ⑧测试文件自身不是被测物（已审其断言与实测的一致性）。

### 表 B · 规格轴（判据 = SCOPE 需求侧）

| 审查对象 | M1~M8 | §6 U1~U5 | §4 Won't | §7 链路+元素表 | ⑧可访问性 | NFR 静态面 | I18N §2 |
| :-- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| 阶段 1 `tauri.conf.json` / `capabilities/default.json` / `Cargo.toml` / `lib.rs` | ✓ | ✓(U1/U2) | ✓ | ✓ | — 无前端 | ✓ A4/S2 | — 无文案 |
| 阶段 2 `App.tsx` / `App.css` / `main.tsx` / `index.html` | ✓ | ✓ | ✓ | ✓ 三层链路 | ✓ | ✓ | ○→R-10 已述 |
| 阶段 2 `character/{geometry.ts,HeiCat.tsx,heicat.css}` | ✓ | ✓ | ✓ | ✓ 逐行 | ✓ 对比度 | ✓ C2/M5 | — 无用户文案 |
| 阶段 2 `interaction/{gaze,hitTest,useCursorFollow,usePointerPassthrough,useDragExit}.ts` | ✓ | ✓(U3/U4/U5) | ✓ | ✓ 归属核对 | ✓ 错误态 | ✓ P3 | — |
| 阶段 3 `*.test.ts` ×6 / `check.ps1` / `package.json` | ✓ 命令全跑 | ✓(U4) | ✓ W13 | — | — | ✓ M1/M2/M3 | — |
| 阶段 3 文档面 `SCOPE/NFR/UI/I18N/DESIGN/STATE/TECH_DEBT` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 卡七维中的 4 性能 / 5 冗余死码 / 7 安全 明细 | ○ 未审（归标准轴，避免跨轴重复编号；本轴只取其与规格相关面） | | | | | | |

**越界唯一出口「命名风险定点检查」共用 2 次 2 处**：① 风险名＝「窗口 label 隐式默认」→ 查 `tauri.conf.json` 未写 `label`、capabilities 只授权 `"main"`、`tauriConfig.test.ts:105` 断言 `caps.windows=["main"]` ⇒ 三处一致，判定**无断链** ② 风险名＝「窗口初始位置键的默认值」→ 查 `node_modules/@tauri-apps/cli/config.schema.json:275`，`center` 默认 `false` ⇒ 结论写进 R-05。

---

## 2. 问题清单

> **两轴分列，禁止跨轴合并**（卡 §②）。同一事实被两轴各自提出时**各记各的编号**，不做归并。
> 四级判据（卡原文）：P0 = 崩溃/数据丢失/安全漏洞 ｜ P1 = 核心功能不可用（含装配断链）｜ P2 = 边缘功能报错/体验不佳 ｜ P3 = 拼写/样式/非关键提示。

### 2.1 标准轴（编号 S-01…S-14）

**S-01 ｜ P1 ｜ `scripts/nfr.ps1:268`（定义）+ `:292-297`（主流程）+ `docs/specs/2026-10-06_desktop-pet/NFR.md:48,91`**
新增函数 `Check-LaunchCycle`（NFR **A2**「连续启停 100 次零失败」的唯一实现）**没有任何调用点**；参数 `-Launches`（`:22`）只在它体内被读，主流程六条 `if` 里没有一条调它（连 `-Check all` 也不会走到）。本仓工具独立报同一项：`orphans.ps1` → `[零引用导出] scripts/nfr.ps1 : Check-LaunchCycle`。
**影响（触发条件）**：任何人照 NFR.md:48/91 的执行命令 `scripts/nfr.ps1 -Check availability -Launches 100`——在 `luoxiaohei.exe` 存在的机器上——跑的是 `Check-Availability`（1 分钟长跑浸泡），随后打印「本维全部阈值通过」并 **exit 0**；A2 阈值从未被测量却拿到绿色（假绿）。
**修复建议**：主流程补 `if ($Check -eq 'availability' -and $PSBoundParameters.ContainsKey('Launches')) { Check-LaunchCycle }`（或拆 `-Check launch`），并在 NFR A2 行注明命令原文；修完复跑确认「启动/退出循环的失败次数」那行真的出现。

**S-02 ｜ P2 ｜ `src/interaction/useDragExit.ts:76-88`**
`showQuitMenu: async () => { menu ??= await Menu.new({…}); await menu.popup(); }`——`??=` 在 `await` **之后**才写回闭包变量：两次右键在同一 `Menu.new` 往返内到达时都读到 `menu === null`，各建一个 Rust 侧菜单，其中一个句柄永久丢失。这正是该文件 `:67-69` 注释声称要防的事情。
**影响（触发条件）**：间隔小于一次 `menu|new` 往返的连续两次右键 → 多一个 Rust 侧菜单对象，且 M7·②「菜单复用不重建」在真机上不成立；`dragExit.test.ts:109-126` 只覆盖顺序右键（先 `waitFor(POPUP===1)` 再发第二次），测试全绿也发现不了。
**修复建议**：缓存 Promise 而非结果（`let menuPromise: Promise<Menu> | null = null; menuPromise ??= Menu.new({…}); const menu = await menuPromise;`），并补「同一 tick 连发两次 contextmenu → `plugin:menu|new` 恰好 1 次」的断言。

**S-03 ｜ P2 ｜ `docs/registry/APIS.md:29`（E-IPC-02 行）**
本批实测 E-IPC-02 的现实形态是 `TypeError` rejection，勘误已同批写进 `DESIGN.md:143` 与 `TESTPLAN.md:186`，但 `APIS.md` 同一行没跟：现象列仍写「Promise **resolved 为** `null`，不抛错」，门禁拦截点列仍指「`gaze.test.ts` 与 `hitTest.test.ts` 的 `null` 入参用例」，真正拦住它的是 `src/interaction/dragExit.test.ts:193` 的 KP-13。
**影响（触发条件）**：D13 把 `APIS.md` 定为错误码事实源；下一个照它写代码的人只会挡 `=== null`，会原样重复批次 4 第一版被 KP-13 判红的那次错误（`STATE.md` 风险摘要 54）；4-3 照它找拦截点会去错文件。
**修复建议**：现象列改为「rejection：`cursorPosition()` 内部 `new PhysicalPosition(null)` 抛 `TypeError`（v2.12.1 实测）」，拦截点改为 KP-13，并指向 `DESIGN.md` §3.3。

**S-04 ｜ P2 ｜ `docs/UI.md:111`、`:117-119` ↔ `src/App.css:4,6,7,10` / `src/App.tsx:3,6` / `src/character/HeiCat.tsx:4,9,18,21,31` / `src/character/heicat.css:3,11,27,45,95,177`**
`UI.md` §12 写死的每批复跑门禁（附 `Expected：命中 0`）实测 **命中 4**：`—`（U+2014 长破折号）出现在上述 4 个文件的 **17 行 / 34 个字符**里，而 §11 明文「长破折号 0 处」。
**影响（触发条件）**：4-3 照 §12 复跑会读到与「门禁绿」矛盾的输出；处置只有改 17 行注释标点或放宽判据两条路。`STATE.md` 风险摘要 ⑭ 的教训（自查命令必须进每批复跑清单）第二次发生。
**修复建议**：① 把 4 个文件里的 `——` 换成 `：`/`，`（纯注释、零行为影响）或 ② 把 §11 的口径限定为"用户可见文案"并同批改 §12 的扫描实现。

**S-05 ｜ P2 ｜ `vite.config.ts:3`**
本批新增 devDependency `@types/node` 后，该行 `// @ts-expect-error type error without @types/node package` 的前提失效。实测 `npx tsc -p tsconfig.node.json --noEmit` → `vite.config.ts(3,1): error TS2578: Unused '@ts-expect-error' directive.`（**Lead 复核实测退出码 1**）。
**影响（触发条件）**：今天被掩盖（`npm run typecheck` 走根 `tsconfig.json` 的 `include: ["src"]`），但根 `tsconfig.json` 的 `references` + `tsconfig.node.json` 的 `composite: true` 表明这套配置按 `tsc -b` 设计——任何人跑 `tsc -b` 或给 `include` 加上配置文件立刻红；那行注释亦成为关于仓库状态的错误陈述。
**修复建议**：删掉已无用的 `@ts-expect-error`（属本批依赖变更的直接连带），或登记 `TECH_DEBT` 并把触发条件写成「下次跑 `tsc -b` 或改 `include` 前」。

**S-06 ｜ P2 ｜ `src/interaction/useCursorFollow.ts:66-73`（`reportIpcFailure`）+ `:201`（每 tick 的 catch）↔ `docs/UI.md:19`（S3 行）**
`UI.md` §2 S3 写死「同一处连续失败只打第一次（防 60 次/秒刷屏）、恢复后再失败才再打」；`reportIpcFailure` 是无条件 `console.error`，而 60Hz tick 失败时逐拍调用它。
**影响（触发条件）**：任何**持续**的 IPC 失败（capability 被删/ACL 拒绝、桥不可用）→ console 每秒 60 行同一条 `[ipc] E-IPC-01 plugin:window|cursor_position …`，真实后续报错被冲掉（`usePointerPassthrough` 侧因"失败也记 `applied`"不重试，不受影响——那处设计是对的）。
**修复建议**：在 `reportIpcFailure` 内按 `command` 去重（记 `lastCommand`，成功一拍后允许重打）；补一条「连续 N 拍同因失败只 1 条」的断言 + 变异体。

**S-07 ｜ P2 ｜ `docs/specs/2026-10-06_desktop-pet/SCOPE.md:29`（触发线原文）**
SCOPE §0 写死「4-1 累计变更行数 > 1242 × 1.5 = **1863** → 停下问用户」（勘误行 `:26-27`）。**实测（Lead 复核，口径 = 卡 4-2 §① 定义的 insertions + deletions）**：4-1 的真实区间 = 首笔 4-1 提交 `d90d83c` 的父提交 `3ce6494..HEAD` → `35 files changed, 2370 insertions(+), 748 deletions(-)` ⇒ **变更总行数 3118**，超线 **67%**。**无停下、无留痕**（未决问题无对应条目）。
**影响（触发条件）**：SCOPE 的超范围保护机制已实际失效而未触发流程动作；下一次估行数不再可信。不影响代码正确性。
**修复建议**：补一条自行裁决留痕或请用户裁决；并把 SCOPE §0 的账重算（超线主因是 6 个测试文件 + 270 行几何 + 197 行 CSS 未在原始 1242 账里体现）。

**P3（7 条；登记 `docs/TECH_DEBT.md`，来源写本报告编号）**

- **S-08 ｜ P3 ｜ `src/character/HeiCat.tsx:38-137`（100 行）、`src/interaction/useCursorFollow.ts:143-208`（66 行）**：两处函数超 D14① 的 50 行上限，而 `NFR.md:71` 把「函数 ≤50 行」的判定明确指派给 4-2 人工复核。判断：`HeiCat` 90% 是声明式 JSX、`useCursorFollow` 是 1 hook + 2 个内聚 effect（扣注释约 53 行）。**修复**：抽 `useWindowGeometry()`/按眼/躯干/尾抽子组件，或在 `NFR.md:71` 就地写明豁免理由（不抽则每批都会重新争论）。
- **S-09 ｜ P3 ｜ `src/character/geometry.ts:21,22,23,30,85`、`src/interaction/useDragExit.ts:17,19,24`、`src/interaction/usePointerPassthrough.ts:22,29`**：10 个导出无跨文件消费者（`EarShape`/`EyeLidShape`/`TorsoShape`/`TailShape`/`PUPIL_TRAVEL_RATIO`/`PointerEventLike`/`DragExitHandlers`/`DragExitPorts`/`PassthroughPorts`/`PassthroughController`）。按 D12，「删掉这句行为会不会变？不会 → 删掉它」。**修复**：去掉这 10 个 `export`（保留类型本身），或在 `COMPONENTS.md` 写明保留理由与到期卡。
- **S-10 ｜ P3 ｜ `STATE.md:58` + `CHANGELOG.md:75` ↔ `src/tauriConfig.test.ts:94-95`**：两处写"`git grep` 两个词命中均为 0"，实测 `opener` 命中 **2**（`:94` 的正向守卫断言与 `:95` 的消息串）；`greet` 0 ✓。**同类坑（㊶）第二次出现**：判据里的词被写进被判的文本。**修复**：判据改为 `git grep -n opener -- src src-tauri package.json ':!src/tauriConfig.test.ts'`，并在那两行补注"2 处均在退役断言内，属正向守卫"。
- **S-11 ｜ P3 ｜ `docs/specs/2026-10-06_desktop-pet/TESTPLAN.md:31`（记 8）、`:102`（"预计 8"）、`:150`（`Expected：# pass 41`）**：§1 明写"4-1 批次 1 首跑后把'预计'改成实测值"但预计值仍在；**Lead 复核实测**：`tauriConfig.test.ts` 为 **6** 条、全量 `npm run test` 为 **39 pass**。**影响**：4-3 照 §6 比对会读到 39 ≠ 41。**修复**：三处改成 6 / 6 / 39。注：§7 的 MUT 表**已按实测更新**（MUT-2 口径、MUT-7 的 M6·① 恒存活、MUT-8 连带 KP-14），属通过项。
- **S-12 ｜ P3 ｜ `src/character/geometry.ts:43`（`DESIGN_TO_CSS = 260 / 320`）↔ `src-tauri/tauri.conf.json:16`（`width: 260`）**：窗口宽这一事实写在两处，代码那处硬编码且未导出，无断言与配置绑定；`geometry.test.ts:189-193` 只判上界（窗口被改宽 → 粗筛盒偏小、判定漏盖，用例照样绿）。**修复**：导出 `DESIGN_TO_CSS`，在 M3·⑥ 补 `assert.equal(DESIGN_TO_CSS, WINDOW.width / 320)`。
- **S-13 ｜ P3 ｜ `src-tauri/capabilities/default.json:11` ↔ `DESIGN.md:103,135`**：轴给出的依据 = `src-tauri/gen/schemas/acl-manifests.json` 的 `core:default` 默认集已含 `core:menu:default` ⇒ 该条是重复占用，DESIGN §3.2「菜单需多花一个额度」的口径不准。SCOPE M2 逐字要求保留它（KP-02 也断言它），**不该删**。**修复**：在 §3.2 就地补一句「已含于 `core:default`，显式列出是为依赖可读并满足 M2 的逐字要求，不是新增额度」。**Lead 复核附注**：我在该 JSON 里只找到 `core:menu:default` **1 次**、未找到 `core:default` 键，**未能独立复现这条包含关系**；结论与处置不受影响（那条授权无论如何都该保留），依据待该轴补充或按 Tauri 官方 manifest 复核。
- **S-14 ｜ P3 ｜ `docs/UI.md:70` ↔ `src/App.css`（全文 26 行）**：`UI.md` §6 写「防溢出三件套（写进 4-1 的 `App.css`）：`minmax(0,1fr)`、`overflow-wrap: anywhere`、`overflow-x: clip`」，App.css 三条都没有（用 `overflow: hidden` + 100%）。该节前提（多列/文本流/横向溢出）在本项目为零，补那三条 = 造 D12 意义上的 no-op CSS。**修复**：改文档不改代码（限定为"存在文本流或多列时"，注明本项目由 `overflow:hidden` 兜底；`height: 100vh` 禁令已遵守，实测命中 0）。

### 2.2 规格轴（编号 R-01…R-11）

**R-01 ｜ P2 ｜ `src/character/geometry.ts:241`（配合 `src/interaction/hitTest.ts:33-42`、`src/interaction/usePointerPassthrough.ts:50`）**
M6 的 OS 侧穿透判定用 8 个**粗筛盒**，其中「头含耳」盒 = `box(HEAD.cx - HEAD.rx, EAR_TIP_Y, HEAD.cx + HEAD.rx, HEAD.cy + HEAD.ry)`，即**整个矩形**（viewport CSS px：`x 48..212 / y 19..189`）。盒内存在大量**未绘制像素**（头顶上方那条带、两耳之间的空隙、头椭圆四角），它们既没有形状可命中、也不会穿透到桌面。
**影响（触发条件）**：探针（直调生产纯函数）实测 `(130,24.4)→true`（两耳之间、头顶正上方，什么都没画）、`(130,21)→true`、`(50,40)→true`、`(210,40)→true`、`(51,180)→true`；对照 `(5,5)→false`。按椭圆与耳三角形粗算，头盒内死区约 **7000 CSS px² ≈ 窗口面积的 9%**。SCOPE §5 M6 的用户故事（"点击窗口里猫身之外的透明区域 → 点到的是背后的桌面图标"）在这些像素上不成立；M6 的验收命令只点了 `(5,5)/(250,10)/(43,26)/(20,290)` 四个点，全在盒外，**拦不住这条**。
**修复建议**：头盒拆成「头椭圆 + 两个耳三角形」（各约 5 行内判），或至少切掉头顶那条带；若裁决接受该误差，必须在 SCOPE §7 把"猫身"显式定义为粗筛盒并写明误差量级——不许沉默。

**R-02 ｜ P2 ｜ `src/character/geometry.ts:83,85,96`**
SCOPE §7 原文「距中心最大偏移 = **眼白短半径**的 45%」。眼白 `rx=45 / ry=52`（`:66-67`），**短半径 = 45**；实现取 `EYE_RY`(=52)，且 `:83` 的注释还断言"眼白短半径 = `ry` = 52"——**读反了**：满偏 = 23.4，按原文应为 20.25（多 15.6%）。
**影响**：① 幅度口径与需求不符 ② 该常量与函数**零测试引用**（`PUPIL_TRAVEL_RATIO`/`pupilOffsetFor` 全仓只在 `geometry.ts` 定义与 `HeiCat.tsx:23,48` 消费，**没有任何 .test.ts 引用**）⇒ SCOPE §7 的唯一幅度判据无人守 ③ 顺带量到：瞳孔 `ry=41` + 位移 23.4 = 64.4 > 眼白 `ry=52`，满偏时瞳孔会画出眼白轮廓之外。
**修复建议**：`EYE_RY` → `EYE_RX`（1 行）+ 补断言 `pupilOffsetFor(0,1)` 的模长 = `0.45 × 45`；并把"满偏是否允许越出眼白"写成 4-3 的目视判据。

**R-03 ｜ P2 ｜ `src/interaction/gaze.test.ts:14,59,79`（被测物 `src/interaction/gaze.ts:19,22`）**
M5 验收原文要求「距窗口中心 **> 1500px** 时归 0」，但用例是**用实现自己的常量构造边界**（`const diag = FAR_RESET_PX / Math.SQRT2`），全仓**没有任何断言 pin `FAR_RESET_PX === 1500`**（Lead 复核：`git grep -n "1500\|FAR_RESET_PX" -- src` 的命中里，`1500` 只出现在 `gaze.ts:22` 的定义、`:48` 的注释与测试的文案/`(1200,1200)` 注释里）。
**影响（触发条件）**：把 `FAR_RESET_PX` 改成约 1132~1697 之间的任意值，九条断言**全绿**——SCOPE 写死的 1500 可自由漂移而门禁无感。`NEAR_FULL_PX`（400）同理，且它不在 SCOPE 里（属设计加法）。
**修复建议**：照 `SAMPLE_HZ === 60` 的同一写法加 `assert.equal(FAR_RESET_PX, 1500)`；`NEAR_FULL_PX` 的设计自由写进 DESIGN/MOTION。

**P3（8 条）**

- **R-04 ｜ P3 ｜ `src/character/HeiCat.tsx:117-130`（`geometry.ts:77-78`、`DESIGN_TOKENS.md:91`）**：SCOPE §7 元素表写瞳孔 `<circle>`、§8 写"瞳孔纯黑、**圆**"；实现是两枚 `<ellipse rx32 ry41>`（64×82，长短轴比 0.78）。已在 `STATE.md` 未决问题 10② 登记为"已自行裁决·可翻案"，但 SCOPE 未同批回写，也没有断言判"圆"。**修复**：改回正圆（SCOPE 优先，2 行 + 2 个元素换名）或把 SCOPE §7/§8 就地改成 `<ellipse>` 并附取值依据。
- **R-05 ｜ P3 ｜ `src-tauri/tauri.conf.json:13-26`**：SCOPE §7 写"初始位置**屏幕居中偏右下**"；配置无 `x`/`y`/`center`，而 Tauri 的 `center` 默认 **false**（`config.schema.json:275`）⇒ 初始位置由系统默认放置决定，不保证居中、更不保证偏右下。**修复**：加 `"center": true`（至少居中）并在 SCOPE/`UI.md` 登记"偏右下"的取舍，或改文档字面。
- **R-06 ｜ P3 ｜ `public/vite.svg`（`index.html:5`）**：NFR **S5**「入库的官方素材数 = 0」按其自己的命令实测 = **1**（Lead 复核：`@(git ls-files 'public/*' 'src/**' | ? { $_ -match '\.(png|jpg|jpeg|webp|gif|svg)$' }).Count` → `1`，唯一命中 `public/vite.svg`）。批次 1 的退役清单没把它算进去；`TD-008` 只点了 `index.html:5,7`，没点这个文件。**修复**：5-1 收尾同批删 `public/vite.svg` + 删 favicon 行（TD-008 的自然结清），或把 S5 的命令口径限定为"官方 IP 素材"并写进 NFR。
- **R-07 ｜ P3 ｜ `src/character/geometry.test.ts:131-141`**：SCOPE §5 M3 判据是"造型色板内白色**仅出现在眼白**"，断言实现成"TSX 文本里 `fill="#FFFFFF"` 出现 2 次 + 无其它色彩字面量"，**不校验这 2 处落在眼白元素上**；把白色挪到尾/耳上（眼白改别的色）断言照绿。**修复**：断言命中行同时含 `hei-eye-white`（或解析 JSX 属性对），三行即可。
- **R-08 ｜ P3 ｜ `src/interaction/useCursorFollow.ts:143-208`**：NFR **M5**「函数 ≤50 行」（验证方式写明 4-2 逐文件复核）；该 hook 物理行跨度 **66 行** > 50，按可执行语句计约 24 行，两个内嵌闭包（7 行 / 20 行）各自合规；其余函数最长 `characterBounds` 47 行。**修复**：把"物理行 vs 语句行"口径写进 NFR M5，或抽成 `useWindowGeometry()` / `useSampleLoop()`。（**与 S-08 是同一事实被两轴各自提出**，按卡各记各的编号。）
- **R-09 ｜ P3 ｜ `src-tauri/tauri.conf.json`（无位置键）+ `src/interaction/useCursorFollow.ts:97`**：SCOPE §6 **U2**（显示器拔掉/分辨率变更 → 窗口落在已不存在的坐标）在实现里**无任何处置**：无位置回收，`currentMonitor()` 取不到时只把 `scaleFactor` 兜成 1。SCOPE 自己把 U2 的判据挂在 **S4（Should、本期延后）**上，而 S1 位置记忆也未做 ⇒ "重启后回默认位置"事实上成立，只剩"运行中不回收"。**修复**：在 SCOPE §6 或 `STATE.md` 把它显式记为**接受的限制**。
- **R-10 ｜ P3 ｜ `src-tauri/tauri.conf.json:23-24`**：`resizable:false` / `maximizable:false` 是 SCOPE 从未写过的两个键（M1 只钉 6 键），有下游依据（`docs/UI.md:60` + `DESIGN.md:158`，带 `window-lock OK 2/2`），属"UI 设计追加"而非范围外行为。**修复**：SCOPE §7 窗口本体行补一句，或在本报告登记为已知追加；不建议回退（回退会破 M6 命中与 M3 比例）。
- **R-11 ｜ P3 ｜ `docs/UI.md:80`（`src/interaction/useDragExit.ts:98-101`）**：唯一动作「退出」的鼠标路径 = 右键菜单；键盘等价物 Alt+F4 **在代码里没有任何实现或断言**，只有 `UI.md:80` 的一句"4-3 核；若实测不通，7-6 卡必须写未满足"，而本会话 GUI 起不来，该承诺至今未兑现。若它在 `decorations:false + skipTaskbar:true` 的窗口上不通，本项目**没有任何可用的退出路径**。**修复**：4-3 键鼠清单第一条就核它；不通则按"未满足"记，并按 ACL 口径补一条键盘退出。

### 2.3 Lead 复核记录（不新增发现、不改轴内判级与编号）

| 条目 | 复核命令（真跑） | 结果 |
| :-- | :-- | :-- |
| S-01 | `Select-String scripts/nfr.ps1 -Pattern 'Check-LaunchCycle\|Check-Availability\|\$Check -eq'` + `orphans.ps1` | **证实**：定义 `:268`，分发 `:292-297` 六行无一调用；`orphans.ps1` 独立报 `零引用导出 1 项 = Check-LaunchCycle` |
| S-02 | 读 `useDragExit.ts:76-88` | **证实**（`??=` 在 `await` 之后写回，并发两次都读到 `null`） |
| S-03 | 读 `APIS.md:29` | **证实**（现象列仍写 "resolved 为 null"，拦截点仍指 gaze/hitTest） |
| S-04 | `docs/UI.md:117` 命令原文复跑 | **证实**：`AI 味与防溢出命中 4（要求 0）`；4 个文件、17 行、34 个字符 |
| S-05 | `npx tsc -p tsconfig.node.json --noEmit` | **证实**（`TS2578`；**退出码实测 1**，轴记 2，以实测为准） |
| S-06 | 读 `UI.md:19` + `git grep -n "lastCommand\|去重\|只打第一次" -- src scripts` | **证实**（口径在位、实现为空） |
| S-07 | `git log --reverse` 定位首笔 4-1 → `git diff --shortstat 3ce6494..HEAD` | **证实并加重**：+2370/−748 = **3118** > 触发线 1863（超 67%），无停下、无留痕 |
| S-11 | 读 `TESTPLAN.md:31,102,150` + 实跑测试 | **证实**（8/8/41 → 实测 6/6/39） |
| S-13 | `acl-manifests.json` 检索 `core:default` | **未复现**轴的包含关系依据（文件内 `core:menu:default` 仅 1 次、无 `core:default` 键）；处置不变，依据待补 |
| R-01 | `node` 直调 `characterBounds()` + `isOverCharacter()` | **证实**：头盒 `x 48..212 / y 19..189`；`(130,24.4)/(130,21)/(50,40)/(210,40)/(51,180)` 全 `true`，`(5,5)/(250,10)` 为 `false` |
| R-02 | 读 `geometry.ts:53,66-67,83,96` | **证实**：`EYE_RX=45 < EYE_RY=52`，代码取 `EYE_RY`（满偏 23.4 ≠ 20.25） |
| R-03 | `git grep -n "1500\|FAR_RESET_PX" -- src` | **证实**：无 `assert.equal(FAR_RESET_PX, 1500)`；边界由实现常量构造 |
| R-06 | NFR S5 的命令原文复跑 | **证实**：素材计数 = **1**（`public/vite.svg`） |
| **L-01**（Lead 侧机械核出，**未进两轴清单**，故不计入 §4.1 的 25 条） | `[IO.File]::ReadAllLines()` 量行数 + 读 `docs/README.md:21` | **事实**：`docs/registry/COMPONENTS.md` **真实 72 行 > 上限「单页 ≤50」**（锚点 `3eac5b5` 处为 26 行；`docs/README.md:41` 给出的处置是"拆"）；**全仓无任何脚本强制这条上限**（`orphans.ps1` 只读该文件做登记核对）。同类全部复核：`UI.md` 119/120、`MOTION.md` 98/100、`DESIGN_TOKENS.md` 98/110、`ARCHITECTURE.md` 150/150、`I18N.md` 46/60、`README.md` 42/55、新教训 11/12 —— 只有它超限。**请用户在拆页 / 改上限 / 记债之间裁决**（`STATE.md` 未决问题 15②） |

**判级争点（Lead 附注，不改变轴内编号与结论）**：S-01 的 **P1** 建立在卡 §② 维度 1 那句「任一层断 = P1（核心功能不可用），不是 P2」上；该句在卡里的上文是「**有 UI 时按 SCOPE 的 UI 描述走查三层链路**」，即 P1 标签绑定的是**界面三层链路**，而「每个新增/被修改符号有调用点」这一句本身未附级别。本条的**事实**（无调用点、A2 拿到假绿）已复核证实；**判级**若按卡内平局规则「不确定按 P2」则为 P2。**两种判级的出口相同 = 回 4-1 修复**，故本报告保留轴的 P1 与 🔴，并把该争点一并交给用户裁决（见 §4）。

**规格轴初稿另提、终稿未保留的两条（Lead 附注，供该轴或用户复核；不计入本报告计数）**：① `package.json:21` 的 `@types/node ^26.6.4` 与 `.tool-versions` 的 `nodejs 24.21.0`（实测 `node -v` = v24.21.0）相差两个大版本，类型面高于运行面（**Lead 已复核为事实**）② 「第二次右键能否再弹出」无可信判据 —— 与 `STATE.md` 未决问题 12⑥ 同一条，已登记。

---

## 3. 通过项

### 3.1 逐维度通过（两轴共同覆盖范围）

| 维度 | 结论 | 覆盖范围与证据 |
| :-- | :-- | :-- |
| ① 接入性与装配 | ✅（除 S-01） | 三层链路全通：`index.html:11` → `src/main.tsx:5` → `App.tsx:14` → `HeiCat.tsx:56`；入口 = 唯一窗口本体（无路由）；handler `HeiCat.tsx:60-61` ← `App.tsx:17` ← `useDragExit.ts:44-63` ← `:71-92`。**capability ↔ 调用方逐条对账全通**：`core:default`→`useCursorFollow.ts:22,87-91`；`allow-close`→`useDragExit.ts:72`；`allow-start-dragging`→`:75`；`allow-set-ignore-cursor-events`→`usePointerPassthrough.ts:67`；`core:menu:default`→`useDragExit.ts:12,77,88`。实测 `acl OK 4/4` + `acl-callers OK 4/4（未落盘跳过 0 条）` |
| ② 逻辑性 | ✅ | 空值/越界/重复触发/失败路径逐个过：`gaze.ts:33,53`、`hitTest.ts:21,34`、`useCursorFollow.ts:97,117-125,135-136`、`usePointerPassthrough.ts:47-49`、`useDragExit.ts:48-56`；**9 处 catch 全部落显式报告点，无空 catch**；无多步写操作 ⇒ 事务边界 N/A（零落盘、零 DB） |
| ③ 牵连性 | ✅（除 S-03/S-10） | 签名/返回值变更的调用方全部跟上（`useCursorFollow` 3→5 项 → `App.tsx:15-16`；`usePointerPassthrough` 2→3 参 → `App.tsx:16`；`HeiCat` 新增 4 props 均带缺省）。被删符号零残留：`greet` **0**、`opener` 2（均为**正向守卫断言**）、`tauri.svg`/`react.svg` 代码面 0。四份文档：`APIS.md` 存在（S-03）、`CHANGELOG.md` 已同批更新、`DATA_DICT.md` **N/A（无表无字段无持久化，文件未改＝正确）**、`TECH_DEBT.md` 存在 |
| ④ 性能 | ✅ | 全项目**唯一** 60Hz 定时器（`gaze.test.ts:123-147` 扫生产源码断言持有者恰 `useCursorFollow.ts`、`rafUsers === []`）；穿透层零采样（同文件 `:154-160`）；资源清理齐（`clearInterval` + `onMoved/onResized` 退订 + 卸载竞态 `alive` 守卫）；值未变不 `setState`；IPC 仅翻转时发（实测 120 拍 2 次）。无 N+1/无界查询/循环内 IO |
| ⑤ 冗余死代码 | ✅（除 S-01/S-09） | 无复制粘贴改名块（两眼/耳/腿/瞳/眼睑走数组索引）；无恒真恒假分支——`gaze.ts:38` 的夹取今天不可达但**理由已就地写死**，`useDragExit.ts:94-97` 的 `ceiling:/upgrade:` 同理，属"疑似保留已写理由"的合规保留 |
| ⑥ 开发规范 | ✅（除 S-08/S-11/S-12） | 最长源文件 `geometry.ts` 270 行（≤500）、最长测试 250 行（≤1000，`[IO.File]::ReadAllLines()` 口径）；`strict: true`、**零 `any`**；注释一律写 Why；提交信息 30/30 符合 `<卡号> <type>(<scope>): <subject>`；生产代码零硬编码路径/URL/端口/密钥。**文档行数全合规**（`ReadAllLines` 口径）：ARCHITECTURE 150/150、UI 119/120、MOTION 98/100、DESIGN_TOKENS 98/110、I18N 46/60、README 42/55、新教训 11/12 |
| ⑦ 安全 | ✅ **0 条发现** | 无新增对外接口（同进程 IPC、不监听端口）；授权 ≤5 且无未调用；`Cargo.toml` 只有 `tauri`/`serde`/`serde_json`，**无网络依赖**；XSS/CSRF/上传/路径穿越 **N/A（无输入控件、无表单、无写接口）**；口令哈希 **N/A（零认证面，3-2 永久跳过已显式接受）**；新增依赖 `npm audit --json` → `vulnerabilities: {}`、total **0**，lockfile 随批提交。安全四条硬规则：无安全发现故无待证据链项；未标注任何安全严重度；未产出需第三方复核的安全结论（本轴兼发现者与复核者，故只给通过面陈述）；回执格式完整 |
| ⑧ UI 可访问性 | ✅（除 S-04/S-06/S-14/R-11） | S1 空态 = 什么都不画（`App.css:20` 保证首帧前即透明）；S3 错误态见 S-06；对比度门禁复跑 **5/5 PASS**（19.98 / 3.29 / 3.03 / 5.17 / 4.06，与 `DESIGN_TOKENS.md` §4 逐位一致）；触控 44px **N/A（桌面指针设备；等价判据 = 猫身并集 ≥24×24，`UI.md:103-104` 已登记）**；键盘路径 Alt+F4 **○ 未审（需真机，GUI 本会话不可用）** |
| ⑨ 外部调用 | ✅ | 唯一第三方面 = Tauri IPC：**有适配层**（"纯逻辑 + 真端口"两层 + `readCursorScreen`/`readGeometry` 收口）、**有降级**（E-IPC-02 回正并保持上一次穿透取值、不重试）、**有根因化错误信息**（带命令名 + 排查指引）。**显式超时 = 无**，判为不立案（同进程 IPC、亚毫秒往返；硬加超时反而会掩盖 E-IPC-01/02 的形态区分，代价已在 `ARCHITECTURE.md` §8 的翻案条件下可追）。Webhook 验签/幂等 N/A（无入站回调） |
| ⑩ 性能预算 | ✅（**无独立预算文件**，按 `NFR.md` §1 的阈值行对照） | **P3**（60Hz±5%）由 `gaze.test.ts:123-136` 断言常量 + 采样间隔落 16.7±0.8ms；**P1** 结构面满足（唯一定时器 + 值未变不写 DOM + 仅翻转时 invoke + 关键帧只动 `transform`）；**C2**（DOM ≤60）实测 **14**。P2/P4/C1/C4/K4 属真机/构建态测量 → **○ 4-3** |
| ⑪ 数据隐私 | ✅ / **N/A + 原因** | 零个人数据：`DESIGN.md` §2 五行全标 D1（进程内瞬时的角度/坐标/布尔/只读窗口几何），**无 D3/D4 字段**；不落盘（NFR C3）、不外发、无日志落盘（`reportIpcFailure` 只进 console）。`PRIVACY.md` 仍是 7-5 骨架且本批未触及 ⇒ 无需同批回写 |

### 3.2 标准轴的通过项（本轴覆盖范围）

- **① 接入装配**：三层链路全通（见上表）；24 个新/改符号全部有生产调用点（`VIEW_BOX`→`HeiCat.tsx:58`、`CAT_GEOMETRY`→`:44`、`pupilOffsetFor`→`:48`、`characterBounds`→`usePointerPassthrough.ts:40`、`SAMPLE_HZ`→`useCursorFollow.ts:203`、`gazeAngle/gazeTravel`→`:140`、`screenToViewport/isOverCharacter`→`usePointerPassthrough.ts:50`、`reportIpcFailure`→3 个模块共 5 处、`sampleCursor`→`:184`、三个 hook→`App.tsx:15-17`、`HeiCat`→`App.tsx:19`）。用 `acl-manifests.json` 反查确认所用读查询都在 `core:window:default` 的 28 条与 `core:event:default` 的 4 条里，**无"代码调了但没授权"的静默失败面**。
- **④ 性能**：`gaze.test.ts` 的 `timerHolders === ["interaction/useCursorFollow.ts"]`、`rafUsers === []` 实测通过。
- **⑤ 死码**：`geometry.test.ts`/`motion.test.ts` 断言的每处"疑似保留"都有就地理由。
- **⑥ 规范**：`git grep ': any|as any|<any>|Record<string, any>' -- src` → 0 命中；唯一 `as unknown as` 在 `dragExit.test.ts:16,118`（TESTPLAN §7 规定的 `window` 垫片与 `runCallback`）。
- **⑦ 安全**：`npm audit --json` → `"vulnerabilities": {}`；`.env` 未被跟踪（security STEP `[OK]`）。
- **⑨/⑩**：见上表。
- **⑪**：见上表。

### 3.3 规格轴的通过项（本轴覆盖范围）

- **① 接入性与装配**：层① 挂载/注册 `index.html:11` → `src/main.tsx:5` → `src/App.tsx:14` → `HeiCat.tsx:56`；窗口注册 `tauri.conf.json:13-26` + `capabilities/default.json:5`（label 缺省即 `main`）。层② 入口 = 双击 `luoxiaohei.exe` / `npm run tauri dev`（`UI.md:9`），单窗口即界面、无路由 ⇒ 不存在"页面写完没挂路由"。层③ handler 绑定链完整；透明区不进 DOM（`heicat.css:28` + `:46-55`），由 OS 级 `setIgnoreCursorEvents` 接管。**层② 的运行面本环境未验证**（见 §4 未验证面）。
- **② 逻辑性（需求侧）**：**U1/U3/U4/U5 逐条有处置**（U1 = `useCursorFollow.ts:85-99` 三值同换 + `hitTest.ts:21` 非法缩放按 1 + 四组缩放用例；U3 = `useCursorFollow.ts:117-125` 同时挡 `null` 与 `TypeError`、`:135` 回正、KP-13 实测；U4 = `useDragExit.ts:45-56` 在途互斥 + KP-12·② 实测 120 拍 0 次；U5 = 原生菜单语义，代码内无"点击即退出"副作用）。**U2 无处置 → R-09**。
- **③ 牵连性**：`greet` 0 命中；`opener` 2 命中且两处都是"必须已删除"的反向断言；8 条验收命令引用的文件全部存在且可跑。
- **⑤ 冗余死代码与范围外行为**：**W1~W14 逐条反查全部成立**——`src/` 内 `canvas|localStorage|sessionStorage|fetch(|XMLHttpRequest|WebSocket|http://|https://` 命中 **0**；右键菜单恰好一项（实测 `条目 ["退出"]`）。
- **⑥ 开发规范（需求侧）**：NFR M1 已跟踪文件最长 **305 行**（`scripts/nfr.ps1`），代码面 270、测试 250 ⇒ 通过；提交信息 30 笔统一格式。
- **⑦ 安全（需求侧）**：S2 授权 ≤5 实测 5 条、无重复无未调用；S4 无密钥；S1 静态面无联网；无鉴权/越权面。
- **⑧ UI 可访问性**：逐项判定（触摸目标 N/A + 理由、对比度有处置、空态成立、键盘路径见 R-11）。
- **⑨/⑩/⑪**：`N/A` + 逐条理由（见上表）。
- **SCOPE §7 元素级表格逐行核对**：窗口本体 ✅（"初始位置居中偏右下"未实现 → R-05）｜角色根 `<svg>` ✅（宽度 = 260 CSS px、高 292.5、底部余 7.5，`geometry.ts:39-42` 已登记 8px 为取整）｜躯干组 ✅｜眼白 ×2 ✅｜瞳孔 ×2 ⚠️（`<ellipse>` → R-04；满偏用长半径 → R-02）｜眼睑 ×2 ✅｜尾巴 ✅｜右键菜单 ✅。**§7 两个被定死的实现选择**：原生菜单**遵守**、SVG+CSS 不引 Canvas **遵守**（`src/` 内 `canvas` 0 命中）。
- **M1~M8 × 实现证据 × 验收命令实测**（4-3 行为验收的直接输入）：

| # | 实现证据（文件:行） | 验收命令实测（本会话原文） |
| :-- | :-- | :-- |
| M1 | `tauri.conf.json:16-24`（6 键 + 2 锁键） | `npm run typecheck` **exit 0**；`tauriConfig.test.ts` → `window-config OK 6/6`、`window-lock OK 2/2`，6 pass **exit 0** ✅ |
| M2 | `capabilities/default.json:8-11`；调用方 `useDragExit.ts:72,75,77`、`usePointerPassthrough.ts:67` | `acl OK 4/4` + `acl-callers OK 4/4（未落盘跳过 0 条）` **exit 0** ✅ |
| M3 | `HeiCat.tsx:56-135`（7 层）、`geometry.ts:52-205`、`heicat.css:13-21` | `M3·① 0.92 / ② 0.60 / ③ 1.244 / ④ 白色 2 处 / ⑤ 色板 7 色 / ⑥ 1:1.10`，6 pass **exit 0** ✅（"像不像"留 4-3 人眼） |
| M4 | `heicat.css:111-171`、`HeiCat.tsx:81,89,133-134` | `3200ms（1→1.03→1）/ 单次 100ms、闭合 50ms / 2400ms / 峰值 8° / 三周期两两不同、LCM 48s`，6 pass **exit 0** ✅ |
| M5 | `gaze.ts:12,19,22,29-59`、`useCursorFollow.ts:203`、`HeiCat.tsx:48-53` | 六方向逐条 + `1500` 边界两侧 + 2880 组方向夹取 + 7 组非法输入回 0 + `SAMPLE_HZ=60`，9 pass **exit 0** ✅（幅度侧缺口见 R-02/R-03） |
| M6 | `hitTest.ts:20-42`、`usePointerPassthrough.ts:38-70`、`App.tsx:15-16` | 四组缩放（含副屏负原点）+ 猫身内 3 点与往返 + 窗口内 4 个透明点不命中，6 pass **exit 0** ✅（R-01 的精度面未被覆盖） |
| M7 | `useDragExit.ts:44-101`、`App.tsx:17`、`HeiCat.tsx:60-61` | `start_dragging 共 2 次（右键 0 次、在途被互斥挡住）`；`menu\|new 1 次 / popup 2 次 / close 1 次；条目 ["退出"]`，6 pass **exit 0** ✅ |
| M8 | `check.ps1:12`（4 条 STEP）、`package.json:11-12` | 4 条 STEP 各 `[OK]`（含 `security: 红 0/黄 0`），`全部通过（退出码 0）：完成声明成立。` **exit 0** ✅ |

---

## 4. 结论

### 4.1 四级计数与建议色

| 轴 | P0 | P1 | P2 | P3 | 小计 | 本轴建议色 |
| :-- | :-: | :-: | :-: | :-: | :-: | :-- |
| 标准轴（S-） | 0 | **1**（S-01） | 6（S-02~S-07） | 7（S-08~S-14） | 14 | **🔴 红**（P1≥1） |
| 规格轴（R-） | 0 | 0 | 3（R-01~R-03） | 8（R-04~R-11） | 11 | **🟡 黄**（P0=P1=0，有 P2/P3） |
| **合计** | **0** | **1** | **9** | **15** | **25** | **🔴 红**（按唯一判色依据：P1 ≥ 1） |

**建议色 = 🔴 红**。旧报告核销：`docs/reviews/` 本次审查前为空 ⇒ **无未核销旧 P0/P1**。
**判级争点（见 §2.3）**：若裁决把 S-01 按卡内平局规则「不确定按 P2」处理，建议色降为 **🟡 黄**。**两种出口相同 = 回 4-1 修复**，差别只在"是否禁止合入"这一表述上。
**本轮发现 25 条，其中可行动 25 条**（无纯措辞型条目）。另有 Lead 侧机械核出的 **L-01**（`COMPONENTS.md` 超文档行数上限，见 §2.3）——**未进两轴清单、不计入上面的计数**，只作为待裁决事实列出。

### 4.2 取代与废弃检查结论（命中即红灯）

- **并行态登记行数 = 0**（`STATE.md:53-56` 表体为「（空）」；`:58` 有 `opener` 残留行的销行记录，删除条件"4-1 批次 1 落地"已兑现）。本批无"被取代但未删除"的旧实现：`greet`（3 处注册）、`tauri-plugin-opener`（4 处）、演示页与两个素材均**同批删除**；三种合法保留理由（灰度/对外契约/证据副本）均不成立，工作树无 `.bak`/`旧版/`/`副本 2`。
- **废弃标记命中数 = 1**，判定 **已申报**：`docs/specs/2026-10-06_desktop-pet/RESEARCH.md:87` 的表头 `| 候选 | 最后提交 | 最近发版 | 是否 archived / deprecated |`。保留理由：它是 2-6 卡外部方案五查第 ② 问「活不活」的**表格列名**，问的是"第三方候选库是否已废弃"，**不是**本仓库任何被取代实现的标记；无删除对象，故无删除条件（删掉它该判据就丢了）。**未申报 = 0 条**。
- 命令原文与完整输出（锚点断言已通过）：

```powershell
$anchor = (Select-String -Path STATE.md -Pattern '起点锚点\s*[:：]\s*([0-9a-fA-F]{7,40})').Matches[0].Groups[1].Value; git rev-parse --verify "$anchor^{commit}"; if ($LASTEXITCODE -ne 0) { throw "锚点无效" }; git diff -U0 "$anchor..HEAD" | Select-String '^\+' | Select-String '_old\b|_legacy|_v2\b|Deprecated|暂时保留|废弃|TODO[:：]\s*(删|remove|delete)'
# 输出（1 行）：
# +| 候选 | 最后提交 | 最近发版 | 是否 archived / deprecated |
```

### 4.3 降标守卫五查（第 1 轮；本轮无"修复 diff"，在整批新增行上跑）

```powershell
git diff -U0 "$anchor..HEAD" | Select-String '^\+' | Select-String 'skip\(|\.only\(|eslint-disable|ts-ignore|ts-expect-error|noqa|SuppressWarnings'   # → 空输出 = 合格
git diff -U0 "$anchor..HEAD" | Select-String '^\+' | Select-String '(max|limit|budget|threshold|tolerance|timeout|retries|coverage)\w*\s*[:=]\s*\d+'  # → 5 行，逐条判定如下
```

| 查 | 结论 |
| :-- | :-- |
| ① 阈值被挪 | **无**。命中 5 行逐条判定：TD-002 描述行（文档表格）、`scripts/nfr.ps1` 的 `MaxSourceLines=500` / `MaxTestFileLines=1000` / `MaxPermissionCount=5` / `LaunchFailuresMax=0`（**首次定义**，与 D14①、NFR S2 逐条一致，不是放宽）、`dragExit.test.ts:52` 的 `timeoutMs=1000`（测试轮询超时，非产品阈值） |
| ② 测试变简单 | **无**（0 命中 `.skip(`/`.only(`；无注释掉或删除测试；精确断言未被换成"不抛错就算过"） |
| ③ 检查器被静音 | **1 处待判**：`vite.config.ts:3` 的 `@ts-expect-error`——它是**先于本批存在**的旧抑制指令，被本批的依赖变更**弄失效**（S-05），属"抑制过期"而非"新增静音"；本批新增行里 `ts-ignore`/`eslint-disable`/`noqa` 命中 **0** |
| ④ 阈值文件与失败功能同一次提交 | **无**（`scripts/nfr.ps1` 的阈值块与任何"让门禁变绿"的提交不同批） |
| ⑤ 工件大小放宽 | **无**（未调大任何包体积/依赖数量预算） |

### 4.4 复核轮次

**第 1 轮（上限 3）**。本轮为首次审查，无 P0/P1 需核销、无旧 P2/P3 需标注。**重审范围**（若回 4-1 修复后再审）：修复 diff 跑全部七个维度 + 取代与废弃检查 + 本清单逐条核销（已修/未修/新引入）+ 并行态登记簿逐行复核。

### 4.5 未验证面（不计数，4-3 必须带上）

- 本会话**跑不起任何 WebView2 GUI 应用**（`STATE.md` 风险摘要 ㊲，带控制组：HEAD 原脚手架配置同样 panic `os error 5 @ app.rs:1444`）⇒ M1/M3/M4/M5/M6/M7 的**运行面/目视面**（透明穿透、瞳孔跟随、三组动画是否可见、拖拽、右键菜单、Alt+F4）本轮**一条都没验**；已验的只是 SCOPE §5 的 8 条验收命令本身（全绿）。
- **A3 实验（"透明像素是否本来就穿透"）既未证实也未证伪**（`STATE.md` 未决问题 3）⇒ M6 的 OS 侧真值仍缺，是 4-3 行为验收的第一顺位。
- `cargo build` / 构建态与真机态的 NFR（P1/P2/P4/C1/C4/K4、A1/A2/A3）均留 4-3。

### 4.6 越界检查与错误码闸（卡内必查项）

- **越界检查**：语义性"顺手优化" **0 处**；纯机械格式化 **0 处**（`package.json` 的 dependencies/devDependencies 字母序重排是 npm 工具产物，按卡不 revert，仅提请注意）；**SCOPE 从未讨论的文件 3 组，均已申报**：① `docs/I18N.md`（1 行，`CHANGELOG.md:51` 有理由）② `gate.ps1`/`orphans.ps1`/`scripts/nfr.ps1` 的 7-3 P2 批改动（`TECH_DEBT.md:23-38` + `STATE.md:39` 登记）③ 4 个失效 `.gitkeep` 删除（`STATE.md:38` 登记）。`index.html` 未动且已登记 `TD-008` ⇒ 不判红旗。
- **错误码闸**：`E-IPC-01` / `E-IPC-02` / `E-IPC-03` 三条**均能在 `docs/registry/APIS.md` 查到**（`:28-30`），生产代码无未登记新码 ⇒ **闸门通过**；但 `APIS.md:29` 的行内容与实现不符（S-03）。
