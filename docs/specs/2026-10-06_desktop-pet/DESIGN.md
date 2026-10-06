# DESIGN · 罗小黑桌面摆件 MVP（L 档 · 动代码前的钉死件）

> 产物寿命：**持久（进仓库）** ｜ 卡：**3-1 设计**（L 档加走）｜ 上游：`docs/specs/2026-10-06_desktop-pet/SCOPE.md`（2026-10-06 用户确认）+ 同目录 `RESEARCH.md` §5 方案 A（采纳）+ 同目录 `NFR.md`（2026-10-06 用户确认）
> 时间戳：2026-10-06 ｜ 状态：**设计已产出，等待用户批准**（卡内禁令：设计未获人批准不许进 4-1）
> 本项目**无数据库、无服务端**：§2「数据字典 diff」与 §5「迁移三件套」按"无表结构"处理，各节内引用了豁免依据原文。
> 命令形态一律 `powershell -NoProfile -ExecutionPolicy Bypass -File`（AGENTS.md §10 环境坑 1：本机 `-File` 会被执行策略拦下）；路径一律正斜杠。

---

## 0. 动作 0 · 设计计划前置（动手前先写）

```text
① 一句话目标：把 SCOPE 的 8 条 Must 钉成「14 个新文件的文件名 + 每个纯函数的签名 + 每条判据的可跑命令」，让 4-1 只照着写、不再做设计决策。
② 要钉死的对象：表 = 无（无数据库，见 §2）；接口 = 7 条 Tauri IPC 命令 + 5 条 capability 授权（见 §3）；组件 = 14 个待建文件 + 6 个改动文件（见 §4）。
③ 取舍与判据：选「几何纯函数 + 单定时器轮询 setIgnoreCursorEvents」，不选「CSS pointer-events」「整窗常穿透」「elementFromPoint 作唯一判据」——
   判据 = SCOPE §5 的 M6 验收命令要的是能在 Node 里用 node --test 断言的纯函数（逐条见 §9 被否方案）。
④ 明确不做：W1~W14 原文照抄于 §1.2，一条不改回 Must。
⑤ 预发六轴自评要跑：见 §11。
```

---

## 1. 目标与非目标

### 1.1 目标（SCOPE §2 的 8 条 Must，逐条映射到实现对象）

| Must | 实现对象（本设计钉死） | 验收命令（SCOPE §5 原文） |
| :-- | :-- | :-- |
| **M1** 透明置顶小窗配置 | `src-tauri/tauri.conf.json` 的 `app.windows[0]` 六个键（§3.4） | `npm run typecheck` + `node --test src/tauriConfig.test.ts` 打印 `window-config OK 6/6` |
| **M2** ACL 补齐 + 残留清除 | `src-tauri/capabilities/default.json` 的 `permissions` 5 条（§3.2）+ 删 4 处 `opener` 引用（§4.3） | 同文件 `acl OK 4/4` |
| **M3** SVG 静态造型 | `src/character/geometry.ts`（常量）+ `src/character/HeiCat.tsx`（SVG） | `node --test src/character/geometry.test.ts` |
| **M4** 三组 idle 动画 | `src/character/heicat.css` 的 3 组 `@keyframes`（§3.5） | `node --test src/character/motion.test.ts` |
| **M5** 瞳孔跟随 60Hz | `src/interaction/gaze.ts`（纯函数）+ `src/interaction/useCursorFollow.ts`（唯一定时器） | `node --test src/interaction/gaze.test.ts` |
| **M6** 透明区穿透 | `src/interaction/hitTest.ts`（纯函数）+ `src/interaction/usePointerPassthrough.ts` | `node --test src/interaction/hitTest.test.ts` |
| **M7** 拖拽 + 右键退出 | `src/interaction/useDragExit.ts` | `node --test src/interaction/dragExit.test.ts` |
| **M8** 门禁真实化 | `check.ps1` 的 `$STEPS` + `package.json` 的两个 script（§3.3） | `check.ps1` 退出码 0，4 条 STEP 各 `[OK]` |

### 1.2 非目标（SCOPE §4 的 Won't Have 原文，逐条照抄，一条不改回）

| # | 本期明确不做 | 为什么本期不做 |
| :-- | :-- | :-- |
| W1 | 养成系统（饥饿 / 心情 / 等级 / 数值成长） | IDEA 卡动作 4 已明确排除；且会引入持久化状态与数值平衡，与"轻摆件"定位冲突 |
| W2 | 多角色 / 角色切换 | 本期只有罗小黑一个形象；多角色需先有角色包体系（架构级变更），未立项 |
| W3 | 语音 / 音效 | IDEA 卡动作 4 明确排除；且需音频资源与播放链路，不在 2 周验证预算内 |
| W4 | 开机自启 | IDEA 卡动作 4 明确排除；写启动项属修改真实系统状态，非本期范围 |
| W5 | **任何联网**（更新检查 / 遥测 / 云同步 / 在线素材商店） | IDEA 卡动作 4 明确排除；2-6 已据此否决唯一形似的库 `tauri-plugin-sprite-pet` |
| W6 | 跨平台（macOS / Linux） | IDEA 卡动作 4 明确排除；本机只有 Windows，无法验证 |
| W7 | 系统托盘图标 | 用户 Q5 裁决不要；会引入"关窗不退出"的生命周期复杂度 |
| W8 | 右键菜单里的置顶开关 / 缩放 / 设置 | 用户 Q5 裁决菜单**只放「退出」** |
| W9 | 角色自定义（换色 / 换装 / 上传图片） | 需资源管线与持久化，超出"摆件"范围 |
| W10 | 自动更新 | 需联网 + 代码签名基础设施（W5 已排除联网） |
| W11 | 多显示器各放一只（多实例管理） | 本期单窗口单实例；多实例需引入窗口工厂与生命周期管理 |
| W12 | 提醒 / 番茄钟 / 待办等实用功能 | 与"活摆件"定位无关，属另一个产品 |
| W13 | 引入 vitest / eslint / jest 等测试与检查工具链 | D6③ 禁未请求的依赖变更；Node 24 内置 `node --test` + 已装 `tsc` 已覆盖（唯一例外见 §3.3） |
| W14 | 引入 Live2D / 序列帧贴图作为角色载体 | 2-6 已判「自研」；载体已定为 SVG 矢量 + CSS 动画（方案 A） |

