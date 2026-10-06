# COMPONENTS · 组件注册表（界面 ↔ 代码 的地图）
> 最近核对 —（骨架未核对；核对后填 <日期> @ <提交哈希>）
> 用法：agent 改 UI 前先查这张表定位；改完同批回写（5-1 归档卡会查）。新建文件不登记 = 孤儿（5-1 卡第 ⑧ 查会报）。
> "人话标识"填你指着屏幕会怎么说——这是给人看的定位列。
> 分节规则：每个页面一节，标题写「页面名 路由」（如 `## 统计页 /stats`）；单节 ≤30 行，超了说明该拆组件了。

## 应用外壳 · 单窗口无路由（2026-10-06 · 1-2 卡初始化，全部为脚手架文件）

| 界面元素 | 人话标识 | 程序名 | 文件 | 搜索词 | 影响面 | 最近确认 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 前端挂载点 | "把 React 挂上去的那段" | — | src/main.tsx | `createRoot` | 被 index.html 引用（1 处）；无 | 2026-10-06 |
| 构建配置 | "打包怎么配的" | — | vite.config.ts | `defineConfig` | 开发与打包共用；dev 端口 1420，**必须与 src-tauri/tauri.conf.json 的 devUrl 一致** | 2026-10-06 |
| Vite 类型声明 | "Vite 的类型补丁" | — | src/vite-env.d.ts | `vite/client` | 全局生效、无显式引用（`orphans.ps1` 报其为孤儿，**属预期**：这是 Vite 的 ambient 声明） | 2026-10-06 |
| Rust 入口 | "程序真正启动的地方" | main | src-tauri/src/main.rs | `luoxiaohei_lib::run` | 调 src-tauri/src/lib.rs 的 `run()`（1 处） | 2026-10-06 |
| Rust 逻辑入口 | "窗口与命令都在这" | run | src-tauri/src/lib.rs | `tauri::Builder` | 被 src-tauri/src/main.rs 引用（1 处）；**窗口控制命令加在这里**；**4-1 批次 1 已删掉脚手架的演示命令与 `tauri-plugin-opener` 注册**（`git grep -n` 两词在 `src/`+`src-tauri/` 命中均为 0）；当前 `run()` 只做 `tauri::Builder::default().run(generate_context!())` | 2026-10-06 |
| 编译期构建脚本 | "Tauri 的编译钩子" | main | src-tauri/build.rs | `tauri_build` | 编译期自动执行，无运行时引用 | 2026-10-06 |

<!-- 搜索词 = 下次 3 秒找到你的关键词组合：组件名/文案/路由。改完行不回写 = 卡片过期比没有更毒 -->
<!-- 角色渲染组件已存在（4-1 批次 2）：在「单窗口 main」节登记；本节只留脚手架期仍成立的登记行 -->
<!-- 4-1 每批落地后把下表的「待建 / 待改」去掉，并删掉本节与「应用外壳」节里重复的行（D11：被取代的登记行同批删） -->

## 单窗口 main（无路由）· 首个功能组件（2026-10-06 · 3-1 卡登记，4-1 分批落地：**批次 0/1/2/3/4 已全落**）

> 本节 = 3-1 卡动作 3 的「组件影响」清单落点。**待建**=4-1 新建；**待改**=4-1 改动既有文件；已落的行改成「**批次 N 已建 / 已换**」。
> 设计依据逐条见 `docs/specs/2026-10-06_desktop-pet/DESIGN.md` §4；文件与行的对应以本表为准。

