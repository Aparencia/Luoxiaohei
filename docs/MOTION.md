# MOTION · 动效与微交互（Motion and Micro-interactions；3-6 卡产物；≤100 行）
> 产物寿命：**持久（进仓库）** ｜ 最近核对 2026-10-06 @ 657bbc7（3-6 卡开工锚点；本文件所在提交见 `STATE.md` 的最近完成）
> 谁写：3-6 动效与微交互 ｜ 谁读：4-1 每批编码、4-2 代码审查、4-3 行为验收、7-1 UI 改动 ｜ 何时更新：加或改动效、改时长/缓动、改降级口径时
> 上游：`SCOPE.md` §5 M4/M5 + §7 ｜ `DESIGN.md` §3.5（`useCursorFollow` = 唯一 60Hz 定时器持有者）｜ `docs/UI.md` §2/§4/§7/§9 ｜ `NFR.md` P1（空闲 CPU ≤1%）/ P3（60Hz ±5%）
> 本项目口径：**零 HTML 控件、零路由、零表单、零 Toast、零骨架屏**；真动效只有三条（呼吸 / 眨眼 / 甩尾），全部落在 `src/character/heicat.css` 的 `@keyframes`（SCOPE §7 定死 SVG + CSS，不引 Canvas）。

## 1. 时长表六类（卡内基准 → 本项目落点；每条理由可核）
| 类别（卡内基准） | 落点 | 理由（本项目事实） |
| :-- | :-- | :-- |
| hover（100ms） | 0ms | `docs/UI.md` §9 hover 行：**猫不是控件**——悬停不改任何样式；加 hover 就把"活摆件"变成"按钮"，且悬停不改穿透判定（穿透由 M6 几何纯函数决定） |
| press（50–120ms） | 0ms | `docs/UI.md` §9 active 行：mousedown 立即 `plugin:window\|start_dragging`，此后鼠标事件被 OS 拖拽循环接管、WebView 收不到 mouseup——按下态由系统绘制，我们不画 |
| enter（200–300ms） | 0ms | 唯一界面是窗口本体，进场由 `transparent:true` 决定（`docs/UI.md` §2 S2：首帧前就已透明）；给窗口加淡入会与 SCOPE S3「首帧无白闪」打架 |
| exit（进场的 60–75%） | 0ms | 退场 = `plugin:window\|close`（SCOPE M7）：进程退出由 OS 关窗，没有可过渡的存活帧 |
| page（200–300ms） | 0ms | `SCOPE.md` §7 页面级：一个窗口、一个页面、无路由——没有"下一页"可转 |
| skeleton（1200ms） | 0ms | `docs/UI.md` §2 S2：**不画骨架屏**（摆件没有"可预测形状"的内容）；1200ms 循环在本项目零作用对象 |
## 2. 真动画三条（取值即 SCOPE §5 M4 的断言值；`motion.test.ts` 按文本解析 `heicat.css` 上的这四个数字，不许改）
| 动画 | 载体与声明（4-1 照写） | 时长 | 缓动 | 幅度 |
| :-- | :-- | :-- | :-- | :-- |
| 呼吸 | `#body` 的 `scaleY`（`transform-origin` 在腹部底端）：`animation: breathe 3200ms cubic-bezier(0.2, 0, 0, 1) infinite`，关键帧 0% / 50% / 100% | 周期 **3.2s**（±0.2） | 标准 | 1.00 → 1.03 → 1.00 |
| 眨眼 | 眼睑 `path` 的 `scaleY`（默认 `scaleY(0)` 不可见）：`animation: blink 4000ms cubic-bezier(0.2, 0, 0, 1) infinite`，关键帧 0% / 1.25% / 2.5% / 100% | 单次 **100ms**（上界 ≤100ms）；闭合 **50ms**（上界 ≤80ms）；间隔 3900ms | 标准 | 0 → 1 → 0 |
| 甩尾 | 尾巴 `path` 的 `rotate`（`transform-origin` 在尾根）：`animation: tailSway 2400ms cubic-bezier(0.2, 0, 0, 1) infinite`，关键帧 0% / 25% / 75% / 100% | 周期 **2.4s**（±0.2） | 标准 | 0° → −8° → +8° → 0°（±8° ±1°） |
- 眨眼为什么不用 `animation-delay` 做 4s 间隔：`delay` 只在首次迭代前生效、迭代之间不重复；不新增定时器（`DESIGN.md` §3.5 单定时器约束）的唯一写法 = 把一个 4s 周期写成"3.9s 的 `scaleY(0)` 平台 + 100ms 往返"，`motion.test.ts` 的推导式 = 2.5% × 4000ms = 100ms（单次）、1.25% × 4000ms = 50ms（闭合）。首末关键帧必须等于元素静态姿态（1.00 / 0 / `scaleY(0)`）：`reduce` 分支 `iteration-count: 1` 播完回落到基础样式，首末帧不中性就会跳变。