> **S1 位置记忆（Should）本设计不实现**：落点已在 §3.5 与 §2 D-e 行钉死，4-1 不写 `localStorage`。改判时的唯一改动点 = `src/interaction/useDragExit.ts` 的拖拽结束回调（NFR `capacity` C3 已把"只允许一个坐标"写进模块约束）。

---

## 2. 数据字典 diff

**结论：无表、无字段、无持久化存储 → `docs/registry/DATA_DICT.md` 本次不改。**

豁免依据（该文件第 5 行原文）：

```text
> **怎么填**：每张真实表一节…；没有数据库的项目保持原样即可，不用建节（不是欠账）。
```

设计确实引入了"数据"，但全部是**进程内瞬时状态**——不落盘、不出进程、开机即失。逐行标敏感度：

| # | 载体 | 名 | 类型 | 校验 | 敏感度 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **D-a** | WebView 内存（React state） | `gazeDeg` | `number`，单位度，取值 −180 ~ 180 | `Number.isFinite()` 为真；越界夹取（SCOPE U3：不许出现 `rotate(NaN)`） | **D1** |
| **D-b** | WebView 内存（React ref，不进 state） | `cursorScreen` | `{ x: number, y: number } \| null` | `null` 时瞳孔回正到 0°（SCOPE U3） | **D1** |
| **D-c** | WebView 内存（React state） | `overCharacter` | `boolean` | 由 `isOverCharacter()` 纯函数推出，无第二处写入 | **D1** |
| **D-d** | 只读系统信息（不持有，用后即弃） | `windowOrigin` / `scaleFactor` | `{ x: number, y: number }` / `number` | 来自 `plugin:window\|outer_position` 与 `plugin:window\|current_monitor` | **D1** |
| **D-e** | 落盘 | —— | —— | **无**：不写任何用户目录文件（NFR `capacity` **C3**「写入用户目录的文件数 = 0」）；S1 若在后续版本启用，只允许 `localStorage` 一个坐标、≤ 1 KB | —— |

- 敏感度取值依据（3-1 卡动作 1 的四档定义）：上表 4 项全是**产品运行期坐标与角度**，不含任何能定位到自然人的信息 → 一律 **D1**。无 D2/D3/D4 字段。
- D-e 行按 AGENTS.md D12「no-op 测试」的反面写：这一行的存在意义是记下"**没有**第五类数据"，不是留空。
- 无迁移：无表结构 → §5 按卡的 N/A 通道处理。

---

## 3. 接口契约

### 3.1 接口面是什么（先纠正口径，防 4-1 找错地方）

本项目**无 HTTP 接口、无服务端**（`docs/ARCHITECTURE.md` §1 已按"删比留空准"删掉 API 行）。真实接口面 = **Tauri IPC**：前端 `invoke('plugin:<模块>|<命令>', payload)` → `Promise`，**同进程、不监听端口、不对外暴露**（RESEARCH §9 第 4 条已判：这不构成 AGENTS.md C3 红线域的「新增对外接口」）。

命令字符串与 payload 形状**逐条从已装包源码核出**，不是记忆：

| # | 命令（invoke 路径） | 用途（对应 Must） | 错误码 | 鉴权（capability 条目） |
| :-- | :-- | :-- | :-- | :-- |
| **I1** | `plugin:window\|close` | 右键菜单「退出」→ 关窗并退出进程（**M7**） | E-IPC-01 / E-IPC-03 | `core:window:allow-close` |
| **I2** | `plugin:window\|start_dragging` | 左键按住猫身拖动窗口（**M7**） | E-IPC-01 | `core:window:allow-start-dragging` |
| **I3** | `plugin:window\|set_ignore_cursor_events` | 透明区穿透开关（**M6**） | E-IPC-01 | `core:window:allow-set-ignore-cursor-events` |
| **I4** | `plugin:window\|cursor_position` | 60Hz 全局光标采样（**M5**） | E-IPC-03 | `core:window:default` **已含**（RESEARCH F7） |
| **I5** | `plugin:window\|current_monitor` | 混合 DPI 换算的 `scaleFactor`（**M6**，SCOPE U1） | E-IPC-03 | `core:window:default` **已含**（F7） |
| **I6** | `plugin:window\|outer_position` | 命中测试所需的窗口原点（**M6**） | E-IPC-03 | `core:window:default` **已含**（F7） |
| **I7** | `plugin:menu\|new` + `plugin:menu\|popup` | 右键原生菜单，**只有一项「退出」**（**M7**） | E-IPC-01 / E-IPC-03 | `core:menu:default`（`node_modules/@tauri-apps/api/menu.d.ts:14` 原文：`All commands used by this module are part of the core:menu:default`） |

**最小 JSON 请求 / 响应（逐条从 `node_modules/@tauri-apps/api/window.js` 与 `menu/menu.js` 读出，不是拟构）**

```text
I1  req {"label":"main"}                          res null
I2  req {"label":"main"}                          res null
I3  req {"label":"main","value":true}             res null
I4  req (无参数)                                   res {"x":960,"y":540} | null
I5  req (无参数)                                   res {"name":"…","size":{"width":2560,"height":1440},"scaleFactor":1.25} | null
I6  req {"label":"main"}                          res {"x":820,"y":460}
I7  req(menu|new) {"kind":"Menu","options":{"items":[…]},"handler":<Channel>}   res ["<rid>","<id>"]
    req(menu|popup) {"rid":"<rid>","kind":"Menu","window":"main","at":{"x":1100,"y":640}}  res null
```

