# COMPONENTS · 组件注册表（界面 ↔ 代码 的地图）
> 最近核对 —（骨架未核对；核对后填 <日期> @ <提交哈希>）
> 用法：agent 改 UI 前先查这张表定位；改完同批回写（5-1 归档卡会查）。新建文件不登记 = 孤儿（5-1 卡第 ⑧ 查会报）。
> "人话标识"填你指着屏幕会怎么说——这是给人看的定位列。
> 分节规则：每个页面一节，标题写「页面名 路由」（如 `## 统计页 /stats`）；单节 ≤30 行，超了说明该拆组件了。

## 应用外壳 · 单窗口无路由（2026-10-06 · 1-2 卡初始化，全部为脚手架文件）

| 界面元素 | 人话标识 | 程序名 | 文件 | 搜索词 | 影响面 | 最近确认 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 应用根组件 | "整个界面" | App | src/App.tsx | `App` | 被 src/main.tsx 引用（1 处）；**4-1 批次 1 已整份替换脚手架演示页**，现为"装配点空着"形态（渲染 `null`），后续批次只做加法：批次 2 接 `<HeiCat/>`、批次 3 接 `useCursorFollow`、批次 4 接 `usePointerPassthrough` / `useDragExit`；N/A（无个人数据）；N/A（暂无交互控件） | 2026-10-06 |
| 前端挂载点 | "把 React 挂上去的那段" | — | src/main.tsx | `createRoot` | 被 index.html 引用（1 处）；无 | 2026-10-06 |
| 构建配置 | "打包怎么配的" | — | vite.config.ts | `defineConfig` | 开发与打包共用；dev 端口 1420，**必须与 src-tauri/tauri.conf.json 的 devUrl 一致** | 2026-10-06 |
| Vite 类型声明 | "Vite 的类型补丁" | — | src/vite-env.d.ts | `vite/client` | 全局生效、无显式引用（`orphans.ps1` 报其为孤儿，**属预期**：这是 Vite 的 ambient 声明） | 2026-10-06 |
| Rust 入口 | "程序真正启动的地方" | main | src-tauri/src/main.rs | `luoxiaohei_lib::run` | 调 src-tauri/src/lib.rs 的 `run()`（1 处） | 2026-10-06 |
| Rust 逻辑入口 | "窗口与命令都在这" | run | src-tauri/src/lib.rs | `tauri::Builder` | 被 src-tauri/src/main.rs 引用（1 处）；**窗口控制命令加在这里**；**4-1 批次 1 已删掉脚手架的演示命令与 `tauri-plugin-opener` 注册**（`git grep -n` 两词在 `src/`+`src-tauri/` 命中均为 0）；当前 `run()` 只做 `tauri::Builder::default().run(generate_context!())` | 2026-10-06 |
| 编译期构建脚本 | "Tauri 的编译钩子" | main | src-tauri/build.rs | `tauri_build` | 编译期自动执行，无运行时引用 | 2026-10-06 |

<!-- 搜索词 = 下次 3 秒找到你的关键词组合：组件名/文案/路由。改完行不回写 = 卡片过期比没有更毒 -->
<!-- 角色渲染组件尚未存在：首个功能（2-1 → 4-1）落地后在此新增页面节，并删掉本节里被替换的行 -->

## 单窗口 main（无路由）· 首个功能组件（2026-10-06 · 3-1 卡登记，**待建 / 待改**）

> 本节 20 行 = 3-1 卡动作 3 的「组件影响」清单落点。**待建**=4-1 新建；**待改**=4-1 改动既有文件。
> 设计依据逐条见 `docs/specs/2026-10-06_desktop-pet/DESIGN.md` §4；文件与行的对应以本表为准。