## 3. 缓动四条（只用这四条；`ease` 与默认 `ease-in-out` 禁用；焦点环不用缓动，0ms 出现）
| 名称 | cubic-bezier | 用在哪（本项目落点） |
| :-- | :-- | :-- |
| 标准 standard | `cubic-bezier(0.2, 0, 0, 1)` | 呼吸 / 眨眼 / 甩尾三条（尺寸变化与往返旋转）——本项目唯一在用的曲线 |
| 减速 decelerate | `cubic-bezier(0, 0, 0.2, 1)` | 进场（快起步、慢收尾）——本项目零进场（§1 enter 行）；登记给 4-1 引入 HTML 控件时 |
| 加速 accelerate | `cubic-bezier(0.4, 0, 1, 1)` | 退场（慢起步、快离开）——本项目零退场（§1 exit 行）；同上登记 |
| 强调 emphasized | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 一次性成功反馈——本项目零反馈面（`docs/UI.md` §2 S4「反馈即结果」）；**禁用于状态切换**（回弹 = 判失败） |

## 4. 按钮动效选项六种（本项目零 HTML 按钮：逐行给 N/A 理由 + 保留一行 CSS 供 4-1 引入控件时取数）
| 选项 | 适用场景 | 时长 / 缓动 | 一行 CSS | 禁忌 | 本项目落点 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| B1 按下缩放 | 所有可点元素的基础按下反馈 | 80–120ms 标准 | `.btn:active{transform:scale(.97)}` | 缩到 0.95 以下像塌陷 | `N/A`（零 HTML 按钮；唯一可点对象是原生菜单项，按下态由 Windows 绘制） |
| B2 悬停抬升 | 卡片式入口 | 150–200ms 标准 | `.btn:hover{transform:translateY(-1px)}` | 抬升超 2px 会晃；列表行内禁用 | `N/A`（`docs/UI.md` §9 hover 行：猫不是控件） |
| B3 颜色阶跃 | 次级 / 纯文字按钮 | 100ms 标准 | `.btn:hover{background:var(--color-brand-700)}` | 按下后回不到原色 | `N/A`（零按钮，无底色可换） |
| B4 涟漪扩散 | 移动端 / 触屏主操作 | 200ms 减速 | `.ripple{animation:ripple 200ms cubic-bezier(0, 0, 0.2, 1)}` | 桌面端禁用（鼠标没有触点） | `N/A`（`docs/UI.md` §10②③：桌面指针设备，无触控目标） |
| B5 图标位移 | 带箭头的「下一步」 | 150ms 标准 | `.btn:hover .icon{transform:translateX(2px)}` | 位移超 4px 会挤出按钮 | `N/A`（零图标库、零按钮，`docs/UI.md` §11 图标行） |
| B6 不动 | 表格行内 / 批量操作 / 低端机 | 0ms 无缓动 | `.btn{transition:none}` | 拿"无动效"跳过 B1（按下必须有反馈） | `N/A`（无按钮可"不动"；若 4-1 引入 HTML 控件，尺寸取 `docs/UI.md` §4） |