> I7 的 `new` 一行里 `handler` 是 Tauri `Channel`（不能写成纯 JSON），故标注为 `<Channel>`；`options` 由 `node_modules/@tauri-apps/api/menu/base.js` 的 `newMenu(kind, opts)` 组装，**该项无 JSON 字面量可写**。

### 3.2 鉴权（capability ACL）

`src-tauri/capabilities/default.json` 的 `permissions` 终值 **5 条**（NFR `security` **S2** 上限 ≤5，正好用满）：

```json
"permissions": [
  "core:default",
  "core:window:allow-close",
  "core:window:allow-start-dragging",
  "core:window:allow-set-ignore-cursor-events",
  "core:menu:default"
]
```

- **不加** `core:window:allow-set-always-on-top` / `allow-set-skip-taskbar`：`alwaysOnTop` 与 `skipTaskbar` 由 `tauri.conf.json` 静态配置满足（M1），运行时不再调它们（NFR S2「不得保留未被调用的授权」）。
- **`acl OK 4/4` 的口径（防 4-1 各写各的）**：该行断言的是**除 `core:default` 之外的 4 条具名授权**（`allow-close` / `allow-start-dragging` / `allow-set-ignore-cursor-events` / `core:menu:default`）；`permissions` **总数 = 5 条**（NFR S2 的上限）。测试打印 4 是因为 SCOPE §5 M2 的命令原文写的就是 4 条具名项，不是"总共有 4 条"。
- **删除** `opener:default`：前端零引用（RESEARCH 2-4 卡实测，`git grep -n opener` 5 处全是脚手架注册点）→ 见 §4.3 退役清单。

### 3.3 错误码（新错误码，同批登记 `docs/registry/APIS.md`）

| 错误码 | 触发条件 | 现象 | 处置（代码写法定死） | 谁在门禁里拦住它 |
| :-- | :-- | :-- | :-- | :-- |
| **E-IPC-01** | capability 缺条目，ACL 拒绝该命令 | `invoke` 返回 rejected Promise | **不吞错**：`console.error('[ipc] E-IPC-01 <命令名>', err)`；功能静默失效由门禁拦，不靠运行时兜 | `src/tauriConfig.test.ts` 的 `acl OK 4/4` 用例（M2 验收命令）断言 5 条权限齐全 |
| **E-IPC-02** | `cursorPosition()` / `currentMonitor()` 返回 `null`（鼠标移出所有屏幕、显示器拔插、远程桌面切分辨率） | Promise **resolved 为** `null`，不抛错 | 瞳孔回正 0°；穿透开关**保持上一次取值**（不许翻成整窗穿透）；不重试、不记盘 | `src/interaction/gaze.test.ts` 与 `hitTest.test.ts` 各含一条 `null` 入参用例，断言不抛错且输出确定值 |
| **E-IPC-03** | 窗口生命周期末端的调用（`close()` 之后仍有 tick 在排队） | rejected Promise | 忽略（`close()` 是最后一动作，进程随即退出） | 无（不可达路径，4-2 审查只核对"`close()` 后不再写状态"这一点） |

> 本项目**不使用** 9xxx 占位错误码通道（那是"本期不实现但契约先行的 HTTP 占位接口"专用）；无 HTTP → 无 503 语义。

### 3.4 窗口配置（M1 的六个键 + 3-4 卡追加的 2 个尺寸锁键，逐键给终值）

| 键 | 现在（实测 `src-tauri/tauri.conf.json:15-17`） | 终值 | 依据 |
| :-- | :-- | :-- | :-- |
| `width` / `height` | 800 / 600 | **260 / 300** | 用户 Q3 裁决「尺寸采用」；SCOPE §7 逻辑尺寸 |
| `transparent` | 未写（默认 false） | **true** | M1 判定问句 |
| `decorations` | 未写（默认 true） | **false** | 同上 |
| `alwaysOnTop` | 未写（默认 false） | **true** | 同上 |
| `skipTaskbar` | 未写（默认 false） | **true** | 同上 |
| `shadow` | 未写（**默认 true**） | **false** | RESEARCH **F4** 原文：无边框窗口下 `true` 会产生 1px 白边，Win11 还带圆角 |
| `resizable` / `maximizable`（**3-4 卡追加**） | 未写（默认 `true` / `true`） | **`false` / `false`** | 3-4 卡：无边框窗口仍可被拖边缘或 Win+Up 改尺寸 → 与 `VIEW_BOX`（§3.5，终值 `'0 0 320 360'`）失配，直接破 M6 命中判定与 M3 造型比例。`minimizable` **保持默认 `true`**（NFR A3 的验证动作要"最小化→还原"，关掉它该行就无法验证）。理由与断言落点见 `docs/UI.md` §6：第二行 `window-lock OK 2/2`，M1 原有的 `window-config OK 6/6` 不动 |

### 3.5 前端模块签名（钉死到函数级，4-1 不再做设计决策）

