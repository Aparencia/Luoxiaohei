# RESEARCH · 罗小黑桌面摆件 MVP（首个功能）

> 产物寿命：**持久（进仓库）** ｜ 卡：**2-6 外部方案调研 → 2-1 功能调研**（2-6 为补跑，见「外部方案」节触发补记）｜ 母版：roadbook v0.9.0 / 规则版本 2026-10-05.2
> 时间戳：开始 2026-10-06 ｜ 状态：**调研完成，已裁决**（2026-10-06 用户回「采纳建议」；本文件保留当时的建议与证据，**终值以 `SCOPE.md` §10 与 `DESIGN.md` §3 为准**）
> 上游：`docs/pool/IDEAS.md:5`（approved）→ `docs/decisions/IDEA_2026-10-06_罗小黑桌面宠物.md` → `docs/decisions/STACK_2026-10-06_桌面摆件技术栈.md`

---

## 0. 裁决状态

| 项 | 建议 | 用户裁决 |
| :-- | :-- | :-- |
| 方案 | **方案 A**（SVG + CSS 动画 + Tauri 核心窗口 API） | **已采纳** |
| 档位 | **L** | **已采纳**（→ L 档；连带 3-1 设计卡与 5-2 发布卡强制，5-2 按 STATE 裁剪记录走"本地演示级"） |
| 2-6 判定三值 | **自研** | **已采纳** |

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
| `docs/registry/DATA_DICT.md` | **只有 1 节示例节**（`bills`，行内自注「示例表：换成真实表后删掉本节」）。本项目无数据库 → 无表可复用、**无表结构变更** |

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
| F10 | ~~**`src-tauri/Cargo.lock` 不存在** → Rust 依赖从未编译过，首次 `tauri dev/build` 要现拉并编译全部 crate~~ **【已失效：2-4 卡首次构建后该文件已生成，2026-10-06 实测 4897 行；`gate.ps1` 判据 ⑥ 的 500 行上限会因此判红 → TD-001】** | `Test-Path` 实测（当时）返回 False |
| F11 | **仓库里没有任何罗小黑形象素材**：`ref/` 目录不存在、IDEA 卡引用的半成品 `src/HeiCat.cs` 也已不存在 | `Test-Path` 实测均为 False |
| F12 | 当前窗口是脚手架默认值：800×600、有边框、不透明、不置顶 | `src-tauri/tauri.conf.json:15-17` |
| F13 | `git grep -n "greet"` 命中 10 处（`src-tauri/src/lib.rs` 3 + `src/App.tsx` 6 + `src/App.css` 1 + `docs/registry/COMPONENTS.md` 1） | `git grep` 原文 |

> **F4 与 F9 是本次最有价值的两条**：前者是一个不改就会在成品上看得见的白边，后者是一组不补就会「代码写对了但运行时静默被拒」的权限。

---

## 外部方案

> 2-6 卡产物 · 轮子先行五查

> 检索日期：**2026-10-06** ｜ 档位声明：本次按 **L 档** → ② 活不活**三项齐全**（不取 S 档两项下限）
> **触发补记**：2-1 卡第 2 行触发行原文「首次自研某能力 / 想引入现成轮子 → 先过 2-6 外部方案调研」。本次 2-1 首轮**漏跑本卡**，由用户在收尾后点出，遂补跑；结论并入 §5 方案对比。

### ① 有没有

**检索关键词原文（3 个）**：`desktop pet tauri` ｜ `transparent always on top window tauri` ｜ `desktop mascot overlay`
**逐关键词 × 逐来源各搜一次**（9 次，全部实跑）：

| 关键词原文 | GitHub（repos 搜索） | npm（registry 搜索） | crates.io |
| :-- | :-- | :-- | :-- |
| `desktop pet tauri` | total=222 | total=63708（`dsh-whale-pet-plugin`、`desktop-pet-app`、`cc-pets`、`clauddy` 等，**全部是不同形态**：DSH 插件 / AI 用量看板 / macOS 专用） | 见下行关键词结果 |
| `transparent always on top window tauri` | total=12 | total=63586（头部全是 Tauri 官方包，无窗口层轮子） | `adabraka-gpui`、`fc-gpui`、`procmod-overlay`、`talk-rs`、`opencrabs`、`fnp-io`——**无一为桌宠窗口层** |
| `desktop mascot overlay` | total=17 | ——（与上一行 npm 查询同批覆盖） | `sugarrush` v2026.8.3（**唯一命中**，非本项目形态） |