| 界面元素 | 人话标识 | 程序名 | 文件 | 搜索词 | 影响面 | 最近确认 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 角色根 `<svg>`（**待建**） | "猫" | `HeiCat` | src/character/HeiCat.tsx | `viewBox` | 被 src/App.tsx 引用（1 处）；import `./heicat.css` 与 `./geometry.ts`；N/A（无个人数据）；N/A（无交互控件，仅图形） | 2026-10-06 |
| 角色几何常量（**待建**） | "猫各部件的位置数字" | `CAT_GEOMETRY` | src/character/geometry.ts | `characterBounds` | 被 HeiCat.tsx 与 src/interaction/hitTest.ts 引用（2 处）；**坐标系 = 320×360**（`VIEW_BOX` 由 3-5 卡勘误为 `'0 0 320 360'`，原写 `'0 0 260 300'` 会裁掉脚）；`characterBounds()` 输出**换算到 CSS px（设计坐标 ×0.8125）**，与 `screenToViewport` 同一坐标系；`tail.pathD` 参与 M3 的弧长断言（口径见 `docs/DESIGN_TOKENS.md` §10）；N/A；N/A | 2026-10-06 |
| 角色动画表（**待建**） | "呼吸眨眼甩尾的节奏" | — | src/character/heicat.css | `@keyframes breathe` | 被 HeiCat.tsx import（1 处）；被 motion.test.ts 按文本解析（1 处）；**只允许合成层属性**（transform/opacity）；N/A；N/A（装饰性动画，`prefers-reduced-motion` 由 3-6 卡定） | 2026-10-06 |
| 瞳孔跟随（**待建**） | "眼珠跟着鼠标转" | `useCursorFollow` | src/interaction/useCursorFollow.ts | `SAMPLE_HZ` | 被 src/App.tsx 引用（1 处）；**全项目唯一的 60Hz 定时器持有者**；N/A；N/A | 2026-10-06 |
| 透明区穿透（**待建**） | "点到透明的地方就是点到桌面" | `usePointerPassthrough` | src/interaction/usePointerPassthrough.ts | `setIgnoreCursorEvents` | 被 src/App.tsx 引用（1 处）；零定时器，消费 useCursorFollow 的同一 tick；N/A；N/A | 2026-10-06 |
| 拖拽与退出（**待建**） | "拖着走 + 右键退出" | `useDragExit` | src/interaction/useDragExit.ts | `startDragging` | 被 src/App.tsx 引用（1 处）；SCOPE S1 位置记忆的唯一改动点；N/A；右键菜单仅一项「退出」；键盘路径 = **Alt+F4**（Windows `WM_CLOSE`，3-4 卡登记，4-3 核） | 2026-10-06 |
| 瞳孔角度纯函数（**待建**） | "算眼珠该转多少度" | `gazeAngle` | src/interaction/gaze.ts | `SAMPLE_HZ` | 被 useCursorFollow.ts 引用（1 处）；N/A；N/A | 2026-10-06 |
| 命中判定纯函数（**待建**） | "算鼠标是不是在猫身上" | `screenToViewport` | src/interaction/hitTest.ts | `isOverCharacter` | 被 usePointerPassthrough.ts 引用（1 处）；N/A；N/A | 2026-10-06 |
| 窗口配置断言（**批次 1 已建**） | "查窗口配对了没" | — | src/tauriConfig.test.ts | `window-config OK` | SCOPE M1/M2/M8 的验收命令载体；读 tauri.conf.json 与 capabilities/default.json（2 处）；**6 个用例**（M1 六键 / 尺寸锁两键 / acl 4 条具名 / 授权总数 ≤5 / 门禁命令形态 / 授权↔调用方）；末条是 `window-config OK 6/6` 的反同义反复行为断言（TESTPLAN KP-03），批次 4 起自动升为 4/4 全量；文件顶部有 `/// <reference types="node" />`——**TS 6.0 不再自动纳入 `node_modules/@types/*`**，且 SCOPE §5 禁止改 tsconfig 的 types 白名单；N/A；N/A（测试文件） | 2026-10-06 |
| 几何断言（**待建**） | "查造型比例对不对" | — | src/character/geometry.test.ts | `眼白` | SCOPE M3 的验收命令载体；N/A；N/A | 2026-10-06 |
| 动画断言（**待建**） | "查动画节奏对不对" | — | src/character/motion.test.ts | `3.2s` | SCOPE M4 的验收命令载体；N/A；N/A | 2026-10-06 |
| 跟随断言（**待建**） | "查眼珠转得对不对" | — | src/interaction/gaze.test.ts | `SAMPLE_HZ === 60` | SCOPE M5 的验收命令载体；N/A；N/A | 2026-10-06 |
| 穿透断言（**待建**） | "查命中判定对不对" | — | src/interaction/hitTest.test.ts | `scaleFactor` | SCOPE M6 的验收命令载体；N/A；N/A | 2026-10-06 |
| 拖拽退出断言（**待建**） | "查拖拽和右键发出的是哪条命令" | — | src/interaction/dragExit.test.ts | `mockIPC` | SCOPE M7 的验收命令载体；N/A；N/A | 2026-10-06 |
| 窗口本体（**批次 0 已落**） | "那只猫所在的框" | — | src-tauri/tauri.conf.json | `alwaysOnTop` | **8 键已落**（260×300 / `transparent:true` / `decorations:false` / `alwaysOnTop:true` / `skipTaskbar:true` / `shadow:false` / `resizable:false` / `maximizable:false`；`minimizable` 保持默认 `true`）；被 src/tauriConfig.test.ts 读（1 处，批次 1 建） | 2026-10-06 |
| 权限清单（**批次 1 已落终值**） | "它被允许干什么" | — | src-tauri/capabilities/default.json | `allow-set-ignore-cursor-events` | **5 条终值**（`core:default` + `core:window:allow-close` + `core:window:allow-start-dragging` + `core:window:allow-set-ignore-cursor-events` + `core:menu:default`），`opener:default` 已删；NFR S2 上限 ≤5 正好用满；断言落在 `src/tauriConfig.test.ts` 的 `acl OK 4/4`（4 = 除 `core:default` 外的**具名**授权数）；APIS.md 的 I1~I3、I7 全依赖它 | 2026-10-06 |
| Rust 逻辑入口（**批次 1 已退**） | "窗口与命令都在这" | `run` | src-tauri/src/lib.rs | `tauri::Builder` | 已删演示命令与其注册（3 处）与 `tauri_plugin_opener` 注册（1 处）；`git grep -n` 两词在 `src/`+`src-tauri/` 命中 **0 / 0**；窗口构建不动 | 2026-10-06 |
| 应用根组件（**批次 1 已换**） | "整个界面" | `App` | src/App.tsx | `HeiCat` | 已整份替换（脚手架演示页 → 空装配点，渲染 `null`）；批次 2~4 逐个接上 `HeiCat` + 三个 hook（4 处）；带 `ceiling:` / `upgrade:` 标记各 1 行 | 2026-10-06 |
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