```text
src/character/geometry.ts        （纯数据 + 纯查询，无副作用）
  export const VIEW_BOX = '0 0 320 360'   // 3-5 勘误：原写 '0 0 260 300' 与 DESIGN_TOKENS §10 的 320×360 设计坐标系冲突（身体底沿 y=352 会被裁）；元素仍渲染 260 CSS px 宽 → 高 292.5，正好留出 SCOPE §7 的底部 8px
  export const CAT_GEOMETRY: { head: Ellipse; eyeWhites: [Ellipse, Ellipse]; pupils: [Circle, Circle];
                               eyelidTravelPx: number; tail: { rootX: number; rootY: number; lengthPx: number; pathD: string };
                               // tail.lengthPx = 声明的目标弧长（408，设计坐标）；pathD 是 4-1 画的曲线，采样出的弧长 ≥ 1.20 × 体高才过 M3（见 DESIGN_TOKENS §10）
                               torsoOriginY: number }
  export function characterBounds(): Bounds[]        // 输出换算到 CSS px（设计坐标 ×0.8125），与 screenToViewport 同一坐标系；供 hitTest 粗筛；纯函数

src/interaction/gaze.ts          （纯函数）
  export const SAMPLE_HZ = 60                        // M5 验收命令断言这个常量
  export const FAR_RESET_PX = 1500                   // 距窗口中心超过该值 → 回正
  export function gazeAngle(dx: number, dy: number): number   // Math.atan2(dy,dx)*180/PI；越界/NaN → 0

src/interaction/hitTest.ts       （纯函数，输入全部显式传入，D14① 禁隐式全局）
  export function screenToViewport(screen: Point, windowOrigin: Point, scaleFactor: number): Point
  export function isOverCharacter(viewport: Point, bounds: Bounds[]): boolean

src/interaction/useCursorFollow.ts      （唯一定时器持有者）
  export function useCursorFollow(enabled: boolean): { gazeDeg: number; cursorScreen: Point | null }
  // setInterval 16.7 ms；每个 tick 只调一次 plugin:window|cursor_position；值未变则不 setState

src/interaction/usePointerPassthrough.ts （零定时器；消费 useCursorFollow 的同一 tick）
  export function usePointerPassthrough(cursorScreen: Point | null, scaleFactor: number): void
  // 每次 cursorScreen 变化才判定并仅在 over→!over 翻转时调 plugin:window|set_ignore_cursor_events

src/interaction/useDragExit.ts
  export function useDragExit(): { onMouseDown: (e: React.MouseEvent) => void; onContextMenu: (e: React.MouseEvent) => void }
  // onMouseDown: 左键 → invoke('plugin:window|start_dragging')；onContextMenu: Menu.new + MenuItem.new('退出') + popup
```

**单定时器约束的落法**（`docs/ARCHITECTURE.md` §5 第 2 行要求「瞳孔跟随只允许一个定时器（60Hz）」）：`useCursorFollow` 是**唯一** `setInterval` 持有者；`usePointerPassthrough` 从参数拿 `cursorScreen`，**自己不采样**。两个 60Hz 定时器 = 120 次/秒 IPC，直接违反该约束。

### 3.6 门禁命令（M8 的 `$STEPS` 终值）

`check.ps1:12` 换成（**顺序即 SCOPE §5 M8 的验收输出顺序**）：

```powershell
$STEPS = @('npm run typecheck','npm run test','git status --porcelain','powershell -NoProfile -File security.ps1')
```

`package.json` 的 `scripts` 增两条（+ 1 个 devDependency，用户已裁决允许）：

```json
"typecheck": "tsc --noEmit",
"test": "node --test \"src/**/*.test.ts\""
```

- 必须是 **glob 模式**，不能给目录（SCOPE §5 M8 约束 1：Node v24.21.0 上 `node --test <目录>` 实测退出码 1）。
- 测试文件 import 一律带 `.ts` 后缀（同节约束 2）；`tsconfig.json` 的 `include: ["src"]` 已覆盖测试文件，**不改 tsconfig**。
- `@types/node` 与 `lib: ["DOM"]` 的 `setTimeout` 签名冲突（`number` vs `Timeout`）：出现时用 `ReturnType<typeof setTimeout>` 收敛，**不去改 `tsconfig` 的 types 白名单**（SCOPE §5 已知风险原文）。

---

## 4. 组件影响

### 4.1 改动面（6 个既有文件）

| 页面 | 界面元素 | 人话标识 | 文件 | 影响面 |
| :-- | :-- | :-- | :-- | :-- |
| 单窗口 `main`（无路由） | 窗口本体 | "那只猫所在的框" | `src-tauri/tauri.conf.json` | 改 6 键 + 3-4 卡追加的 2 个尺寸锁键（§3.4）；被 `src/tauriConfig.test.ts` 读取（1 处）；无其他引用 |
| 单窗口 `main` | 权限清单 | "它被允许干什么" | `src-tauri/capabilities/default.json` | 改 `permissions`（2 → 5 条，删 `opener:default`）；§3.1 的 I1~I3、I7 全部依赖它；被 `src/tauriConfig.test.ts` 读取（1 处） |
| 单窗口 `main` | Rust 入口 | "程序真正启动的地方" | `src-tauri/src/lib.rs` | 删 `greet` 命令与 `invoke_handler` 里的注册（**3 处**，`git grep -n greet` 原文）；`tauri::Builder` 窗口构建不动 |
| 单窗口 `main` | 应用根组件 | "整个界面" | `src/App.tsx` | **整份替换**（脚手架演示页 → 摆件装配）；引用 `HeiCat` + 三个 hook（4 处）；`docs/registry/COMPONENTS.md:11` 已注「当前是脚手架演示页，首个功能会整份替换」 |
| 单窗口 `main` | 全局样式 | "窗口的底色与定位" | `src/App.css` | **整份替换**：删脚手架样式（含 `#greet-input` 规则），只留 `html/body` 全透明 + 100% 尺寸 + 禁滚动 |
| 非界面 | 收工门禁 | "查完成没完成的那条命令" | `check.ps1` | `$STEPS` 从 2 条占位换 4 条真实命令（§3.6）；结构断言段（文件数预算 / git 断言）不动 |

### 4.2 待建行（14 个新文件，`docs/registry/COMPONENTS.md` 同批登记）