**候选 3 个**：

1. **[ayangweb/BongoCat](https://github.com/ayangweb/BongoCat)**（Apache-2.0，23,808 star）——跨平台交互式桌宠**完整应用**；Rust workspace 共 20 个 crate，overlay 走原生 DirectComposition/Metal + Live2D。
2. **[tauri-plugin-sprite-pet](https://crates.io/crates/tauri-plugin-sprite-pet)**（MIT）——Tauri v2 **插件**：序列帧贴图桌宠运行时（动画 / 拖拽 / 点击 / mood-stats）。仓库 <https://github.com/Yoak3n/tauri-plugin-sprite-pet>
3. **[tauri-plugin-frameless-window](https://github.com/insd47/tauri-plugin-frameless-window)**（MIT）——Tauri v2 无边框窗口 + overlay 标题栏 + modal sheet。

**结论**：三个关键词均有命中，**但没有任何一个是「可只替换窗口层」的库**——候选 1 是完整应用，候选 2 换了角色载体模型，候选 3 解决的是标题栏而非透明摆件。→ ① 有候选，能否用交给 ④⑤。

### ② 活不活（M/L 档三项齐全）

| 候选 | 最后提交 | 最近发版 | 是否 archived / deprecated |
| :-- | :-- | :-- | :-- |
| BongoCat | **2026-10-06**（[commits](https://github.com/ayangweb/BongoCat/commits/master)） | **v2.1.1 @ 2026-10-03**（[releases](https://github.com/ayangweb/BongoCat/releases)） | 未 archived（GitHub API `archived=false`） |
| tauri-plugin-sprite-pet | **2026-05-20**（[commits](https://github.com/Yoak3n/tauri-plugin-sprite-pet/commits)） | **v0.3.3 @ 2026-05-20**（6 个版本**全部**在 2026-05-20 当天发出） | 未 archived；但 crates.io 数据：**0 star / 0 fork / 总下载 254 / 近 90 天仅 34 次**，仓库 2026-05-18 建、2 天内发完即停 |
| tauri-plugin-frameless-window | 2026-09-02 | **无任何 release**（`releases` 返回空） | 未 archived；**0 star / 0 fork** |

**结论**：候选 1 高度活跃；候选 2 **技术存活但事实休眠约 4.5 个月且零社区**；候选 3 近期有提交但零 release、零社区。

### ③ 能不能用（LICENSE 原文，非 README 转述）

| 候选 | LICENSE 原文 | 是否要求开源 | 是否可商用 |
| :-- | :-- | :-- | :-- |
| BongoCat | **Apache-2.0**（[LICENSE](https://github.com/ayangweb/BongoCat/blob/master/LICENSE)，path=`LICENSE`，10,963 B） | 否 | 是（需保留 NOTICE） |
| tauri-plugin-sprite-pet | **MIT**（path=`LICENSE`，1,062 B） | 否 | 是 |
| tauri-plugin-frameless-window | **MIT**（path=`LICENSE`，1,063 B） | 否 | 是 |

**一并记下被许可证直接排除的候选**（按卡内禁令，接入前即停）：`xiaochengzina/Driftlet` = **GPL-3.0**；`ryannli/tiny-roommate`、`siegerts/tama96`、`dnecra/floating-lyrics`、`yuzhiyang1/floatnote` = **无 LICENSE**。

**结论**：三个主候选许可证均放行，无 GPL/AGPL/SSPL 障碍。

### ④ 合不合（依赖树条数 / 体积 / 与现有栈冲突 / 是否需常驻服务）

| 候选 | 依赖树 | 体积 | 与现有栈冲突 | 常驻服务 |
| :-- | :-- | :-- | :-- | :-- |
| tauri-plugin-sprite-pet | **直接依赖 17 条**：`async-trait` `chrono` `crc32fast` `dirs` `image` `rand` **`reqwest`** **`tokio`** `schemars` `serde` `serde_json` `thiserror` `tracing` **`urlencoding`** `tauri` `tauri-plugin`(build) | crate **93,317 B ≈ 91.1 KB**（crates.io 版本元数据） | **是**——`reqwest`+`urlencoding` 服务的默认工作流是**从远程宠物商店 `codex-pets.net` 下载贴图**（README L441-452），与 IDEA 卡「明确排除：任何联网」直接冲突；且自带 mood/stats（养成系统）同样被排除 | 否 |
| BongoCat | —（**不是包，无法接入**：完整应用，`cargo add` 不适用；`publish = false`） | 仓库 20,886 KB | 其 Windows overlay 走 `windows = 0.62.2` 的 DirectComposition/D3D11 + `raw-window-handle`，**与 Tauri WebView 栈不同源**，代码不可直接搬 | 否 |
| tauri-plugin-frameless-window | —（功能语义不匹配：解决标题栏与 modal sheet） | 103 KB | — | 否 |

**结论**：**④ 不过**——唯一形似的库（候选 2）依赖树与「不联网」约束直接冲突、且角色载体模型不匹配；候选 1 不可接入；候选 3 功能不对题。

### ⑤ 值不值（两列并列）

- **自研**：估 **600~800 行**（⚠️ 估算：依据 = §5 方案 A 文件清单逐文件估行；不含美术资源）
- **接入候选 2**：估改 **6~9 个文件 + 1 个 Rust 依赖 + 1 个 npm 包**，且**必须先产出一整套序列帧贴图美术资源**——本项目当前美术资源为 **0**（F11），等于把工作量从「写矢量代码」换成「画贴图」，同时接受 17 条依赖与联网语义

**结论**：**自研**。

### 判定三值 → **自研**

逐条映射「五查里哪一条不过」：

1. **④ 不过（决定性）**：唯一形似的库 17 条直接依赖含 `reqwest`/`tokio`，默认工作流是远程商店下载贴图 → 与「任何联网」排除项冲突；且它是 sprite sheet 运行时，与已定的 **SVG 矢量 + CSS 动画**载体不匹配。
2. **① 有候选但无可替换窗口层的库**：三个关键词的候选全部是「完整应用」或「解决别的问题的插件」。
3. **② 候选 2 事实休眠**：三项虽齐全，但 0 star / 0 fork / 254 总下载 / 近 90 天 34 次 / 建库 2 天内发完 6 版后停更约 4.5 个月。
4. **③ 通过**：MIT / Apache-2.0，无开源义务。

### 抄思路自研的部分（许可证允许；**不是代码**）

- **来源**：`ayangweb/BongoCat` 的 `docs/adr/0003-native-overlay-renderers.md`（Apache-2.0）
- **抄了什么**：该 ADR 的 Context 逐字列出桌面宠物模型窗口的硬需求——「模型窗口需要**透明、置顶、穿透、低延迟、高 DPI/Retina 和可控 GPU 生命周期**」；Verification 段给出验收动作——「device lost/swapchain recovery、**100 次真实窗口创建/销毁**」。
- **落点**：`docs/specs/2026-10-06_desktop-pet/NFR.md`（2-4 卡）+ 4-3 行为验收清单。
- **未复制任何代码**，未进入依赖树。

### 关键边界（防止把本节的结论读反）

BongoCat 当前版本（v2.1.1）**整个 workspace 里没有任何 `tauri`/`wry`/`tao` 依赖**（根 `Cargo.toml` 对这三个词 grep **零命中**），Windows overlay 走原生 DirectComposition/D3D11。
**但这不构成「Tauri 做不了透明置顶桌宠」的证据**——ADR-0003 的 Context 原文给出的理由是「**GPUI 没有为双平台 Live2D 外部纹理提供稳定的公共合成接口**」，即它的原生化是被 **Live2D + 自绘 GPU 合成**逼出来的；本项目用 SVG + CSS，不需要外部纹理合成。
**正确读法**：BongoCat 证明的是「需要 Live2D/GPU 合成时得走原生」，不是「透明置顶 WebView 窗口不可行」。

**反向佐证（真实世界 Tauri 桌宠的窗口配置样本）**：`ChanceYu/CoPet`（MIT，35 star）的 `src-tauri/tauri.conf.json` 实测为
`transparent=true  decorations=false  skipTaskbar=true  width=164  height=189  resizable=false`
——**透明 + 无边框 + 小窗 + 隐藏任务栏图标，与 §5 方案 A 的配置完全同路**。
另记一条：它**未显式设置 `shadow`**（= 走默认 `true`），按 §3 F4 的 schema 原文，这会在无边框窗口上产生 1px 白边——**F4 不是理论担忧，是真实项目可能踩到的点**。

### 留痕（拒绝台账；被否的候选一个不许丢）

| 日期 | 提案 | 否决理由 | 既往请求编号 |
| :-- | :-- | :-- | :-- |
| 2026-10-06 | [tauri-plugin-sprite-pet](https://crates.io/crates/tauri-plugin-sprite-pet)（MIT） | ④ 不过：17 条直接依赖含 `reqwest`/`tokio`/`image`，默认工作流从远程商店 `codex-pets.net` 下载贴图，与「任何联网」排除项冲突；sprite sheet 载体与 SVG 矢量不匹配；0 star / 254 总下载 / 建库 2 天内发完 6 版后停更约 4.5 个月 | #2-6 |
| 2026-10-06 | [insd47/tauri-plugin-frameless-window](https://github.com/insd47/tauri-plugin-frameless-window)（MIT） | 功能不对题：解决「无边框 + overlay 标题栏 + modal sheet」，本项目不要标题栏；0 star、**无任何 release** | #2-6 |
| 2026-10-06 | [xiaochengzina/Driftlet](https://github.com/xiaochengzina/Driftlet) | **GPL-3.0**：按卡内禁令，GPL 会把本项目代码拽进开源义务；用户未授权 GPL | #2-6 |
| 2026-10-06 | [ryannli/tiny-roommate](https://github.com/ryannli/tiny-roommate)、[siegerts/tama96](https://github.com/siegerts/tama96)、[dnecra/floating-lyrics](https://github.com/dnecra/floating-lyrics)、[yuzhiyang1/floatnote](https://github.com/yuzhiyang1/floatnote) | **无 LICENSE**：按卡内禁令「无 LICENSE → 停下问人」，接入前即排除 | #2-6 |
| 2026-10-06 | [ayangweb/BongoCat](https://github.com/ayangweb/BongoCat)（Apache-2.0） | **不是库而是完整应用**，无法作为依赖接入（`publish = false`）；改为「抄思路自研」（见上） | #2-6 |
| 2026-10-06 | [pixi-live2d-display](https://www.npmjs.com/package/pixi-live2d-display) | 最后一次发布 **2022-09-04**（停更约 4 年）；且 Live2D 与 SVG 载体不匹配 | #2-6 |

### 来源纪律与 UNVERIFIED

- 检索日期：**2026-10-06**；所有数字均来自官方来源（GitHub API / crates.io API / npm registry API / LICENSE 原文），**star 数只作线索**。
- **UNVERIFIED**：① `DonkeyKing01/BriefyPet`（46 star，MIT）的窗口配置**未取到**——其默认分支树中未匹配到 `tauri.conf.json`，取文件内容时 API 返回空数组导致索引失败；② `CaYatur/CaYa-Desktop-Pet` 拉取被 GitHub 限流（HTTP 403）。两者均为次要候选，**不影响判定**。
- **未查到公开数据**：无（三个关键词在三个来源均有返回）。

---

## 5. 动作 2 · 方案对比（2 个完整方案 + 1 个被否案）

> 上节「外部方案」结论并入：**无可接入的窗口层轮子 → 自研**；方案 A 获得一条真实世界同路佐证（`ChanceYu/CoPet` 的窗口配置）；BongoCat 的原生路线**不构成升到方案 B 的理由**（其原生化由 Live2D 外部纹理合成逼出，见「外部方案」节关键边界）。

| | 方案 A（**推荐**） | 方案 B | 方案 C（**被否**） |
| :-- | :-- | :-- | :-- |
| **一句话** | Tauri 核心窗口 API + React/SVG 角色 + CSS keyframes 动画 + JS 侧 `cursorPosition()` 轮询 | Rust 侧用 `windows` crate 做原生窗口扩展（自绘 + 原生光标追踪 + 精确命中测试） | Canvas 2D 逐帧绘制角色 + 自建 `requestAnimationFrame` 动画状态机 |
| **改动面** | **8~10 文件**：`src-tauri/tauri.conf.json`、`src-tauri/capabilities/default.json`、`src-tauri/src/lib.rs`（删 greet）、`src/App.tsx`（整份替换）、`src/App.css`（整份替换）、新增 `src/character/HeiCat.tsx`、`src/character/heicat.css`、`src/interaction/useCursorFollow.ts`、`src/interaction/useDragExit.ts` | **12~15 文件**：A 的全部 + 新增两个 Rust 模块（原生窗口扩展 / 命令层）+ `src-tauri/Cargo.toml` 加依赖 | 同 A 的文件数，但角色由 Canvas 逐帧绘制（多一个动画循环模块，少一个 CSS 动画文件） |
| **新依赖** | **0**（F2 已证全部 API 在包内） | **`windows` crate**（须过新依赖三查） | **0** |
| **风险** | 中低：① Tauri #15947 透明合成竞态 ② F4 白边 ③ F9 权限漏配静默失败 ④ 若选「透明区穿透」，A3 假设未实测 | 高：`unsafe` FFI、与 Tauri 窗口生命周期耦合、上游 API 跨版本变动、编译时间显著变长 | 中：动作保真度可控，但净增状态机代码 |
| **工作量** | **约 600~800 行** | 约 1200~1600 行 | 约 850~1150 行 |
| **结论** | **采纳**：零新依赖、零 `unsafe`、全部能力已被 F2 证实可用、且与真实世界 Tauri 桌宠配置同路（见「外部方案」节） | 缓：仅当「透明区穿透」实测在 JS 侧不可行（A3 证伪）时才升级到本方案；**「外部方案」节已排除「因为 BongoCat 走原生所以我们也该走」这条理由** | 否：见下 |

**方案 C 否决理由（具体，非陪跑）**：SVG + CSS 已能用声明式 `@keyframes` 表达本卡需要的全部三组动作——呼吸 = 躯干 `scaleY` 往复、眨眼 = 眼睑 path 的 `scaleY` 快速往返（80ms）、甩尾 = 以尾根为 `transform-origin` 的 `rotate` 往复。改用 Canvas 2D 就必须自建**时间轴 + 插值 + 暂停/恢复**三套状态机，**净增约 250~350 行**，同时失去 devtools 里可逐节点检视的 DOM 结构——本项目是**纯手写矢量**（F11：仓库无任何形象素材），「能逐节点核对造型」是可维护性的关键，Canvas 把这唯一优势换掉了，**改动面无任何收益**。

---

## 6. 动作 2.5 · 拒绝台账

| 日期 | 提案 | 否决理由 | 既往请求编号 |
| :-- | :-- | :-- | :-- |
| 2026-10-06 | **Electron + TypeScript** 作为实现载体 | 四维打分 17 < Tauri 20：部署难度 3（要打包 Chromium 运行时）、现有知识 4；原文见 `docs/decisions/STACK_2026-10-06_桌面摆件技术栈.md` | STACK 卡「被否方案」(#1-2) |
| 2026-10-06 | **C# / .NET Framework + WinForms** 作为实现载体 | 四维打分 15：现有知识 1、AI 生态 4；原文同上 | STACK 卡「被否方案」(#1-2) |
| 2026-10-06 | **Canvas 2D 逐帧渲染角色** | 见 §5 方案 C 否决理由 | 本卡 (#2-1) |

> 「外部方案」节「留痕」另记 **6 行轮子候选的拒绝台账**（2-6 卡产物），两处合起来是本项目完整的被否案清单。
> 优先查了台账：前两行是 1-2 卡的既有否决记录，本轮沿用，未重新论证。

---

## 7. 动作 3 · 新依赖三查

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

**若最终选方案 B**：需补 `windows` crate 的三查（包页面 + 最近发布时间 + 官方文档链接），**本次未做**——方案 B 不是推荐案。

---

## 8. 动作 4 · 影响面初判

`git grep -n "greet"` 命中 **10 处**（F13 原文），预计触碰文件清单：

| 文件 | 动作 | 依据 |
| :-- | :-- | :-- |
| `src-tauri/tauri.conf.json` | 改：窗口加 `transparent`/`decorations:false`/`alwaysOnTop`/`skipTaskbar`/`shadow:false`，尺寸改小 | F3/F4/F12 |
| `src-tauri/capabilities/default.json` | 改：**初判**补 `core:window:allow-close`、`allow-set-always-on-top`、`allow-start-dragging`（+ 穿透则再加 `allow-set-ignore-cursor-events`）→ **【终案 `DESIGN.md` §3.2：5 条 = `core:default` + `allow-close` + `allow-start-dragging` + `allow-set-ignore-cursor-events` + `core:menu:default`；`allow-set-always-on-top` / `allow-set-skip-taskbar` **不加**——`alwaysOnTop` / `skipTaskbar` 由 `tauri.conf.json` 静态满足，NFR S2 禁保留未被调用的授权；`core:menu:default` 是本初判**漏掉**的一条（原生右键菜单）】** | F8/F9 + `DESIGN.md` §3.2 |
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

## 9. 动作 5 · 档位建议

**建议 L**。

依据（按判据表逐条）：
1. **跨模块**：改动同时落在外壳层 `src-tauri/`（Rust 入口 + 窗口配置 + ACL 权限）与界面层 `src/`（React + 角色 + 动画），且把 `ARCHITECTURE.md §1` 的虚线建成实线 = **结构变更**。
2. **超出 S 档单页特例上限**：本项目正好命中「1 个入口页 + 无后端 + 无依赖」特例，其上限是 **≤5 文件且 ≤400 行**；本功能预估 **8~10 文件 / 600~800 行**，是上限的约 2 倍。
3. 未引入新依赖（方案 A）；无表结构；**不构成「新页面体系」**（单窗口、无路由）。
4. **未触碰红线域**：不涉及认证/鉴权、支付/计费、删除真实数据、改表结构；Tauri `invoke` 命令是**同进程 IPC**，不监听端口、不对外暴露，**不构成「新增对外接口」** → 不触发 3-2 威胁建模（该卡已在 STATE.md 裁剪记录中永久跳过）。
5. **诚实标注分歧**：判据表 M 档写「限 1~2 个模块内」，而本项目恰好只有 2 层，**严格读可判 M**。我按卡内「拿不准按高一级提」提交 L——L 会强制 3-1 设计卡，而本项目全部价值集中在「角色矢量造型 + 动效设计」上，正是最需要动手前定方案的一类。

**L 档后果**（你裁决时请一并确认）：3-1 设计 + 5-2 发布变为强制；5-2 按 STATE.md 裁剪记录走「本地演示级」。
**注**：「外部方案」节判定为「自研」而非「接入现成」，故**不因 2-6 而额外升档**（若判定为接入，则按卡内规则另计「引入新依赖」）。

**若判 S**，卡要求在本文件末尾写一行：`S 档简版链：2-2（简版）→ 4-1 → 4-3 → 5-1`（**当前不建议 S**，故暂不写）。

---

## 10. 调研合规四查（收尾自检）

```text
① 每个方案都齐了改动面/依赖/风险/工作量四列吗？
   → 齐。方案 A/B/C 四列俱全（§5 表）。
② 被否案写出具体否决理由了吗（不是陪跑）？
   → 有。方案 C 给出「净增 250~350 行状态机 + 失去可逐节点核对的 DOM 结构 + 改动面无收益」三条具体理由（§5 末）。
   → 另：方案 B 未列为被否案，而是「缓」——它是 A3 假设被证伪后的升级路径。
③ 新增依赖全过了"新依赖三查"吗？
   → 本次新增依赖数为 0，三查按「无新增」逐条给了结论（§7）。
④ 档位建议是按判据表给的吗？
   → 是。§9 逐条对齐判据表，并显式标注了「严格读可判 M」的分歧点。
```

**2-6 五查自检**：① 三个关键词原文 + 候选链接齐 ✓ ｜ ② M/L 档三项齐全（最后提交/最近发版/是否 archived）✓ ｜ ③ LICENSE 原文逐个打开、两项义务逐个写 ✓ ｜ ④ 依赖树 17 条 / 91.1 KB / 冲突是 / 无常驻服务 ✓ ｜ ⑤ 两列估数 + 一句话结论 ✓ ｜ 判定三值落「自研」并逐条映射 ✓ ｜ 拒绝台账 6 行 ✓ ｜ 检索日期与 UNVERIFIED 已写 ✓

---

## 11. 未决问题（等用户裁决）

> **【2026-10-06 收口】Q1~Q6 全部已裁决**（用户回「采纳建议」）。下表保留**当时的建议原文**以便追溯，**终值以 `SCOPE.md` §10 与 `DESIGN.md` §3 为准**；与终值不一致的两条已就地标注（Q4）。

| # | 问题 | 我的建议 |
| :-- | :-- | :-- |
| Q1 | **透明区的鼠标行为**：窗口矩形内、猫身之外的透明像素，要不要「鼠标穿透」（能点到它背后的桌面图标）？ | 建议**要穿透**——常驻摆件挡手是第一体验门槛；实现只在 JS 侧加一个轮询 hook。**代价**：约 +120 行，且依赖 A3 假设（未实测），须在 4-1 首批用最小实验先证伪/证实 |
| Q2 | **形象素材从哪来**：仓库里已无任何参考图（F11）。你重新给图，还是我按 IDEA 卡描述（纯黑大色块 + 巨型白眼白 + 黑瞳孔 + 长尾）自行设计矢量？ | 建议**你先给图**——还原度是本项目的核心目标。**【终案：用户 Q2 裁决改用网络检索公共设定，SCOPE §8 K1~K5 为准；未下载、未入库任何官方图片】** |
| Q3 | **窗口尺寸与构图**：建议 260×300 逻辑像素、猫占满宽度、底部留 8px 甩尾余量。（真实世界样本 `CoPet` 用的是 164×189，可作对照） | 建议照此；可缩放档位留到后续 7-1 卡。**【终案：尺寸采用；SVG 设计坐标系 320×360、`VIEW_BOX = '0 0 320 360'`（`DESIGN.md` §3.5）】** |
| Q4 | **瞳孔跟随的采样范围与频率**：全局跟随还是只在靠近窗口时跟？30Hz 还是 60Hz？ | 建议**全局跟随 + 30Hz**；鼠标离窗口过远时瞳孔回正。**【终案 2026-10-06：全局跟随 + **60Hz**——`SAMPLE_HZ = 60`（`DESIGN.md` §3.5），离窗口中心 > `FAR_RESET_PX` 1500 时瞳孔回正。**30Hz 的建议作废**，依据用户 Q4 裁决】** |
| Q5 | **壳与退出**：右键菜单只放「退出」，还是加置顶开关/缩放？要不要系统托盘图标？ | 建议**只放「退出」+ 不要托盘**——托盘会引入「关窗不退出」的生命周期复杂度 |
| Q6 | **2-6 判定三值**：本轮落「**自研**」（④ 不过：依赖与联网约束冲突 + 载体模型不匹配） | 建议采纳；若你认为应改为「抄思路自研」的正式记录，我可把「外部方案」节的「抄思路」一段升为正式判定 |
