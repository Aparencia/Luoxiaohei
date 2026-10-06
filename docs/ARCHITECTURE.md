# ARCHITECTURE · 架构总览（≤150 行；agent 写代码前必读）
> 最近核对 2026-10-06 @ 2c5da3e（3-7 架构定义卡补齐 §6~§8）
> 本文件回答六件事：系统由什么组成 / 数据怎么流 / 新代码放哪 / **边界画在哪** / **谁关注什么** / **拿什么换什么**。
> 模块结构变了必须更新本文件（归档卡会查）。改不动上限 = 该拆模块了。
> **怎么填**：每处 `<…>` 都标了"由哪张卡的哪个动作填"——**2026-10-06 已全部填实**（3-7 卡补齐 §6~§8），改本文件时保持同一粒度。
> 一旦要改，就改得"照着念能复现"：目录写真实相对路径，框架写真实名字（版本以 `.tool-versions` 为准）。
> §6~§8 是 **3-7 架构定义卡**的产物（项目首次成型 / 结构变更时走）；§1~§5 是更早就在用的部分。两者不重复：§1~§5 讲"长什么样"，§6~§8 讲"为什么长这样"。

## 1. 模块图（1-2 卡选型确定后画；mermaid 语法可直接渲染）

```mermaid
graph TD
    SHELL["Tauri 外壳 src-tauri/（Rust：窗口与进程）"]
    WEB["WebView2 运行时（系统提供，不打包）"]
    UI["界面层 src/（React 19 + TypeScript）"]
    SHELL -->|"创建窗口 / 加载前端"| WEB
    WEB -->|"渲染 index.html → src/main.tsx"| UI
    UI -.->|"invoke() 窗口控制（首个功能才实现）"| SHELL
```

- 本项目**无后端、无数据库、无第三方服务**，按「删比留空准」已删除 API / DB / EXT 三行。
- 图中**实线 = 运行时承载**（谁加载谁：外壳层 → WebView2 → 界面层，是一棵树），**虚线 = 依赖**（界面层 → 外壳层的命令契约）：依赖只有这一个方向——判据：换掉界面层不必改外壳层，反之必须同批改命令名与授权。禁双向、禁环、禁跨层。

## 2. 分层说明（1-2 卡定目录时逐行填；每层一行：放什么）

| 层 | 目录 | 放什么 |
| :-- | :-- | :-- |
| 外壳层 | src-tauri/ | Tauri 配置 `src-tauri/tauri.conf.json`、Rust 入口 `src-tauri/src/main.rs` 与逻辑入口 `src-tauri/src/lib.rs`、窗口控制命令；**唯一碰操作系统 API 的地方** |
| 界面层 | src/ | React 组件、样式、角色渲染与动画（当前只有脚手架演示页 `src/App.tsx`，挂载点 `src/main.tsx`） |
| 静态资源 | public/ | 构建期原样拷贝到产物根的静态素材 |

- 本项目已合并掉接口层 / 数据层：无服务端、无数据库，故两行按「删比留空准」删除。
- **路径一律写全**：本文件写裸文件名（如只写 `main.rs`）会被 `orphans.ps1` 判为「文档幽灵」——搜索词要能一次命中真实文件。

## 3. 数据流（3-1 卡定；两条真实链路，逐行都是本项目的名字）

**链路 A · 光标跟随与透明区穿透（每 16.7 ms 一次，全项目唯一的定时器）**

1. `src/interaction/useCursorFollow.ts` 的 `setInterval` 触发 → `invoke('plugin:window|cursor_position')`（无参数，返回 `{x,y}` 或 `null`）→ 得到 `cursorScreen`
2. 同一个 tick 内：`gazeAngle(dx, dy)`（`src/interaction/gaze.ts`）算出 `gazeDeg`；`screenToViewport()` + `isOverCharacter()`（`src/interaction/hitTest.ts`，几何取自 `src/character/geometry.ts` 的 `CAT_GEOMETRY`）算出 `overCharacter`
3. 写回界面层：`gazeDeg` 变化才写进 CSS 自定义属性驱动瞳孔；`overCharacter` 在**翻转时**才 `invoke('plugin:window|set_ignore_cursor_events', {label, value})`
4. 失败分支：`cursor_position` 返回 `null` → 瞳孔回正 0°、穿透开关保持上一次取值（错误码 `E-IPC-02`，见 `docs/registry/APIS.md`）