## 5. 微交互十项（触发 → 表现 → 时长；逐项给 N/A 理由，理由可核）
| 微交互 | 触发 | 表现 | 时长 |
| :-- | :-- | :-- | :-- |
| 悬停 | 指针进入猫身 | `N/A`（`docs/UI.md` §9：悬停不改任何样式） | 0ms |
| 按下 | 左键按下猫身 | 按下态由 OS 拖拽循环绘制（`start_dragging` 后 WebView 收不到 mouseup） | 0ms |
| 聚焦环 | 键盘 Tab | `outline: 2px solid var(--color-focus); outline-offset: 2px;` + 静止态预留 `outline: 2px solid transparent` 防几何跳变；禁 `box-shadow` 冒充；`--color-focus` = `#2563EB`（3-5 已落 `docs/DESIGN_TOKENS.md` §2：对纯白桌面 5.17:1、对纯黑桌面 4.06:1） | 0ms（瞬时，禁渐显） |
| 按钮内加载 | 点击后请求中 | `N/A`（零按钮、零请求：W5 零联网，无 fetch） | 0ms |
| 骨架屏 | 首屏请求发出 | `N/A`（`docs/UI.md` §2 S2：不画骨架屏） | 0ms |
| Toast 进出 | 写操作返回 | `N/A`（`docs/UI.md` §2 S3/S4/S5：反馈只有"发生了 / 没发生"，Toast 会破 M1 的透明无边框） | 0ms |
| 列表增删 | 提交或删除成功 | `N/A`（零列表：整窗只有一只 SVG 猫） | 0ms |
| 折叠展开 | 点击标题 | `N/A`（零可折叠区、零标题） | 0ms |
| 数字变化 | 数值更新 | `N/A`（`docs/UI.md` §11：摆件不显示任何数字） | 0ms |
| 成功打勾 | 保存成功 | `N/A`（`docs/UI.md` §2 S4：零绿色勾，反馈即结果） | 0ms |
| 交互五态（`docs/UI.md` §9） | — | default = §2 三条动画（唯一真动效）；hover / focus / disabled = `N/A`（猫不是控件 / 零可聚焦 DOM / 无禁用语义）；active = 0ms（按下即 `start_dragging`，OS 绘制） | — |

## 6. 三条动画的手动复现（触发 → 该看到什么 → 复位）与复现结果
1. 呼吸：静置 10s 不动鼠标 → 躯干以约 3.2s 一个完整往返缓慢起伏（幅度 3%，眼白与瞳孔位置不变）→ 复位 = 右键「退出」关窗即停，重启从 0% 帧重来。
2. 眨眼：同上静置盯眼睑约 4s → 一次 ≤100ms 的开合（肉眼是"一瞬"），约每 4s 一次，与呼吸 / 甩尾不同步（三周期 3200 / 2400 / 4000ms 的最小公倍数 = 48.0s，见 §7 命令输出）→ 复位 = 无需操作，一次播完自动回到 `scaleY(0)`；拖拽打断后动画照常。
3. 甩尾：静置看尾根 → 尾巴以约 2.4s 周期在 −8° ~ +8° 往返，尾尖线位移 = 2·r·sin(4°)（r = 尾长，由 `geometry.ts` 定）→ 复位 = 关窗即停；`reduce` 下停在 0° 中性位。
- **复现结果 = 无 GUI 实测**（D4 防幻觉三查）：① `Test-Path src/character/heicat.css` 实测 `False`——该文件 4-1 批次 3 才建，本轮没有被观察对象；② 本环境无法稳定驻留 agent 派生的 GUI 进程（`STATE.md` 风险摘要 ⑦：同一条命令下一次活过 60s、一次第 5 秒退出），驻留本身不可复现；③ 因此不写"已检查、不闪"——复现动作留给 **4-1 批次 0（与 A3 实验同场）与 4-3 行为验收**（`TESTPLAN.md` 端点清单 + `VERIFY.md`），现在能跑的替代证据 = §7 的 60Hz 帧表（真实命令输出）+ §2 四值与 SCOPE §5 M4 断言逐条对应 + 卡内动作 9 自查退出码 0。