| 页面 | 界面元素 | 人话标识 | 文件 | 影响面 |
| :-- | :-- | :-- | :-- | :-- |
| 单窗口 `main` | 角色根 `<svg>` | "猫" | `src/character/HeiCat.tsx` | **待建行**；被 `src/App.tsx` 引用（1 处）；import `./heicat.css` 与 `./geometry.ts` |
| 单窗口 `main` | 角色几何常量 | "猫各部件的位置数字" | `src/character/geometry.ts` | **待建行**；被 `HeiCat.tsx` 与 `src/interaction/hitTest.ts` 引用（2 处） |
| 单窗口 `main` | 角色动画表 | "呼吸眨眼甩尾的节奏" | `src/character/heicat.css` | **待建行**；被 `HeiCat.tsx` import（1 处）；被 `motion.test.ts` 按文本解析（1 处） |
| 单窗口 `main` | 瞳孔跟随 | "眼珠跟着鼠标转" | `src/interaction/useCursorFollow.ts` | **待建行**；被 `src/App.tsx` 引用（1 处）；**唯一** `setInterval` 持有者 |
| 单窗口 `main` | 透明区穿透 | "点到透明的地方就是点到桌面" | `src/interaction/usePointerPassthrough.ts` | **待建行**；被 `src/App.tsx` 引用（1 处）；零定时器 |
| 单窗口 `main` | 拖拽与退出 | "拖着走 + 右键退出" | `src/interaction/useDragExit.ts` | **待建行**；被 `src/App.tsx` 引用（1 处）；S1 位置记忆的唯一改动点 |
| 非界面 | 瞳孔角度纯函数 | "算眼珠该转多少度" | `src/interaction/gaze.ts` | **待建行**；被 `useCursorFollow.ts` 引用（1 处） |
| 非界面 | 命中判定纯函数 | "算鼠标是不是在猫身上" | `src/interaction/hitTest.ts` | **待建行**；被 `usePointerPassthrough.ts` 引用（1 处） |
| 非界面 | 窗口配置断言 | "查窗口配对了没" | `src/tauriConfig.test.ts` | **待建行**；M1/M2 的验收命令载体；读 `tauri.conf.json` 与 `capabilities/default.json` |
| 非界面 | 几何断言 | "查造型比例对不对" | `src/character/geometry.test.ts` | **待建行**；M3 的验收命令载体；**SCOPE §0 行数账漏登，本设计补（§12 G1）** |
| 非界面 | 动画断言 | "查动画节奏对不对" | `src/character/motion.test.ts` | **待建行**；M4 的验收命令载体 |
| 非界面 | 跟随断言 | "查眼珠转得对不对" | `src/interaction/gaze.test.ts` | **待建行**；M5 的验收命令载体；断言 `SAMPLE_HZ === 60` |
| 非界面 | 穿透断言 | "查命中判定对不对" | `src/interaction/hitTest.test.ts` | **待建行**；M6 的验收命令载体 |
| 非界面 | 拖拽退出断言 | "查拖拽和右键发出的是哪条命令" | `src/interaction/dragExit.test.ts` | **待建行**；M7 的验收命令载体；用 `@tauri-apps/api/mocks` 的 `mockIPC` |

### 4.3 同批退役清单（D11 生成多删除少：被取代的实现同批删）

| 被删对象 | 处数 | 判定条件（可判定） | 是否需并行态登记 |
| :-- | :-- | :-- | :-- |
| `greet` 命令（`src-tauri/src/lib.rs`） | 3 | `git grep -n "greet"` 命中 **0** 处 | 否（唯一调用方在本仓库内且同批删） |
| 脚手架演示页（`src/App.tsx` / `src/App.css`） | 2 文件 | 两文件行数 ≤ 各自 §7 终值，且 `git grep -n "greet"` 命中 0 | 否（同上） |
| `tauri-plugin-opener` | 4（`src-tauri/Cargo.toml:22` / `src-tauri/src/lib.rs:10` / `package.json:16` / `capabilities/default.json:8`） | `git grep -n "opener"` 命中 **0** 处 | 否（`STATE.md` 并行态登记簿现有那一行的**删除条件就是本批次**；本批删完即销行） |

> 删 `package.json` 的 `@tauri-apps/plugin-opener` 会改 `package-lock.json`，删 `Cargo.toml` 的依赖会改 `src-tauri/Cargo.lock` → **两个 lockfile 各作独立提交并单独说明**（AGENTS.md D6③ + `gate.ps1` 判据 ⑦ 的字面要求）。`gate.ps1` 对生成物的无条件判红已登记 `docs/TECH_DEBT.md` **TD-001**（用户 2026-10-06 裁决走「给 `gate.ps1` 加生成物豁免参数」，属改守护脚本，**另立项，不在本卡动**）。

---

## 5. 迁移三件套

**N/A（本项目无数据库、无表结构、无服务端）**

- `up` / `down` / `seed` 三个文件**均不创建**，`migrations/` 目录不建。
- 依据（`docs/ARCHITECTURE.md` §2 第 32 行原文）：「本项目已合并掉接口层 / 数据层：无服务端、无数据库，故两行按『删比留空准』删除。」
- 由此触发 3-1 卡「down 必须人本地空跑验证（涉及表结构时）」的 N/A 通道 → ③ 证据回执第 4 项写 N/A，`STATE.md` 的 `裁剪记录` 写本行依据。
- **可逆性不因此缺失**：本设计的全部改动都是仓库内文件，回退 = `git revert <批次哈希>`；无数据迁移、无不可逆外部动作。

---

## 6. 破坏性分级

**结论：无 L1/L2/L3 分级事件（无表结构、无持久化数据、无对外契约）。**

代码侧的对应判定（同批给依据，供 4-2 复核）：