| 界面元素 | 人话标识 | 程序名 | 文件 | 搜索词 | 影响面 | 最近确认 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 角色根 `<svg>`（**批次 2 已建 / 批次 3 接瞳孔 / 批次 4 接两个鼠标事件**） | "猫" | `HeiCat` | src/character/HeiCat.tsx | `viewBox` | 被 src/App.tsx 引用（1 处）；import `./heicat.css` 与 `./geometry.ts`（2 处）；**四个 props**（`gazeDeg` / `gazeTravel`，批次 3 起；`onMouseDown` / `onContextMenu`，批次 4 起；前两个缺省 0 = 静态姿态、后两个缺省 undefined = 不接线）→ 换算成 `--hei-pupil-dx/dy` 挂在 svg 根的 inline style 上；两处 `transform-origin` 也由本文件的 inline style 从 geometry 取值（呼吸=腹部底端、甩尾=尾根，写进 CSS 就是第二份坐标）；TSX 内只有 2 个色彩字面量（都是眼白，M3 冻结断言按字面量数元素）；N/A（无个人数据）；N/A（纯图形、零交互控件；SCOPE §7 只要求"绘制形状可命中"，落成 `.hei-cat{pointer-events:none}` + 每个形状 `visiblePainted`；批次 4 起根 `<svg>` 还挂 `useDragExit` 的两个 handler——事件从画出来的形状冒泡到根，透明区根本没有事件可冒泡（那部分由 OS 级穿透交给桌面）） | 2026-10-06 |
| 角色几何常量（**批次 2 已建 / 批次 3 补瞳孔位移 / 批次 5 按 4-2 的 R-02 改短半径、R-01 改命中形状、S-12 导出换算比**） | "猫各部件的位置数字" | `CAT_GEOMETRY` | src/character/geometry.ts | `characterBounds` | 被 HeiCat.tsx 与 geometry.test.ts 引用（2 处；批次 4 的 hitTest.ts 是第 3 处）；**坐标系 320×360**，`characterBounds()` 输出换算到 CSS px（×0.8125，= 260/320）；导出 `VIEW_BOX` / `DESIGN_TO_CSS` / `CAT_GEOMETRY` / `characterBounds()` / `pupilOffsetFor()` / `PUPIL_TRAVEL_RATIO` + 8 个类型；`tail.outlineD` 由 `tail.pathD` 的同一组控制点在模块加载时算出（单一事实源），`ears[].pathD` 由耳三角形的三个顶点现算（同一条理由）；`pupilOffsetFor(deg, travel)` = M5 的（角度,幅度）→ 设计坐标位移，满偏 = 0.45 × 眼白**短半径 rx**（= 20.25；SCOPE §7 原文，4-2 的 R-02 纠正了读成 ry 的第一版）；`characterBounds()` 返回**形状联合**（椭圆 / 三角形 / 矩形，各含描边外扩 `RIM_HALF`）；N/A；N/A（纯数据 + 纯函数，零副作用） | 2026-10-06 |
| 角色动画表（**批次 2 静态 / 批次 3 三组 @keyframes**） | "呼吸眨眼甩尾的节奏" | — | src/character/heicat.css | `--hei-ink-300` | 被 HeiCat.tsx import（1 处）；**7 个色阶全部住在 `:root`**（DESIGN_TOKENS §6），眼白字面量刻意不写进本文件（同一事实只写一处）；批次 3 追加 `breathe 3200ms` / `blink 4000ms` / `tailSway 2400ms` 三条 + 三组 `@keyframes`，全部关在 `@media (prefers-reduced-motion: no-preference)` 内，`reduce` 分支把三条钉在静态姿态（眼睑 = `scaleY(0)`，**不是** `none`）；`.hei-pupil` 消费 `--hei-pupil-dx/dy`；N/A；N/A（静态样式 + 纯 CSS 动画，`motion.test.ts` 按文本断言） | 2026-10-06 |
| 瞳孔跟随（**批次 3 已建 / 批次 4 补窗口原点与缩放**） | "眼珠跟着鼠标转" | `useCursorFollow` | src/interaction/useCursorFollow.ts | `SAMPLE_HZ` | 被 src/App.tsx 引用（1 处）；**全项目唯一的 60Hz 定时器持有者**（`gaze.test.ts` 的 M5·⑨ 扫生产源码数它）；每 tick 只发 1 次 `cursor_position`，窗口几何走挂载 + move/resize 事件缓存（不逐帧查）；返回 **5 项** `{ gazeDeg, gazeTravel, cursorScreen, windowOrigin, scaleFactor }`——批次 4 的后两项是给穿透层换算视口坐标用的（同一拍同一个原点，穿透层不必再监听一次 move）；导出 `reportIpcFailure(command, error)`（三个 interaction 模块共用的 E-IPC-01 落点）与 `sampleCursor(geometry)`（tick 体，KP-12·① 靠它"跑一拍数一次"）；两条失败分支：取不到坐标 → 回正（E-IPC-02，**现实形态是 `TypeError` 而不是 `null`**，见 `readCursorScreen`）、IPC 拒绝 → `[ipc] E-IPC-01 <命令名>` 落 console 不吞错；四条 `ceiling:` / `upgrade:` 标记；N/A（无个人数据）；N/A（无 DOM 控件） | 2026-10-06 |
| 透明区穿透（**批次 4 已建**） | "点到透明的地方就是点到桌面" | `usePointerPassthrough` | src/interaction/usePointerPassthrough.ts | `setIgnoreCursorEvents` | 被 src/App.tsx 引用（1 处）；import `hitTest.ts` / `geometry.ts` / `useCursorFollow.ts`（3 处）；**零定时器**（KP-12·① 扫源码盯死 `cursorPosition` / `setInterval` / `requestAnimationFrame` 三个词）；判定住在 `createPassthrough(ports)` 端口里，真端口 = `tauriPassthroughPorts()`；**只在 `overCharacter` 翻转时**才 invoke（未翻转的 60 拍一次都不发）；坐标 `null` 或缩放非法 → 保持上一次取值（E-IPC-02 / U1）；两条 `ceiling:` / `upgrade:`；N/A（无个人数据）；N/A（无 DOM 控件，几何取自 `characterBounds()`） | 2026-10-06 |
| 拖拽与退出（**批次 4 已建**） | "拖着走 + 右键退出" | `useDragExit` | src/interaction/useDragExit.ts | `startDragging` | 被 src/App.tsx 引用（1 处，两个 handler 挂到根 `<svg>` 上）；逻辑 = `createDragExit(ports)`、真端口 = `tauriDragExitPorts()`；只认左键；**拖拽在途时再按左键被互斥挡住**（`startDragging()` 的 Promise 在拖拽结束时才 resolve，SCOPE U4）；右键 `preventDefault()` + `Menu.new`（**恰好一项「退出」**，`Menu` 只建一次并复用——每次右键新建会在 Rust 侧留一个没人释放的 rid）；SCOPE S1 位置记忆的唯一改动点（两条 `ceiling:` / `upgrade:` 已留）；N/A（无个人数据）；右键菜单仅一项「退出」；键盘路径 = **Alt+F4**（Windows `WM_CLOSE`，3-4 卡登记，4-3 核） | 2026-10-06 |
| 瞳孔角度纯函数（**批次 3 已建**） | "算眼珠该转多少度" | `gazeAngle` | src/interaction/gaze.ts | `SAMPLE_HZ` | 被 useCursorFollow.ts 与 gaze.test.ts 引用（2 处）；零 import、零副作用（纯函数，TESTPLAN §7 的接缝约定：不替换）；导出 `SAMPLE_HZ`(60) / `NEAR_FULL_PX`(400，满偏半径) / `FAR_RESET_PX`(1500，回正半径) / `gazeAngle(dx,dy)` / `gazeTravel(dx,dy)`；非有限输入与 >1500px 一律回 0（U3 禁 `rotate(NaN)`）；N/A；N/A | 2026-10-06 |
| 命中判定纯函数（**批次 4 已建；批次 5 按 4-2 的 R-01 改形状判定**） | "算鼠标是不是在猫身上" | `screenToViewport` | src/interaction/hitTest.ts | `isOverCharacter` | 被 usePointerPassthrough.ts 与 hitTest.test.ts 引用（2 处）；零 import、零副作用（只 `import type`，纯函数，TESTPLAN §7 的接缝约定：不替换）；`screenToViewport(screen, origin, scaleFactor)` = 物理 px → 视口 CSS px（非法缩放按 1 算，U1）；`isOverCharacter(viewport, bounds)` = **按形状**判定（rect 闭区间 / ellipse ≤1 / triangle 叉积同号，10 个形状的并集；旧版是"8 个粗筛盒"，头含耳一个大矩形的死区占窗口 9.9%），非有限坐标一律 false；N/A；N/A | 2026-10-06 |
| 窗口配置断言（**批次 1 已建**） | "查窗口配对了没" | — | src/tauriConfig.test.ts | `window-config OK` | SCOPE M1/M2/M8 的验收命令载体；读 tauri.conf.json 与 capabilities/default.json（2 处）；**6 个用例**（M1 六键 / 尺寸锁两键 / acl 4 条具名 / 授权总数 ≤5 / 门禁命令形态 / 授权↔调用方）；末条是 `window-config OK 6/6` 的反同义反复行为断言（TESTPLAN KP-03），批次 4 落地四个 interaction 模块后实测已升为 **`acl-callers OK 4/4（未落盘跳过 0 条）`**——四条具名授权逐条找得到调用方，再删任何一处调用即红（NFR S2 禁保留未被调用的授权）；文件顶部有 `/// <reference types="node" />`——**TS 6.0 不再自动纳入 `node_modules/@types/*`**，且 SCOPE §5 禁止改 tsconfig 的 types 白名单；N/A；N/A（测试文件） | 2026-10-06 |
| 几何断言（**批次 2 已建**） | "查造型比例对不对" | — | src/character/geometry.test.ts | `尾弧长` | SCOPE M3 的验收命令载体；**6 用例**（眼白合并宽 / 耳距 / **尾弧长由 `pathD` 采样** / 白色恰 2 处 / 通体主色为黑 / 头身比+占位）；自带贝塞尔采样器且**不 import 生产代码的采样**（防被测物自证）；N/A；N/A（测试文件） | 2026-10-06 |
| 动画断言（**批次 3 已建**） | "查动画节奏对不对" | — | src/character/motion.test.ts | `3.2s` | SCOPE M4 的验收命令载体；**6 用例**（呼吸周期+倍率 / 眨眼单次 100ms+闭合 50ms+reduce 分支静态姿态 / 甩尾周期 / 摆幅 ±8°+枢轴绑尾根 / 三周期两两不同且最小公倍数 48s / 关键帧只动 transform+声明全在 no-preference）；自带小型 CSS 结构解析器（花括号配平 + 选择器取声明），**解析前去掉注释**（注释不是 CSS）；N/A；N/A（测试文件） | 2026-10-06 |
| 跟随断言（**批次 3 已建**） | "查眼珠转得对不对" | — | src/interaction/gaze.test.ts | `SAMPLE_HZ === 60` | SCOPE M5 的验收命令载体；**9 用例**（六个角度判据 / 远距归零含 1500 边界 / 2880 组方向夹取 / 7 组非法输入不产 NaN / SAMPLE_HZ + 间隔落 NFR P3 带 + **扫生产源码断言全项目只有一处定时器**）；末条是 TESTPLAN §1 点名"同义反复高危"那条常量断言的补强行为断言；N/A；N/A（测试文件） | 2026-10-06 |
| 穿透断言（**批次 4 已建**） | "查命中判定对不对" | — | src/interaction/hitTest.test.ts | `scaleFactor` | SCOPE M6 的验收命令载体；**6 用例**（四组 `scaleFactor` 1.0/1.25/1.5/2.0 各一条，含副屏负原点 / 猫身内三点+屏幕↔视口往返 / 窗口内四个透明点不命中 + 反空转对照）；期望值是整数字面量而不是实现式的复制（避免同义反复）；**MUT-7 的靶子**（除法改乘法 → M6·②③④⑤ 红）；N/A；N/A（测试文件） | 2026-10-06 |
| 拖拽退出断言（**批次 4 已建**） | "查拖拽和右键发出的是哪条命令" | — | src/interaction/dragExit.test.ts | `mockIPC` | SCOPE M7 的验收命令载体 + TESTPLAN KP-12/13/14；**6 用例**（左键 start_dragging 含在途互斥 / 右键菜单恰好一项、点它 → close、菜单复用 / 单 tick 单次采样 + 穿透层零采样扫源码 / 未翻转不 invoke / E-IPC-02 回正 / E-IPC-01 落 console 且不重试）；顶部 `window` 垫片 + Tauri 模块**动态 import**（静态 import 会先于垫片求值）；等待是"轮询 + 超时"，无固定 sleep；N/A；N/A（测试文件） | 2026-10-06 |
| 窗口本体（**批次 0 已落**） | "那只猫所在的框" | — | src-tauri/tauri.conf.json | `alwaysOnTop` | **8 键已落**（260×300 / `transparent:true` / `decorations:false` / `alwaysOnTop:true` / `skipTaskbar:true` / `shadow:false` / `resizable:false` / `maximizable:false`；`minimizable` 保持默认 `true`）；被 src/tauriConfig.test.ts 读（1 处，批次 1 建） | 2026-10-06 |
| 权限清单（**批次 1 已落终值**） | "它被允许干什么" | — | src-tauri/capabilities/default.json | `allow-set-ignore-cursor-events` | **5 条终值**（`core:default` + `core:window:allow-close` + `core:window:allow-start-dragging` + `core:window:allow-set-ignore-cursor-events` + `core:menu:default`），`opener:default` 已删；NFR S2 上限 ≤5 正好用满；断言落在 `src/tauriConfig.test.ts` 的 `acl OK 4/4`（4 = 除 `core:default` 外的**具名**授权数）；APIS.md 的 I1~I3、I7 全依赖它 | 2026-10-06 |
| Rust 逻辑入口（**批次 1 已退**） | "窗口与命令都在这" | `run` | src-tauri/src/lib.rs | `tauri::Builder` | 已删演示命令与其注册（3 处）与 `tauri_plugin_opener` 注册（1 处）；`git grep -n` 两词在 `src/`+`src-tauri/` 命中 **0 / 0**；窗口构建不动 | 2026-10-06 |
| 应用根组件（**批次 4 已接全部三个 hook**） | "整个界面" | `App` | src/App.tsx | `HeiCat` | 被 src/main.tsx 引用（1 处）；批次 1 整份替换脚手架演示页、批次 2 接上 `<HeiCat/>`（**窗口里第一次有东西**）、批次 3 接上 `useCursorFollow(true)`、批次 4 接上 `usePointerPassthrough(cursorScreen, windowOrigin, scaleFactor)` 与 `useDragExit()` 并把两个 handler 传给角色；**同一次采样喂两个消费者**（瞳孔 + 穿透），所以穿透层不需要自己采样；N/A（无个人数据）；两个鼠标事件挂在根 `<svg>` 上 | 2026-10-06 |
| 全局样式（**批次 1 已换**） | "窗口的底色与定位" | — | src/App.css | `background` | 已整份替换：111 行 → 22 行，只留 `html/body` 透明 + 100% + `overflow:hidden` + 零边距，加 `#root` 撑满；脚手架样式（含 `#greet-input`）全删；**不写任何角色色值**（取值归 `docs/DESIGN_TOKENS.md`） | 2026-10-06 |
| 收工门禁（**批次 1 已接**） | "查完成没完成的那条命令" | `$STEPS` | check.ps1 | `npm run typecheck` | `$STEPS` 已从 2 条占位换 4 条真实命令（typecheck / test / git status / security，顺序即 SCOPE §5 M8 的验收输出顺序）；结构断言段不动；`test` 用 **glob** 形态（给目录会假红，见 `docs/lessons/2026-10-06_node-test传目录假红.md`） | 2026-10-06 |