## 7. 60Hz 帧数换算（帧长 = 1000/60 = 16.6667ms；下表数字由本卡命令真实输出，命令与输出见 3-6 回执）
| 量 | 冻结值 | 帧数 | 回代校验 |
| :-- | :-- | :-- | :-- |
| 呼吸周期 | 3200ms | 192.000 → 192 帧 | 回代 3200.0000ms |
| 甩尾周期 | 2400ms | 144.000 → 144 帧 | 回代 2400.0000ms |
| 眨眼单次上界 | 100ms | 6.000 → 6 帧 | 回代 100.0000ms |
| 眨眼闭合上界 | 80ms | 4.800 → 5 帧 | 回代 83.3333ms |
| 眨眼间隔 | 3900ms | 234.000 → 234 帧 | 回代 3900.0000ms |
| 60Hz 采样带（NFR P3） | 16.7ms ± 0.8ms | — | 允许 15.8333 ~ 17.5000ms |

## 8. 降级两条（缺一条 = 本卡未完成）
- 正向前置：三条 `@keyframes` 与 `animation` 声明**只写在** `@media (prefers-reduced-motion: no-preference) { … }` 内——只写 `reduce` 分支会漏掉将来内联样式或第三方组件里的动效。
- `reduce` 分支（本项目实例，4-1 批次 3 已照写并按实测**修正两处**）：`@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 150ms !important; animation-iteration-count: 1 !important; transition-duration: 150ms !important; scroll-behavior: auto !important; } #body, .hei-tail { transform: none !important; } .hei-eyelid { transform: scaleY(0) !important; } }`——循环**真停**（`iteration-count: 1` 是卡的兜底；`transform` 上的 author `!important` 按层叠序胜过动画原点，三条直接停在静态姿态）；位移 / 缩放 / 旋转**塌缩为静止**（不换透明度：这三条不承载任何状态，换透明度反而新增一个闪烁源）。**两处与卡内模板原文的必要偏离**（4-1 批次 3 实测，选择器以 `src/character/heicat.css` 为准）：① 选择器必须写本项目真实的类名——模板原文的 `.eyelid` / `.tail` 在本项目**不存在**，照抄等于没选中；② 眼睑的静态姿态是 `scaleY(0)` 而**不是** `none`——写成 `none` 会让眼睑铺满整只眼，即"减少动效"的用户永远看到一只闭着眼的猫。两者都有 `motion.test.ts` 的 M4·② 兜着。
- 功能零缺失：瞳孔跟随 M5 是 60Hz 状态更新、**不是动画**，`reduce` 下不降级（选择器也不含瞳孔）；拖拽 / 右键 / 穿透三条判据不变，动效期间窗口照常可点可拖。

## 9. 性能预算（超了就是 bug，不是"稍慢"）
- 只动 `transform` / `opacity`；禁动 `width`/`height`/`top`/`left`/`margin`；禁 `transition: all`（逐属性显式列出）；禁预防性 `will-change`（只在动画进行时加、结束就摘）。
- 目标 60fps（每帧 ≤16.6667ms = §7 帧长）；空闲 CPU ≤1%（NFR P1）——三条动画全部由 CSS 合成器驱动，**不新增任何定时器**（`DESIGN.md` §3.5：`useCursorFollow` 是唯一 60Hz 定时器持有者）。
- 单次动效 ≤300ms：本项目的"单次"只有眨眼 100ms（其余两条是常驻循环，口径见 §10 裁决）。
- 位移 ≤8px 的适用范围 = 界面元素的位移动画（进入 / 退出 / 上浮）——本项目零界面位移；尾尖线位移是旋转派生量（= 2·r·sin 4°），受 **±8° 角度上限**（SCOPE §5 M4 断言）而非 px 约束，且只动 `transform`、不触发重排。
- 每页 ≤3 个动画原语：本项目 = 3（躯干 `scaleY` / 眼睑 `scaleY` / 尾根 `rotate`），**正好卡上限**——C1/C5 类新微反应要先删一个才能加。
- 滚动联动 / `IntersectionObserver` / 视差 / tooltip / 自动播放轮播 / 错峰 500ms：`N/A`（260×300 固定窗口、零滚动容器、零 tooltip、零轮播、零列表）；可中断与状态：动画不阻塞交互，状态只由 IPC 结果与几何决定，**不依赖 `animationend` / `transitionend`**（`DESIGN.md` §3.5）；暂停入口 = Windows「辅助功能 → 视觉效果 → 动画效果」系统开关（映射 `prefers-reduced-motion: reduce`，4-3 复现时逐条核）。