| 动作 | 分级 | 依据 |
| :-- | :-- | :-- |
| 新增 14 个文件 | **L1 纯追加** | 无既有对象被改写 |
| 改 6 个既有文件（其中 3 个整份替换） | **L1** | 被改对象是 1-2 卡脚手架演示页，`docs/registry/COMPONENTS.md:11` 已注「首个功能会整份替换」；无外部消费者 |
| 删 `greet`（3 处）、删 `tauri-plugin-opener`（4 处） | **L1（非 L3）** | 卡定义 L3 = 删表删列 / 拆并表 / 改主外键语义。这两个对象**在本仓库内零外部引用**，删除即完成，无弃用期需求 |

- **无 🔴 红牌**：没有任何动作需要拆成"先加新 + 双写，再另批删旧"。
- 全部动作可由 `git revert` 回退（§5 末行）。

---

## 7. 改造 vs 重写

**改动面口径**（本设计声明，供复核）：`改动面 = 本任务需改动的行数（增 + 删） ÷ 目标文件现有行数`。现有行数用 `[IO.File]::ReadAllLines().Count`（lesson `数字口径与CRLF` 规定的唯一口径）。

**目标文件 = 3 个"有既有内容且被整份替换"的脚手架文件**：

| 文件 | 现有行数（实测） | 增 | 删 | 改动行数 | 改动面 |
| :-- | --: | --: | --: | --: | --: |
| `src/App.tsx` | 51 | 60 | 33 | 93 | **182 %** |
| `src/App.css` | 111 | 40 | 101 | 141 | **127 %** |
| `src-tauri/src/lib.rs` | 14 | 3 | 12 | 15 | **107 %** |
| **合计** | **176** | **103** | **146** | **249** | **141 %** |

（增删数取自 SCOPE §0 行数账，逐文件核对过；`src/App.tsx`/`App.css`/`lib.rs` 的现有行数为本卡实测。**`App.css` 一行的现有行数由 116 重算为 111**——3-4 卡为过动作 12 的「命中 0」判据删掉了模板自带的 `input,button{outline:none}` 4 行 + 1 空行；`112−10` 的算法不变：整份替换后保留约 10 行 `html/body` 规则。）

**结论：重写**（三票全 ≥40%，且各自 >60%）。两条前置条件**同时成立**（卡内判据要求）：

1. 改动面 **> 60 %** ✓（182 % / 126 % / 107 %，合计 140 %）
2. 旧逻辑**无复用价值** ✓ —— 被替换的是 1-2 卡脚手架演示页：一个 `greet` 输入框 + 回声文本。SCOPE §1 任务复述明确"**不含**"该行为，`docs/registry/COMPONENTS.md:11` 原文已预告整份替换。

**按卡要求交付两样计划：**

**① 等价性证据计划 —— 选 ③ 关键路径手测清单，理由是"无等价物可证"**

```text
为什么不是 ① 旧测试全绿：仓库内不存在任何旧测试文件（git ls-files 实测 0 个 *.test.*），无可跑对象。
为什么不是 ② 快照对比：被删的是一个交互演示（输入框 + 回声），新代码按 SCOPE §1 不复制该行为，
  没有"同一输入应得同一输出"的共同面 —— 快照比的是不存在的东西。
替代证据（③ 关键路径手测清单，4-1 每批收尾逐条走）：
  1. `npm run tauri dev` → 窗口出现、无标题栏、无边框、无白色底板
  2. 窗口外区域能看见桌面图标（不是灰底）
  3. 任务栏无 luoxiaohei 图标
  4. 不动鼠标看 10 s → 呼吸 / 眨眼 / 甩尾三组动作可见且不同步
  5. 鼠标缓慢横移 → 瞳孔跟随；鼠标移到屏幕远端 → 瞳孔回正，无抖动
  6. 点猫身之外的透明区 → 背后桌面图标被选中；点猫身 → 不穿透
  7. 左键按住猫身拖 → 窗口跟随；右键 → 菜单仅一项「退出」；点它 → 进程退出且任务管理器无残留
  8. 上述全部通过后跑 `check.ps1` → 退出码 0（4 条 STEP 各 [OK]）
```

**② 旧实现退役计划**

```text
删除批次：4-1 批次 1（与 M1/M2/M8 同批）
删除条件（可判定）：`git grep -n "greet"` 命中 0 处 且 `git grep -n "opener"` 命中 0 处
是否需并行态登记：否 —— 合法保留理由只有"灰度/回滚带期限 / 对外兼容契约带弃用期 / 证据留存"三种，
  三者皆不成立（无部署、无外部消费者、证据留存的正解是 git 历史）。
  `STATE.md` 并行态登记簿里现有的 `opener` 残留行，其"删除条件 = SCOPE M2 落地"正好由本批次销行。
```

**故意没碰的清单**（`docs/ARCHITECTURE.md` §4 之外，一动不动的既有文件）：`src/main.tsx`、`index.html`、`vite.config.ts`、`tsconfig.json`、`tsconfig.node.json`、`src-tauri/src/main.rs`、`src-tauri/build.rs`、`src/vite-env.d.ts`、`doctor.ps1`、`security.ps1`、`gate.ps1`、`orphans.ps1`、`scripts/nfr.ps1`、`src-tauri/icons/`（全部位图）。

---

## 8. 决策记录

**本轮无新增 `docs/decisions/` 记录。** 卡内要求三要件**同时**成立才写，逐候选核对如下（缺任意一条即不写）：