**链路 B · 用户操作（事件驱动，无轮询）**

1. 左键 `mousedown` 命中猫身 → `useDragExit.onMouseDown` → `invoke('plugin:window|start_dragging', {label:'main'})`（阻塞式，SCOPE U4）
2. 右键 `contextmenu` → `Menu.new()` + `MenuItem.new('退出')`（`plugin:menu|new`）→ `popup()`（`plugin:menu|popup`）
3. 菜单项 onClick → `invoke('plugin:window|close', {label:'main'})` → 窗口关闭、进程退出
4. 失败分支：ACL 未授权 → Promise reject → `console.error` 打 `E-IPC-01`，**功能失效由门禁拦**（`src/tauriConfig.test.ts` 的 `acl OK 4/4`），不靠运行时兜底

- 本项目**无数据层、无接口层**：链路里没有数据库读写、没有 HTTP 往返。全部状态是进程内瞬时值（`docs/specs/2026-10-06_desktop-pet/DESIGN.md` §2）。

## 4. 新代码落点表（3-1 卡定方案时填；新建文件前必查，找不到就问，禁止乱放）

| 改动类型 | 放哪 |
| :-- | :-- |
| 角色渲染与动画（SVG 组件 / 几何常量 / keyframes 样式） | `src/character/`（**3-1 卡定名**：`HeiCat.tsx` / `geometry.ts` / `heicat.css`；动画一律合成层属性） |
| 交互逻辑与 hook（抽样、命中、拖拽退出） | `src/interaction/`（**3-1 卡定名**：纯函数 `gaze.ts` / `hitTest.ts` 与 hook 分文件；纯函数不得 import `.tsx`） |
| 装配层（把角色与 hook 拼起来） | `src/App.tsx`（唯一装配点；hook 的返回值为参数传给下一个 hook，不许各自直连全局） |
| 新窗口控制命令（Rust） | `src-tauri/src/`（命令注册进 `src-tauri/src/lib.rs`） |
| 新静态素材 | `public/`（**本项目禁止入库任何位图形象素材**，NFR `security` S5：入库的官方素材数 = 0） |
| 新脚本 / 工具 | `scripts/`（**2026-10-06 已建立**；2-4 卡登记第 1 个：`scripts/nfr.ps1` = 六维非功能阈值的检查命令，`-Check <perf\|capacity\|availability\|security\|maintainability\|compat\|all>`；新脚本一律先在此登记再落盘） |
| 窗口 / 打包配置 | `src-tauri/tauri.conf.json`（3-1 卡定下 6 个键的终值，见 `DESIGN.md` §3.4） |
| 能力授权 | `src-tauri/capabilities/default.json`（3-1 卡定下 5 条，上限也是 5；加授权必须同批加调用方，删调用方必须同批删授权） |
| 测试文件 | 与被测模块同目录、同名前缀（`*.test.ts`），由 `node --test "src/**/*.test.ts"` 收集 |
| 环境变量 | `.env`（真实值）/ `.env.example`（键名）——本项目当前无需任何环境变量 |

- 已删除两行（无对应物）：「新接口」「新表/字段」——本项目无服务端、无数据库。

## 5. 非功能需求与威胁建模落点（2-4 / 3-2 卡产物；先定阈值与威胁，再写代码）

| 要落的东西 | 产物路径 | 谁写（卡号） | 什么时候写 | 验证方式（必须可测） |
| :-- | :-- | :-- | :-- | :-- |
| 非功能需求：性能 / 容量 / 可用性 / 安全 / 可维护 / 兼容 | `docs/specs/<日期>_<slug>/NFR.md`；受影响的模块约束回写本文件 §1~§4 | 2-4 卡（阈值由用户确认） | 范围确认后、动代码前 | 每条给「可测阈值 + 验证方式」（跑什么命令、看哪个指标）；给不出阈值写 `N/A（理由）`，不许留空 |
| 威胁建模：资产 / 入口 / 信任边界 / STRIDE 六类 | `docs/specs/<日期>_<slug>/THREAT.md` | 3-2 卡（触碰认证、支付、删数据、外部接口时必走） | 设计批准前 | 每条威胁给缓解措施，或显式接受并写理由；新发现的红线域改动进 SCOPE 并升 L 档 |
| 架构约束：模块边界、依赖方向、新代码落点 | 本文件 §1~§4 | 3-1 卡 | 方案确定时 | 写代码前先读本文件；越界与平行新建由 4-2 卡判红 |