## 10. 口径裁决留痕：常驻循环动画 vs 卡内禁令
- 冲突：卡内禁令「禁止超过 400ms 的动效」「禁止无限循环的装饰动效（骨架屏除外）」「循环动效只允许骨架屏一种」，与 `SCOPE.md` §2 **M4（Must）**「三组 idle 动画同时进行」正面冲突——M4 的验收命令按文本断言周期 3.2s / 2.4s，既 >400ms 又是无限循环。
- 裁决：**产品属性优先**。M4 是 Must（不做它"它是张贴纸"）；卡的时长表与循环禁令的适用对象是"用户操作之后的交互反馈与转场"（有起止点、服务于一次操作），本项目三条动画不与任何用户操作耦合、无起止点，属"角色本体状态"，不能用 400ms 衡量。
- 约束条件（把干扰性关住，逐条可判）：① 幅度小——`scaleY` 3%、尾摆 ±8°、眼睑只在 100ms 内动；② 周期慢——0.3125 次/秒与 0.4167 次/秒（§7 命令输出，远低于会被读成闪烁的 ≥3 次/秒）；③ 无闪烁——往返写在关键帧里、首末帧中性，全程无 `opacity` 0↔1 跳变；④ 不夺焦点不阻断——背景透明、`pointer-events` 只给绘制形状，拖拽 / 右键 / 穿透判据不变（M6/M7）；⑤ `reduce` 下真停（§8）；⑥ 不新增定时器（§9）。
- 翻案条件：4-3 实测空闲 CPU >1%（NFR P1）或用户提出晕动不适时，第一个被砍的是**甩尾**（幅度最大、离窗口边缘最近），不是功能。

## 11. 未决问题（用户没定的动效取舍）
1. **低端机 / 省电模式是否全关动效**：本项目没有"低端机"判据，自动关 = 猫变成静止贴纸（M4 验收命令仍绿，但"活摆件"卖点消失）。建议只在 `reduce` 与用户主动要求时关，不按硬件自动判断。
2. **是否做营销 / 演示档动效**（入场 400–600ms、总时长 ≤8s）：SCOPE 无营销页、无演示产物，本档零作用对象。建议不做。
3. **C1 / C5 类交互微反应**（鼠标靠近耳朵转向、点击歪头）是否进本期：SCOPE 列为 Could，本期不做；若要做，必须先删一个现有动画原语（§9 的 3 个已满）。
## 更新义务与复跑
- 动效任一改动：同批回写 `docs/UI.md` §9 五态行与 `docs/registry/COMPONENTS.md` 的角色行（这两份由主线程独占，3-6 只报不改）；提交前跑 `powershell -NoProfile -ExecutionPolicy Bypass -File check.ps1` 取退出码 0。
- 卡 3-6 动作 9 自查复跑：把卡内脚本存成 UTF-8 带 BOM 的临时 .ps1（`$env:TEMP`，不进仓库），在项目根跑 `powershell -NoProfile -ExecutionPolicy Bypass -File <临时路径>/motion-selfcheck.ps1`；`Expected：` 末行 `[OK] 本卡自查通过`、退出码 0。
