# COMPONENTS · 组件注册表（界面 ↔ 代码 的地图）
> 最近核对 —（骨架未核对；核对后填 <日期> @ <提交哈希>）
> 用法：agent 改 UI 前先查这张表定位；改完同批回写（5-1 归档卡会查）。新建文件不登记 = 孤儿（5-1 卡第 ⑧ 查会报）。
> "人话标识"填你指着屏幕会怎么说——这是给人看的定位列。
> 分节规则：每个页面一节，标题写「页面名 路由」（如 `## 统计页 /stats`）；单节 ≤30 行，超了说明该拆组件了。

## 应用外壳 · 单窗口无路由（2026-10-06 · 1-2 卡初始化，全部为脚手架文件）

| 界面元素 | 人话标识 | 程序名 | 文件 | 搜索词 | 影响面 | 最近确认 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 应用根组件 | "整个界面" | App | src/App.tsx | `App` | 被 src/main.tsx 引用（1 处）；**当前是脚手架演示页，首个功能会整份替换**（3-1 卡已把它列进下方「待改」表）；N/A（无个人数据）；N/A（暂无交互控件） | 2026-10-06 |
| 前端挂载点 | "把 React 挂上去的那段" | — | src/main.tsx | `createRoot` | 被 index.html 引用（1 处）；无 | 2026-10-06 |
| 构建配置 | "打包怎么配的" | — | vite.config.ts | `defineConfig` | 开发与打包共用；dev 端口 1420，**必须与 src-tauri/tauri.conf.json 的 devUrl 一致** | 2026-10-06 |
| Vite 类型声明 | "Vite 的类型补丁" | — | src/vite-env.d.ts | `vite/client` | 全局生效、无显式引用（`orphans.ps1` 报其为孤儿，**属预期**：这是 Vite 的 ambient 声明） | 2026-10-06 |
| Rust 入口 | "程序真正启动的地方" | main | src-tauri/src/main.rs | `luoxiaohei_lib::run` | 调 src-tauri/src/lib.rs 的 `run()`（1 处） | 2026-10-06 |
| Rust 逻辑入口 | "窗口与命令都在这" | run | src-tauri/src/lib.rs | `tauri::Builder` | 被 src-tauri/src/main.rs 引用（1 处）；**窗口控制命令加在这里**；当前含脚手架自带的 `greet` 演示命令（3-1 卡已把它列进下方「待改」表，删除条件 = `git grep -n greet` 命中 0） | 2026-10-06 |
| 编译期构建脚本 | "Tauri 的编译钩子" | main | src-tauri/build.rs | `tauri_build` | 编译期自动执行，无运行时引用 | 2026-10-06 |

<!-- 搜索词 = 下次 3 秒找到你的关键词组合：组件名/文案/路由。改完行不回写 = 卡片过期比没有更毒 -->
<!-- 角色渲染组件尚未存在：首个功能（2-1 → 4-1）落地后在此新增页面节，并删掉本节里被替换的行 -->

## 单窗口 main（无路由）· 首个功能组件（2026-10-06 · 3-1 卡登记，**待建 / 待改**）

> 本节 20 行 = 3-1 卡动作 3 的「组件影响」清单落点。**待建**=4-1 新建；**待改**=4-1 改动既有文件。
> 设计依据逐条见 `docs/specs/2026-10-06_desktop-pet/DESIGN.md` §4；文件与行的对应以本表为准。