- 回写时机：`NFR.md` 定了阈值，同批把受影响的约束写进本文件 §1~§4，并核对 `.tool-versions` 的版本能否满足（例：要求 Node 22 而锁的是 18 → 先改锁定文件再写代码）。
- 不适用时怎么写：某一类确实没有（如纯本地脚本无可用性要求）→ 在 `NFR.md` / `THREAT.md` 对应行写 `N/A（理由）`，理由要能判定，不许留空行。

**2-4 卡定下的模块约束（阈值里"约束了模块怎么做"的行，逐条回写在此；改阈值必须同批改这里）：**

| 约束 | 来自哪一维/哪条阈值 | 落到哪个模块 |
| :-- | :-- | :-- |
| 角色动画只能走**合成层**（`transform` / `opacity`），禁止动画属性触发 layout（`width`/`top`/`left` 之类） | 性能 `perf` 空闲 CPU ≤1%（单核） | 界面层 `src/character/heicat.css` |
| 瞳孔跟随**只允许一个定时器**（60Hz），且仅在数值变化时写 DOM/属性；禁止 `requestAnimationFrame` 全帧重绘 | 性能 `perf` 空闲 CPU ≤1% + 兼容 `compat` | 界面层 `src/interaction/useCursorFollow.ts` |
| 外壳层**不得引入任何网络相关插件/依赖**（`reqwest`、`tauri-plugin-http` 等）；`capabilities/default.json` 授权条目 ≤5 条 | 安全 `security` 零外联 + 最小权限 | 外壳层 `src-tauri/` |
| capability 里**不得保留未被调用的授权**；删授权必须同批删对应的插件注册与 npm 包 | 安全 `security` 最小权限 | `src-tauri/capabilities/default.json`、`src-tauri/src/lib.rs`、`src-tauri/Cargo.toml` |
| 不得使用 WebView2 在 Windows 10 1809 上不支持的特性（本机是 154，但目标下限是 1809 随附版本） | 兼容 `compat` Windows build ≥17763 | 界面层 `src/` |
| 单文件 ≤500 行（测试文件 ≤1000 行）→ 角色、动画样式、交互 hook 必须分文件，禁止堆进 `src/App.tsx` | 可维护 `maintainability` | 界面层 `src/` |
| 应用**不写任何用户目录文件**（不建日志、不建缓存）；若启用 SCOPE S1「位置记忆」，只允许 `localStorage` 一个坐标 | 容量 `capacity` + 安全 `security` | 界面层 `src/interaction/useDragExit.ts` |

**3-1 卡定下的模块约束（设计批准后生效；4-2 代码审查按此复核）：**

| 约束 | 来自 | 落到哪个模块 |
| :-- | :-- | :-- |
| 全项目**只允许一个** 60Hz 定时器；`usePointerPassthrough` 不得自采样，只能消费 `useCursorFollow` 的同一 tick | ARCHITECTURE §5（2-4）+ NFR `perf` P1 | `src/interaction/useCursorFollow.ts`、`src/interaction/usePointerPassthrough.ts` |
| 60Hz 链路上的 IPC **只在值翻转时**调用（`set_ignore_cursor_events` 于 `overCharacter` 翻转时；瞳孔属性于角度变化时），不得逐帧无条件 invoke | NFR `perf` P1 空闲 CPU ≤1% | 同上两个 hook |
| 纯函数（`gaze.ts` / `hitTest.ts`）**不得 import `.tsx`**；几何常量必须住在非 JSX 文件，供纯逻辑与测试共用 | D14① 纯逻辑与副作用分文件 | `src/character/geometry.ts` → `src/interaction/hitTest.ts` |
| 每条 IPC 调用的失败分支必须显式处理，错误码取 APIS.md 的 `E-IPC-01/02/03`；**禁空 catch、禁静默吞错** | D14④ 防御 | `src/interaction/*.ts` |
| capability 授权条目与代码里的实际调用**必须一一对应**（既有 ≤5 条上限，也有"不留未被调用的授权"下限） | NFR `security` S2 | `src-tauri/capabilities/default.json` ↔ `src/interaction/` |