<!-- 4-1 每批落地后把上表的「待建 / 待改」去掉，并删掉本节与「应用外壳」节里重复的行（D11：被取代的登记行同批删） -->

## 工具脚本与生成物 · 非界面（2026-10-06 · 2-4 卡新增）

| 界面元素 | 人话标识 | 程序名 | 文件 | 搜索词 | 影响面 | 最近确认 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 非功能阈值检查器（非界面） | "查六维指标的那个脚本" | `-Check` | scripts/nfr.ps1 | `IdleCpuPercent` | 手工调用（六维各一条命令，退出码 0/1/2 三态）；`-Check maintainability` 内部调 `check.ps1`（1 处）；N/A（无个人数据）；N/A（命令行，无交互控件） | 2026-10-06 |
| Rust 依赖锁定（**生成物**） | "Rust 依赖的锁定清单" | — | src-tauri/Cargo.lock | `name = "tauri"` | 首次 `npm run tauri build -- --no-bundle` 生成（锁定 458 个 crate 的版本）；**不是新增依赖**；N/A（无个人数据）；N/A | 2026-10-06 |

<!-- 生成物为什么也登记：DOC_MAP.json 的 new-file 判据按路径机械判定，生成物一样会命中；不登记 = 门禁判红（2-4 卡实测） -->
<!-- 2026-10-06 2-4 卡：src-tauri/Cargo.lock 以独立提交入库（chore(deps)）。它 4897 行，属**生成物**，不受 500 行手写上限约束；gate.ps1 对生成物无豁免通道，故该批次门禁仍红 —— 缺口登记在 docs/TECH_DEBT.md TD-001 -->

