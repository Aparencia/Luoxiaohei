# RESEARCH · 罗小黑桌面摆件 MVP（首个功能）

> 产物寿命：**持久（进仓库）** ｜ 卡：2-1 功能调研 ｜ 母版：roadbook v0.9.0 / 规则版本 2026-10-05.2
> 时间戳：开始 2026-10-06 ｜ 状态：**调研完成，等待裁决**
> 上游：`docs/pool/IDEAS.md:5`（approved）→ `docs/decisions/IDEA_2026-10-06_罗小黑桌面宠物.md` → `docs/decisions/STACK_2026-10-06_桌面摆件技术栈.md`

---

## 0. 裁决状态

| 项 | 建议 | 用户裁决 |
| :-- | :-- | :-- |
| 方案 | **方案 A**（SVG + CSS 动画 + Tauri 核心窗口 API） | **待裁决** |
| 档位 | **L** | **待裁决** |

---

## 1. 任务复述

一个背景透明、永远置顶、无边框的常驻窗口：里面是一只 SVG 手绘的罗小黑（猫形态），会呼吸 / 眨眼 / 甩尾，瞳孔跟随鼠标，可拖拽移动，右键退出。**不含**养成、多角色、语音、开机自启、联网（IDEA 卡动作 4 已明确排除）。

---

## 2. 动作 1 · 读三处上游（先查再动手，防平行新建）

| 上游 | 查证结果 |
| :-- | :-- |
| `docs/pool/IDEAS.md` | **L5 已在池中**，状态 `approved`：「Windows 桌面常驻罗小黑猫形态活摆件（透明置顶、呼吸眨眼甩尾、瞳孔跟随鼠标）」→ **禁止另起炉灶** |
| `docs/ARCHITECTURE.md` | §1 模块图 L18 已用虚线标注 `UI -.->|"invoke() 窗口控制（首个功能才实现）"| SHELL`——**本次就是把这根虚线变实线**；§2 L28 定死「外壳层 `src-tauri/` 是唯一碰操作系统 API 的地方」；§4 L45-52 新代码落点表已给出 `src/`（角色与动画建议独立子目录）、`src-tauri/src/`（窗口控制命令）、`src-tauri/tauri.conf.json` 三处落点 |
| `docs/registry/COMPONENTS.md` | **registry 查过：7 行全部是脚手架文件**（App / main.tsx / vite.config.ts / vite-env.d.ts / main.rs / lib.rs / build.rs），**无任何角色渲染或窗口控制组件可复用，需全部新建**；该文件 L20 已预留注释「角色渲染组件尚未存在：首个功能（2-1 → 4-1）落地后在此新增页面节」 |
| `docs/registry/APIS.md` | **只有 1 行示例行**（`POST /api/v1/bills`，行内自注「示例行：接入真实接口后替换本行」）。本项目无服务端 → 无现成接口可复用；本次也**不新增对外接口**（Tauri `invoke` 是同进程 IPC，不监听端口、不对外暴露） |
| `docs/registry/DATA_DICT.md` | **只有 1 节示例节**（`bills`，行内自注「示例节：换成真实表后删掉本节」）。本项目无数据库 → 无表可复用、**无表结构变更** |

---

## 3. 本次核到的事实（全部来自本仓库实测或上游源码，非记忆）