## 6. 边界与上下文视图（3-7 卡动作 1、3）
### 边界三问
- **这是什么**（≤40 字）：桌面上养的一只小黑猫——它会动、会看你、不挡你干活。
- **不做什么**（≥3 条）：① 养成与数值成长——**最容易被顺手加进来的那一条**，一有"猫"就会想加喂食 / 心情 / 等级（SCOPE W1）② 联网：更新检查 / 遥测 / 云同步 / 素材商店（W5、W10）③ 跨平台（W6）④ 写用户目录任何文件，日志与缓存都不建（NFR `capacity` C3）⑤ 驻留后台：无托盘、无开机自启，退出即进程消失（W4、W7）
- **外面有什么**（谁主动谁被动）：① 用户（人，**主动**）② 桌面与鼠标（系统，**被动被读**：全局光标屏幕坐标）③ 显示器 / DPI 子系统（系统，**被动**：缩放比与显示器边界）④ 无外部服务、无第二进程、无定时任务
### 上下文视图（三条线全是**入边**：本系统不发起任何对外调用、不接收网络输入）
```mermaid
graph LR
    CAT["猫窗口 main（本系统：唯一进程、唯一窗口）"]
    USER["用户（人）"] -->|"左键 / 右键 / 拖拽"| CAT
    DESK["桌面与鼠标（系统）"] -->|"全局光标坐标（只读）"| CAT
    MON["显示器 / DPI 子系统（系统）"] -->|"scaleFactor、显示器边界"| CAT
```

## 7. 干系人与关注点（3-7 卡动作 2；没视图认领的关注点 = 没做）

| 干系人 | 关注点（他到底担心什么） | 由哪个视图回答 |
| :-- | :-- | :-- |
| 用户（桌面前的人） | 打开就能看到猫吗 / 会不会挡我点桌面图标 / 怎么让它走 | §6 上下文视图 + §8 运行时视图 R1~R2 |
| 未来的我（改代码的人） | 改一处动画要动几个文件 / 加个功能会不会塌 | §1 模块图（依赖方向）+ §8 权衡记录 |
| 运维的我 | 挂了怎么知道 / 有没有东西要备份 | §8 数据视图 + §5 观测落点行 |
| 下一个 agent | 从哪开始读 / 哪些是禁区 | §6 不做什么 + §4 落点表 + §8 演化口子 |