| 界面元素 | 人话标识 | 程序名 | 文件 | 搜索词 | 影响面 | 最近确认 |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 角色根 `<svg>`（**待建**） | "猫" | `HeiCat` | src/character/HeiCat.tsx | `viewBox` | 被 src/App.tsx 引用（1 处）；import `./heicat.css` 与 `./geometry.ts`；N/A（无个人数据）；N/A（无交互控件，仅图形） | 2026-10-06 |
| 角色几何常量（**待建**） | "猫各部件的位置数字" | `CAT_GEOMETRY` | src/character/geometry.ts | `characterBounds` | 被 HeiCat.tsx 与 src/interaction/hitTest.ts 引用（2 处）；N/A；N/A | 2026-10-06 |
| 角色动画表（**待建**） | "呼吸眨眼甩尾的节奏" | — | src/character/heicat.css | `@keyframes breathe` | 被 HeiCat.tsx import（1 处）；被 motion.test.ts 按文本解析（1 处）；**只允许合成层属性**（transform/opacity）；N/A；N/A（装饰性动画，`prefers-reduced-motion` 由 3-6 卡定） | 2026-10-06 |
| 瞳孔跟随（**待建**） | "眼珠跟着鼠标转" | `useCursorFollow` | src/interaction/useCursorFollow.ts | `SAMPLE_HZ` | 被 src/App.tsx 引用（1 处）；**全项目唯一的 60Hz 定时器持有者**；N/A；N/A | 2026-10-06 |
| 透明区穿透（**待建**） | "点到透明的地方就是点到桌面" | `usePointerPassthrough` | src/interaction/usePointerPassthrough.ts | `setIgnoreCursorEvents` | 被 src/App.tsx 引用（1 处）；零定时器，消费 useCursorFollow 的同一 tick；N/A；N/A | 2026-10-06 |
| 拖拽与退出（**待建**） | "拖着走 + 右键退出" | `useDragExit` | src/interaction/useDragExit.ts | `startDragging` | 被 src/App.tsx 引用（1 处）；SCOPE S1 位置记忆的唯一改动点；N/A；右键菜单仅一项「退出」，无键盘可达性（原生菜单） | 2026-10-06 |
| 瞳孔角度纯函数（**待建**） | "算眼珠该转多少度" | `gazeAngle` | src/interaction/gaze.ts | `SAMPLE_HZ` | 被 useCursorFollow.ts 引用（1 处）；N/A；N/A | 2026-10-06 |
| 命中判定纯函数（**待建**） | "算鼠标是不是在猫身上" | `screenToViewport` | src/interaction/hitTest.ts | `isOverCharacter` | 被 usePointerPassthrough.ts 引用（1 处）；N/A；N/A | 2026-10-06 |
| 窗口配置断言（**待建**） | "查窗口配对了没" | — | src/tauriConfig.test.ts | `window-config OK` | SCOPE M1/M2 的验收命令载体；读 tauri.conf.json 与 capabilities/default.json（2 处）；N/A；N/A（测试文件） | 2026-10-06 |
| 几何断言（**待建**） | "查造型比例对不对" | — | src/character/geometry.test.ts | `眼白` | SCOPE M3 的验收命令载体；N/A；N/A | 2026-10-06 |
| 动画断言（**待建**） | "查动画节奏对不对" | — | src/character/motion.test.ts | `3.2s` | SCOPE M4 的验收命令载体；N/A；N/A | 2026-10-06 |
| 跟随断言（**待建**） | "查眼珠转得对不对" | — | src/interaction/gaze.test.ts | `SAMPLE_HZ === 60` | SCOPE M5 的验收命令载体；N/A；N/A | 2026-10-06 |
| 穿透断言（**待建**） | "查命中判定对不对" | — | src/interaction/hitTest.test.ts | `scaleFactor` | SCOPE M6 的验收命令载体；N/A；N/A | 2026-10-06 |
| 拖拽退出断言（**待建**） | "查拖拽和右键发出的是哪条命令" | — | src/interaction/dragExit.test.ts | `mockIPC` | SCOPE M7 的验收命令载体；N/A；N/A | 2026-10-06 |
| 窗口本体（**待改**） | "那只猫所在的框" | — | src-tauri/tauri.conf.json | `alwaysOnTop` | 改 6 键：260×300 / transparent / decorations:false / alwaysOnTop / skipTaskbar / **shadow:false**；被 tauriConfig.test.ts 读（1 处） | 2026-10-06 |
| 权限清单（**待改**） | "它被允许干什么" | — | src-tauri/capabilities/default.json | `allow-set-ignore-cursor-events` | permissions 2 → 5 条，**删 `opener:default`**；APIS.md 的 I1~I3、I7 全依赖它 | 2026-10-06 |
| Rust 逻辑入口（**待改**） | "窗口与命令都在这" | `run` | src-tauri/src/lib.rs | `tauri::Builder` | 删 `greet` 命令与注册（3 处）；删 `tauri_plugin_opener` 注册（1 处）；窗口构建不动 | 2026-10-06 |
| 应用根组件（**待改**） | "整个界面" | `App` | src/App.tsx | `HeiCat` | 整份替换（脚手架演示页 → 摆件装配）；引用 HeiCat + 三个 hook（4 处） | 2026-10-06 |
| 全局样式（**待改**） | "窗口的底色与定位" | — | src/App.css | `background` | 整份替换：删脚手架样式（含 `#greet-input`）；只留 html/body 全透明 + 100% 尺寸 + 禁滚动 | 2026-10-06 |
| 收工门禁（**待改**） | "查完成没完成的那条命令" | `$STEPS` | check.ps1 | `npm run typecheck` | `$STEPS` 从 2 条占位换 4 条：typecheck / test / git status / security；结构断言段不动 | 2026-10-06 |

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