| 候选 | 难以回退？ | 出人意料？ | 真有权衡？ | 判定 |
| :-- | :-- | :-- | :-- | :-- |
| 「透明区穿透 = 几何纯函数 + 单定时器轮询 `setIgnoreCursorEvents`」 | **否** —— 回退 = 改 2 个文件约 165 行，`git revert` 一步；且 §9 已留升级路径 | 是（透明窗口不会自动让点击穿透，与直觉相反） | 是（60Hz IPC 成本 vs 可恢复性） | **不写**（缺"难以回退"） |
| 「右键菜单用 Tauri 原生菜单而非 HTML 自绘」 | 否（改 1 个 hook） | 是 | 是 | **不写** —— 它不是本轮新决策：SCOPE §7 已定死并附来源（`menu.d.ts` 的 `@remarks`），本轮只是沿用。按 D12 信息阶梯，同一事实不写第二处 |

> 记录落点规矩（供以后重审）：真出现三要件同时成立的决策时，写入 `docs/decisions/`，并在 §9 被否方案里留一行反向指针。

---

## 9. 被否方案

| # | 被否方案 | 否决理由（一行，供以后重审先读） | 日期 |
| :-- | :-- | :-- | :-- |
| 1 | 用 CSS `pointer-events: none` 实现透明区穿透 | CSS 只决定 **DOM** 的事件命中，改不了**窗口**的系统级命中测试；SCOPE §5 M6 要求"点击落到背后的桌面图标"，那由窗口矩形决定，CSS 够不到 | 2026-10-06 |
| 2 | 整窗常开穿透 + 全局热键切回 | 猫身也不可点 → 直接击穿 SCOPE M7 的两条必须项（拖拽移动、右键「退出」） | 2026-10-06 |
| 3 | 给瞳孔跟随与穿透各起一个 60Hz 定时器 | 违反 `docs/ARCHITECTURE.md` §5 第 2 行的模块约束「瞳孔跟随**只允许一个定时器**（60Hz）」；两个定时器 = 120 次/秒 IPC，直接顶 NFR `perf` P1 的空闲 CPU ≤1% | 2026-10-06 |
| 4 | `document.elementFromPoint` 作为唯一命中判据 | 结果依赖渲染器的指针命中语义，无法在 Node 里用 `node --test` 断言；SCOPE §5 M6 的验收命令要的是纯函数。**保留为 4-1 联调期的人工真值对照**（不进产品代码路径） | 2026-10-06 |
| 5 | 方案 B：Rust 侧 `windows` crate 原生命中测试 | **缓，非否**（沿用 2-1 §5 判定，不重议）：仅当 §10 的批次 0 实验证伪"JS 侧可穿透"时升级；引入 `unsafe` 与新依赖，超出本期零新依赖口径 | 2026-10-06 |

---

## 10. 4-1 批次切分（设计给 4-1 的施工图）

依赖序取自 SCOPE §3「可立即开工的前沿 = {M1, M2, M8}，拓扑序 M1/M2/M8 → M3 → M4/M5 → M6/M7」。

| 批次 | 内容 | 新增文件 | 收尾判据 |
| :-- | :-- | :-- | :-- |
| **批次 0** | **A3 最小实验**（回答"透明窗口的透明像素是否本来就自动穿透"）。零新增文件、零产品代码：① 只改 `tauri.conf.json` 六键 + `capabilities` 加 `core:window:allow-set-ignore-cursor-events` ② 跑 `npm run tauri dev` ③ **先在 devtools 里不执行任何 JS**，点透明区看能否选中桌面图标 ④ 若否，在 devtools 手工执行 `window.__TAURI_INTERNALS__.invoke('plugin:window\|set_ignore_cursor_events',{label:'main',value:true})` 再点 | 0 | 结论写回本文件 §10 与本卡回执。**若 ④ 也不穿透 → A3 证伪 → 停，按 §9 第 5 条升级问用户** |
| **批次 1** | M1 + M2 + M8 + 退役清单（§4.3） | `src/tauriConfig.test.ts` | `node --test src/tauriConfig.test.ts` 打印 `window-config OK 6/6` + `acl OK 4/4`；`check.ps1` 退出码 0 |
| **批次 2** | M3 造型 | `src/character/geometry.ts`、`src/character/geometry.test.ts`、`src/character/HeiCat.tsx`、`src/character/heicat.css` | `node --test src/character/geometry.test.ts` 退出码 0 |
| **批次 3** | M4 动画 + M5 跟随 | `src/interaction/gaze.ts`、`src/interaction/gaze.test.ts`、`src/interaction/useCursorFollow.ts`、`src/character/motion.test.ts` | `gaze.test.ts` + `motion.test.ts` 退出码 0 |
| **批次 4** | M6 穿透 + M7 拖拽退出 | `src/interaction/hitTest.ts`、`src/interaction/hitTest.test.ts`、`src/interaction/usePointerPassthrough.ts`、`src/interaction/useDragExit.ts`、`src/interaction/dragExit.test.ts` | 五个测试文件全绿 + §7 的关键路径手测清单 8 条全过 |

- 新增文件合计 **14**（与 §4.2 一致）；累计改动行数触发线仍按 SCOPE §0：`1150 × 1.5 = 1725`，本设计的补登使分母变为 **1242**（见 §12 G1），触发线相应变 **1863**。
- 批次 0 的结论是唯一可能在 4-1 回头改本设计的地方（改 §3.5 的 `usePointerPassthrough` 形态或触发 §9 第 5 条升级）→ §11「演进空间」轴据此扣 1 分。

---

## 11. 动作 9 · 预发六轴自评