## 「影响面 / 非功能标注」两列怎么写（4-1 卡每批登记时填；7-1 卡改 UI 时复核）

| 要标什么 | 什么时候填 | 谁填 | 写法（照着抄） |
| :-- | :-- | :-- | :-- |
| 影响面（谁被牵连） | 新建或改动同一批、提交前 | 4-1 卡（改 UI 由 7-1 卡） | 列引用它的页面/接口与处数，如「首页也引用（4 处）」；没有别的引用写「无」 |
| 性能 | 组件会发请求、渲染长列表、跑定时任务时 | 填表的人 | 写可测数字，如「首屏 ≤1.5s；列表 500 行分页」；无关写 `N/A（纯静态展示）` |
| 安全与隐私 | 显示、提交、外发个人数据时 | 填表的人（涉及 D3/D4 字段先问 7-5 卡口径） | 写处置，如「手机号只显示后 4 位；不进日志」；无关写 `N/A（无个人数据）` |
| 可访问性 | 有交互控件（按钮、表单、弹窗、图表）时 | 填表的人 | 写验证方式，如「Tab 走查：全部控件可达且焦点可见」；无关写 `N/A（纯文本）` |

- 四列宁可写 `N/A（理由）`，不许留空——留空 = 没人知道这行还准不准；「最近确认」填最近一次改这行或复核这行的日期。
- 登记与清理：新增文件当批登记本表；文件删了同批删行；删不掉的登记根 STATE.md 并行态登记簿。