## 8. 运行时 / 数据视图 · 质量属性场景与权衡（3-7 卡动作 3~6；阈值不许自己编）
### 运行时视图（3 条关键场景 + 1 条失败路径；逐步命令见 §3 链路 A/B，本表只写"落在哪个组件"）
- R1 启动到猫可见：双击 exe → 外壳层建 260×300 透明置顶窗 → 加载 `index.html` → 界面层挂载角色并起唯一 60 Hz 定时器 → 首帧可见
- R2 光标跟随与穿透翻转（全项目唯一的周期动作）：鼠标移动 → 界面层定时器读一次全局坐标 → 纯函数算瞳孔角度与命中 → **值翻转时**才写 DOM / 调穿透命令 → 点击落到桌面
- R3 拖拽与退出：左键按住猫身 → 外壳层进入系统拖拽（阻塞式）→ 松开停住；右键 → 原生菜单「退出」→ 外壳层关窗、进程退出
- R4 **失败路径**（取不到坐标 / 授权未开）：坐标 `null` → 瞳孔回正 0°、穿透保持上一次取值（`E-IPC-02`）；ACL 拒绝 → 无运行时兜底，由门禁用例 `acl OK 4/4` 拦在合并前（`E-IPC-01`）
### 数据视图（数据住哪 / 谁是事实源 / 副本 / 备份恢复粒度）
- 瞳孔角度、命中状态、穿透开关 → WebView 进程内存；事实源 = 界面层 hook 的 state；副本 0 份；关窗即失、重开回默认（`DESIGN.md` §2）
- 窗口位置与尺寸 → Windows 窗口管理器，系统是事实源；本进程只在启动时给一次初值；重启回初值（S1 位置记忆本期不做）
- 落盘的用户数据 = **无**：写入用户目录文件数 = 0（NFR `capacity` C3）；无备份对象
### 质量属性场景（≤5 条，每条三要素齐全；度量逐字取自 `NFR.md`）
- 性能：刺激 = 不碰鼠标静置 ≥60 s → 响应 = 唯一 60 Hz 定时器只在值翻转时写 DOM → 度量 = 空闲 CPU ≤ 1.0 %（单核，perf **P1**）
- 可用性：刺激 = 连续启动 / 退出 100 次 → 响应 = 每次窗口都出现、都干净退出、不残留进程 → 度量 = 失败次数 = 0（availability **A2**）
- 安全：刺激 = 应用运行中按进程树查连接 → 响应 = 不发起任何对外调用 → 度量 = 出站 `ESTABLISHED` = 0 条、监听端口 = 0 个（security **S1**）
- 容量：刺激 = 连续运行 8 h 并反复拖拽 → 响应 = 不写用户目录任何文件、工作集不增长 → 度量 = 增长 ≤ 5 MB（availability **A1**）+ 写入文件数 = 0（capacity **C3**）
- 兼容：刺激 = 系统缩放在 100 / 125 / 150 / 200 % 间切换 → 响应 = 每帧用 `currentMonitor()` 的 `scaleFactor` 换算 → 度量 = 窗口宽度仍 260 逻辑像素、边角清晰（compat **K3**）
### 权衡记录（每条一行：`选了 X ｜ 换来 Y ｜ 代价 Z ｜ 什么时候翻案`）
- 透明区穿透靠"每 tick 算命中、只在翻转时切穿透" ｜ 换来 猫身可点、透明区能点到桌面图标（用户 Q1 要的） ｜ 代价 常驻一个 60 Hz 定时器，空闲 CPU 不再为 0 % ｜ 翻案 实测空闲 CPU > 1.0 %（P1 红）→ 降到 30 Hz 或改窗口事件驱动
- 角色由自绘 SVG + CSS keyframes 表达 ｜ 换来 零素材、零新依赖、devtools 里可逐节点核对 ｜ 代价 造型精度受手写路径限制，"像不像"只能到"可辨认"线（SCOPE §10 Q2） ｜ 翻案 你目视判"认不出"→ 回 2-6 重审载体（W14 需先解禁）
- 不写任何用户目录文件（含日志） ｜ 换来 零清理、零隐私面，C3 / S4 直接达标 ｜ 代价 出问题没有本地日志，只能靠 devtools 与事件查看器 ｜ 翻案 4-3 或 6-1 出现定位不了的现场故障 → 另立项加最小日志并同批改 C3 阈值
### 演化口子与设计边界（现在不做、以后要做时改哪一处，不许写"以后再说"）
- 以后要做 S1 位置记忆 → 只改 `src/interaction/useDragExit.ts`（加一个 `localStorage` 键，C3 已留 ≤1 KB 口子），外壳层零改动
- 以后要做多角色 / 角色包（现 W2）→ 在 `src/character/` 下加 `characters/<id>/`，`src/App.tsx` 按 id 选角色，外壳层零改动
- 以后要做多显示器各放一只（现 W11）→ 只改外壳层 `src-tauri/src/lib.rs`（按 `available_monitors()` 建 N 个窗口），界面层零改动
- 与设计的边界 + 决策留痕：本文件答"系统是什么"（半年不变），`DESIGN.md` 答"这次怎么做"（这次变），两份不重复同一段正文；本轮**不新增** `docs/decisions/` 记录——三条权衡都可就地回退，原生菜单 / SVG 载体两条已留在 SCOPE §7、其余在 `DESIGN.md` §9，不同时满足"难以回退 + 出人意料 + 真有权衡"三要件。