| 轴 | 问自己 | 得分 | 依据（为什么是这个分，不是形容词） |
| :-- | :-- | --: | :-- |
| **依据性** | 每条判据能不能指到具体表 / 字段 / 路径 / 命令？ | **5** | 28 条判据全部落在本项目对象上：7 条 IPC 命令名（§3.1，逐条从 `node_modules/@tauri-apps/api/` 读出）、5 条 capability 条目（§3.2）、6 个配置键（§3.4）、6 个模块签名（§3.5）、4 条门禁命令（§3.6）。零条"业界做法" |
| **可逆性** | 出错能不能回退？ | **4** | 无表结构、无持久化、无外部动作（§5/§6）→ 全部 `git revert` 可回退。扣 1 分：批次 0 的 A3 若证伪，升级到方案 B 不是"一键回退"而是另立项 |
| **最小面** | 有没有能不改的东西被改了？ | **3** | 目标文件改动面 **140 %**，远高于该轴 5 分档「改动面 < 40 %」的描述，故不给 4 分；但这 140 % 是"替换脚手架演示页"的必然结果（`COMPONENTS.md:11` 原文已预告），且 §7 末列了 14 项"故意没碰"清单。✅ 无"顺手改"项 |
| **可测性** | 判据能不能被判红？ | **5** | 每条判据都配了可跑命令：5 个 `node --test` 文件、`npm run typecheck`、`npm run test`、`check.ps1`、§7 的 8 条手测、§10 的批次 0 实验。无"看情况""体验流畅"类判据 |
| **一致性** | 与 registry / ARCHITECTURE 是否一致？ | **5** | 逐条核过：`COMPONENTS.md:11`/`:16` 两行的"首个功能会整份替换 / 当前含 greet"与本设计 §4.3 退役清单对得上；`ARCHITECTURE.md` §5 的 7 条模块约束逐条落进 §3.5（单定时器）、§3.2（授权 ≤5、不留未调用授权）、§2（不写用户目录文件）、§4.2（文件分拆 ≤500 行）；`NFR.md` 的 S2/C3/M1/P1 四条阈值被 §3.2/§2/§4.2/§3.5 直接引用 |
| **演进空间** | 4-1 能不能只照本设计做，不再做设计决策？ | **4** | 批次 1~4 可直接照写（文件名、签名、常量、判据全给定）。扣 1 分：批次 0 的实验结论未定，可能要求改 §3.5 里 `usePointerPassthrough` 的形态（或触发 §9 第 5 条升级） |

**总分 26 / 30 ｜ 无任一轴 < 3 → 不触发修订轮（本轮为第 1 轮）。**

---

## 12. 对 SCOPE 的偏差登记（本设计发现的 2 处，逐条给事实）

| # | 缺口 | 事实（可核） | 本设计的处置 |
| :-- | :-- | :-- | :-- |
| **G1** | SCOPE §5 M3 的验收命令写 `node --test src/character/geometry.test.ts`，但 §0 行数账（该文件 L13-L24）里没有 `geometry.ts` 与 `geometry.test.ts` 两行 | 照 SCOPE 直接开工 → 验收命令指向不存在的文件。且 `src/interaction/hitTest.ts` 需要猫身几何做粗筛，几何常量必须住在**非 JSX 文件**里（D14① 纯逻辑与副作用分文件） | §4.2 补两行待建（`geometry.ts` 约 40 行 + `geometry.test.ts` 约 45 行）；SCOPE §0 行数账同批加一行勘误指针；分母 `1150 → 1242`，范围蔓延触发线 `1725 → 1863` |
| **G2** | SCOPE §0 行数账把 `check.ps1 + package.json` 合成一行给 `13 增 / 3 删`，没写 `package.json` 具体加什么 | 实测 `package.json` 现有 script 只有 `dev`/`build`/`preview`/`tauri` 四个，没有 `typecheck`/`test`；不补则 M8 的 `$STEPS` 前两条命令不存在 | §3.6 钉死两条 script 原文与 `$STEPS` 数组原文，含新增的 1 个 devDependency `@types/node`（用户 2026-10-06 裁决允许） |

> 两处都不改变 SCOPE 的需求边界（Must/Should/Won't 一条未动），只补齐"实现对象清单"，故不触发 SCOPE 重新确认。

**SCOPE §0 行数账勘误（同批写入，仅此一行）**

```text
> 勘误（2026-10-06 · 3-1 卡）：本账漏登 `src/character/geometry.ts`（约 40 行）与 `src/character/geometry.test.ts`（约 45 行）——
> 见 `DESIGN.md` §12 G1。补登后分母 = 1242，范围蔓延触发线 = 1863（原 1150 / 1725）。
```

---

## 13. 设计通过四证核对（本卡 §② 原文逐条）

| 证 | 卡内判据原文 | 本设计的状态 | 证据位置 |
| :-- | :-- | :-- | :-- |
| **①** | DATA_DICT diff 每行都标了敏感度 D1~D4 | **满足**（本项目无表结构 → 以 §2 的 5 行「数据清单」代替，每行标了敏感度；`DATA_DICT.md` 按该文件第 5 行自述保持原样） | §2 D-a ~ D-e |
| **②** | APIS 每行都含错误码与鉴权列 | **满足** | §3.1 七行，每行两列齐；错误码定义见 §3.2/§3.3，已同批登记 `docs/registry/APIS.md` |
| **③** | 组件影响清单已列出（含"待建行"标注） | **满足** | §4.1 六行改动 + §4.2 十四行"待建行" |
| **④** | down 由人本地空跑通过，输出已贴回（无表结构 → 写 N/A，并在 `## ④ 状态回写` 的 `裁剪记录` 写依据） | **N/A**（无表结构） | §5 + `STATE.md` 裁剪记录 |

**动作 10 自查**

- 命令原文 = 3-1 卡 §② 动作 10 的代码块，**本文件不复制它**：该命令的判据里含三个禁用词字面量，抄进本文件会让本文件被自己判红（自指误报——同 2-4 卡 `NFR.md` §5 踩过的那一类）。
- 自查对象正是本文件（九节齐备 + 禁用词零命中 + 变量名全 ASCII）；退出码 0 的完整输出贴在 3-1 卡的 ③ 证据回执第 10 项。