| # | 事实 | 证据 |
| :-- | :-- | :-- |
| F1 | 前端 Tauri API 实装 **2.12.1**，Rust 侧 `tauri` crate 版本约束 `"2"` | `node_modules/@tauri-apps/api/package.json`；`src-tauri/Cargo.toml:21` |
| F2 | `startDragging()` / `setIgnoreCursorEvents()` / `setAlwaysOnTop()` / `setSkipTaskbar()` / `outerPosition()` / `cursorPosition()` / `currentMonitor()` **全部存在于已装包内** | `node_modules/@tauri-apps/api/window.d.ts` L1439 / L1425 / L1066 / L1306 / L430 / L2354 / L2295 |
| F3 | 窗口配置键 `transparent`(L391) `decorations`(L406) `alwaysOnTop`(L416) `skipTaskbar`(L431) `shadow`(L503) `focusable`(L386) `resizable`(L351) `noRedirectionBitmap`(L443) 全部存在 | `node_modules/@tauri-apps/cli/config.schema.json` |
| F4 | **`shadow` 默认 `true`；schema 原文：无边框窗口下 `true` 会产生 1px 白边，Win11 还会带圆角** → 摆件必须显式写 `shadow:false` | `config.schema.json:504` |
| F5 | `transparent` 在 Windows 上可用 `noRedirectionBitmap` 避免创建时的白闪 | `config.schema.json:392` |
| F6 | **`core:default` 自动含 `core:window:default`** | [官方 Core Permissions](https://v2.tauri.app/reference/acl/core-permissions/) |
| F7 | `core:window:default` **已含**：`outer_position` `cursor_position` `current_monitor` `is_always_on_top` | `tauri-v2.12.1` 标签 `crates/tauri/build.rs` 的 `(command, enabled_by_default)` 表 |
| F8 | `core:window:default` **不含**（`false`）：`close` `set_always_on_top` `set_ignore_cursor_events` `start_dragging` `set_skip_taskbar` → **必须显式补进 capability** | 同 F7 |
| F9 | 现 capability 只授了 `core:default` + `opener:default` → **上述 5 条命令当前全被 ACL 拦** | `src-tauri/capabilities/default.json:6-9` |
| F10 | **`src-tauri/Cargo.lock` 不存在** → Rust 依赖从未编译过，首次 `tauri dev/build` 要现拉并编译全部 crate | `Test-Path` 实测返回 False |
| F11 | **仓库里没有任何罗小黑形象素材**：`ref/` 目录不存在、IDEA 卡引用的半成品 `src/HeiCat.cs` 也已不存在 | `Test-Path 'ref'` / `Test-Path 'src\HeiCat.cs'` 均 False |
| F12 | 当前窗口是脚手架默认值：800×600、有边框、不透明、不置顶 | `src-tauri/tauri.conf.json:15-17` |
| F13 | `git grep -n "greet"` 命中 10 处（`src-tauri/src/lib.rs` 3 处 + `src/App.tsx` 6 处 + `src/App.css` 1 处 + `docs/registry/COMPONENTS.md` 1 处） | `git grep` 原文 |

> **F4 与 F9 是本次最有价值的两条**：前者是一个不改就会在成品上看得见的白边，后者是一组不补就会「代码写对了但运行时静默被拒」的权限。

---

## 4. 动作 2 · 方案对比（2 个完整方案 + 1 个被否案）

| | 方案 A（**推荐**） | 方案 B | 方案 C（**被否**） |
| :-- | :-- | :-- | :-- |
| **一句话** | Tauri 核心窗口 API + React/SVG 角色 + CSS keyframes 动画 + JS 侧 `cursorPosition()` 轮询 | Rust 侧用 `windows` crate 做原生窗口扩展（自绘 + 原生光标追踪 + 精确命中测试） | Canvas 2D 逐帧绘制角色 + 自建 `requestAnimationFrame` 动画状态机 |
| **改动面** | **8~10 文件**：`src-tauri/tauri.conf.json`、`src-tauri/capabilities/default.json`、`src-tauri/src/lib.rs`（删 greet）、`src/App.tsx`（整份替换）、`src/App.css`（整份替换）、新增 `src/character/HeiCat.tsx`、`src/character/heicat.css`、`src/interaction/useCursorFollow.ts`、`src/interaction/useDragExit.ts` | **12~15 文件**：A 的全部 + 新增两个 Rust 模块（原生窗口扩展 / 命令层）+ `src-tauri/Cargo.toml` 加依赖 | 同 A 的文件数，但角色由 Canvas 逐帧绘制（多一个动画循环模块，少一个 CSS 动画文件） |
| **新依赖** | **0**（F2 已证全部 API 在包内） | **`windows` crate**（须过新依赖三查） | **0** |
| **风险** | 中低：① Tauri #15947 透明合成竞态（STATE.md 已登记）② F4 白边 ③ F9 权限漏配静默失败 ④ 若选「透明区穿透」，A3 假设未实测 | 高：`unsafe` FFI、与 Tauri 窗口生命周期耦合、上游 API 跨版本变动、编译时间显著变长 | 中：动作保真度可控，但净增状态机代码 |
| **工作量** | **约 600~800 行** | 约 1200~1600 行 | 约 850~1150 行 |
| **结论** | **采纳**：零新依赖、零 `unsafe`、全部能力已被 F2 证实可用；把风险集中在三个已知点上，可逐条用最小实验证伪 | 缓：仅当「透明区穿透」实测在 JS 侧不可行（A3 证伪）时才升级到本方案 | 否：见下 |

**方案 C 否决理由（具体，非陪跑）**：SVG + CSS 已能用声明式 `@keyframes` 表达本卡需要的全部三组动作——呼吸 = 躯干 `scaleY` 往复、眨眼 = 眼睑 path 的 `scaleY` 快速往返（80ms）、甩尾 = 以尾根为 `transform-origin` 的 `rotate` 往复。改用 Canvas 2D 就必须自建**时间轴 + 插值 + 暂停/恢复**三套状态机，**净增约 250~350 行**，同时失去 devtools 里可逐节点检视的 DOM 结构——本项目是**纯手写矢量**（F11：仓库无任何形象素材），「能逐节点核对造型」是可维护性的关键，Canvas 把这唯一优势换掉了，**改动面无任何收益**。

---

## 5. 动作 2.5 · 拒绝台账

| 日期 | 提案 | 否决理由 | 既往请求编号 |
| :-- | :-- | :-- | :-- |
| 2026-10-06 | **Electron + TypeScript** 作为实现载体 | 四维打分 17 < Tauri 20：部署难度 3（要打包 Chromium 运行时）、现有知识 4；原文见 `docs/decisions/STACK_2026-10-06_桌面摆件技术栈.md` | STACK 卡「被否方案」（本会话 #1-2） |
| 2026-10-06 | **C# / .NET Framework + WinForms** 作为实现载体 | 四维打分 15：现有知识 1、AI 生态 4；原文同上 | STACK 卡「被否方案」（本会话 #1-2） |
| 2026-10-06 | **Canvas 2D 逐帧渲染角色**（本次新增） | 见上方方案 C 否决理由 | 本卡（#2-1） |

> 优先查了台账：上两行是本会话 1-2 卡的既有否决记录，本轮沿用，未重新论证。本次新增第三行。

---

## 6. 动作 3 · 新依赖三查

**方案 A 新依赖数 = 0**，故三查按「无新增」逐条给结论：

```text
① registry 三件套与 ARCHITECTURE 里已有近似能力吗？
   → 查过（见 §2）：无现成角色/窗口组件。本次要用的 @tauri-apps/api 是 1-2 卡选型时已装的核心包
     （node_modules/@tauri-apps/api@2.12.1，见 F1），不是本次新增 —— 属「复用已有」，不触发平行新建。
② 包真实存在吗？
   → 无新包需核实。既有包页面：https://www.npmjs.com/package/@tauri-apps/api
③ 官方文档链接给了吗？
   → 有，且是官方域：
     · 窗口定制（含 transparent/decorations 与权限示例） https://v2.tauri.app/learn/window-customization/
     · 核心权限清单 https://v2.tauri.app/reference/acl/core-permissions/
     · Rust API 文档 https://docs.rs/tauri/2.12.1/tauri/window/struct.Window.html
```

**若最终选方案 B**：需补 `windows` crate 的三查（包页面 + 最近发布时间 + 官方文档链接），**本次未做**——因为方案 B 不是推荐案，做了就是陪跑证据。

---

## 7. 动作 4 · 影响面初判

`git grep -n "greet"` 命中 **10 处**（F13 原文），预计触碰文件清单：

| 文件 | 动作 | 依据 |
| :-- | :-- | :-- |
| `src-tauri/tauri.conf.json` | 改：窗口加 `transparent`/`decorations:false`/`alwaysOnTop`/`skipTaskbar`/`shadow:false`，尺寸改小 | F3/F4/F12 |
| `src-tauri/capabilities/default.json` | 改：补 `core:window:allow-close`、`allow-set-always-on-top`、`allow-start-dragging`（+ 穿透则再加 `allow-set-ignore-cursor-events`） | F8/F9 |
| `src-tauri/src/lib.rs` | 改：删 `greet` 演示命令 | F13 |
| `src/App.tsx` | **整份替换**（脚手架演示页 → 摆件装配） | F13 |
| `src/App.css` | **整份替换**（含 `#greet-input` 规则） | F13 |
| `src/character/HeiCat.tsx` | 新增：SVG 角色 | §2 落点表 |
| `src/character/heicat.css` | 新增：呼吸/眨眼/甩尾 keyframes | §2 落点表 |
| `src/interaction/useCursorFollow.ts` | 新增：光标轮询 + 瞳孔角度 | F2（`cursorPosition`） |
| `src/interaction/useDragExit.ts` | 新增：拖拽 + 右键退出 | F2（`startDragging`/`close`） |
| `docs/registry/COMPONENTS.md` | 改：删被替换的脚手架行、新增角色与交互节 | D13 回写义务 |
| `check.ps1` | 改：`$STEPS` 从 1-2 的零依赖占位换成真实 typecheck/lint/test | `check.ps1` 行内注释自述 |

**registry 受影响行**：
- `docs/registry/COMPONENTS.md:11`（App 行，注有「当前是脚手架演示页，首个功能会整份替换」）与 `:16`（lib.rs 行，注有「当前含脚手架自带的 `greet` 演示命令」）→ 两行本次作废，须替换
- `docs/registry/APIS.md` / `DATA_DICT.md` → **不受影响**（无服务端、无数据库）

---

## 8. 动作 5 · 档位建议

**建议 L**。

依据（按判据表逐条）：
1. **跨模块**：改动同时落在外壳层 `src-tauri/`（Rust 入口 + 窗口配置 + ACL 权限）与界面层 `src/`（React + 角色 + 动画），且把 `ARCHITECTURE.md §1` 的虚线建成实线 = **结构变更**。
2. **超出 S 档单页特例上限**：本项目正好命中「1 个入口页 + 无后端 + 无依赖」特例，其上限是 **≤5 文件且 ≤400 行**；本功能预估 **8~10 文件 / 600~800 行**，是上限的约 2 倍。
3. 未引入新依赖（方案 A）；无表结构；**不构成「新页面体系」**（单窗口、无路由）。
4. **未触碰红线域**：不涉及认证/鉴权、支付/计费、删除真实数据、改表结构；Tauri `invoke` 命令是**同进程 IPC**，不监听端口、不对外暴露，**不构成「新增对外接口」** → 不触发 3-2 威胁建模（该卡已在 STATE.md 裁剪记录中永久跳过）。
5. **诚实标注分歧**：判据表 M 档写「限 1~2 个模块内」，而本项目恰好只有 2 层，**严格读可判 M**。我按卡内「拿不准按高一级提」提交 L——L 会强制 3-1 设计卡，而本项目全部价值集中在「角色矢量造型 + 动效设计」上，正是最需要动手前定方案的一类，跳过的返工代价高于走卡的成本。

**L 档后果**（你裁决时请一并确认）：3-1 设计 + 5-2 发布变为强制；5-2 按 STATE.md 裁剪记录走「本地演示级」（只在本机验证，不推生产）。

**若判 S**，卡要求在本文件末尾写一行：`S 档简版链：2-2（简版）→ 4-1 → 4-3 → 5-1`（**当前不建议 S**，故暂不写）。

---

## 9. 调研合规四查（收尾自检）

```text
① 每个方案都齐了改动面/依赖/风险/工作量四列吗？
   → 齐。方案 A/B/C 四列俱全（§4 表，每案均给出文件数、依赖、风险、行数）。
② 被否案写出具体否决理由了吗（不是陪跑）？
   → 有。方案 C 给出「净增 250~350 行状态机 + 失去可逐节点核对的 DOM 结构 + 改动面无收益」三条具体理由（§4 末）。
   → 另：方案 B 未列为被否案，而是「缓」——它是 A3 假设被证伪后的升级路径，判据写在 §4 风险列。
③ 新增依赖全过了"新依赖三查"吗？
   → 本次新增依赖数为 0，三查按「无新增」逐条给了结论（§6）。
④ 档位建议是按判据表给的吗？
   → 是。§8 逐条对齐判据表，并显式标注了「严格读可判 M」的分歧点。
```

---

## 10. 未决问题（等用户裁决）

| # | 问题 | 我的建议 |
| :-- | :-- | :-- |
| Q1 | **透明区的鼠标行为**：窗口矩形内、猫身之外的透明像素，要不要「鼠标穿透」（能点到它背后的桌面图标）？ | 建议**要穿透**——常驻摆件挡手是第一体验门槛；实现只在 JS 侧加一个轮询 hook，不引入依赖。**代价**：约 +120 行，且依赖 A3 假设（未实测），需在 4-1 首批用一个最小实验先证伪/证实 |
| Q2 | **形象素材从哪来**：仓库里已无任何参考图（F11：`ref/` 与 `src/HeiCat.cs` 都不存在）。你重新给图，还是我按 IDEA 卡的描述（纯黑大色块 + 巨型白眼白 + 黑瞳孔 + 长尾）自行设计矢量？ | 建议**你先给图**——还原度是本项目的核心目标，凭空画出来的「黑猫」未必是罗小黑 |
| Q3 | **窗口尺寸与构图**：建议 260×300 逻辑像素、猫占满宽度、底部留 8px 甩尾余量。 | 建议照此；可缩放档位留到后续 7-1 UI 改动卡 |
| Q4 | **瞳孔跟随的采样范围与频率**：全局跟随（鼠标在屏幕任何位置都跟）还是只在靠近窗口时跟？频率 30Hz 还是 60Hz？ | 建议**全局跟随 + 30Hz**（`cursorPosition()` 每约 33ms 一次）；鼠标离窗口过远时瞳孔回正，兼顾「活着」与省电 |
| Q5 | **壳与退出**：右键菜单只放「退出」，还是加置顶开关/缩放？要不要系统托盘图标？ | 建议**只放「退出」+ 不要托盘**——IDEA 卡已排除开机自启；托盘会引入「关窗不退出」的生命周期复杂度，是 MVP 之外的第一个膨胀点 |
