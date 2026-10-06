# TESTPLAN · 罗小黑桌面摆件 MVP（测试策略）

> 产物寿命：**持久（进仓库）** ｜ 卡：**3-3 测试策略**（M/L 档必走）｜ 母版：roadbook v0.9.0 / 规则版本 2026-10-05.2
> 时间戳：开始 2026-10-06 20:07 ｜ 状态：**策略已就绪，4-3 的判据已定**（用例由 4-1 每批同写）
> 上游：`SCOPE.md` §5 验收标准 / §6 未覆盖输入五类 ｜ `NFR.md` §1 六维阈值 28 行 ｜ `docs/ARCHITECTURE.md` §1~§8 ｜ `DESIGN.md` §3.6（命令原文）
> 一句话：**35 条单元 + 6 条集成（自动化 <5 s）+ 3 条端到端手测 + 8 次变异体证伪 + 25 条必须在真机上跑出来的阈值命令**。

## 0. 口径（先说死，免得后面各说各话）

| 事 | 口径 |
| :-- | :-- |
| 唯一测试运行器 | Node 24 内置 `node --test`（**SCOPE W13 禁止引入 vitest / eslint / jest**；唯一新增的 devDependency 是 `@types/node`，用户 2026-10-06 裁决允许） |
| 测试命令原文 | `npm run test` = `node --test "src/**/*.test.ts"`——**必须 glob，不能给目录**（SCOPE §5 M8 约束 1：Node v24.21.0 上 `node --test <目录>` 实测退出码 1） |
| 类型检查 | `npm run typecheck` = `tsc --noEmit`；测试文件的 import **必须带 `.ts` 扩展名**（`tsconfig` 已开 `allowImportingTsExtensions`，本轮实测 `node -v` = v24.21.0） |
| 测试文件落点 | 与被测模块同目录、同名前缀 `*.test.ts`（`ARCHITECTURE.md` §4「测试文件」行） |
| "通过"的定义 | 每条命令的判据 = **退出码 0 + 可比对输出**（如 `window-config OK 6/6`）；"跑过了"不算（AGENTS.md B1） |
| 现状（本轮实测） | `src/**/*.test.ts` 命中 **0** 个文件；`package.json` 的 scripts 只有 `dev`/`build`/`preview`/`tauri`，**没有 `typecheck`/`test`**——两条由 4-1 批次 1 补（原文钉在 `DESIGN.md` §3.6）｜`@tauri-apps/api` 已装 **v2.12.1**，`mocks.js` / `mocks.d.ts` 在位，但 `mockIPC` 在 Node 里需要一行 `window` 垫片（**实测见 §7**） |

## 1. 动作 1 · 金字塔三层分配

| 层 | 覆盖什么 | 比例 | 预计条数 | 跑一次多久 | 谁写 |
| :-- | :-- | :-: | --: | :-- | :-- |
| **单元** | 纯函数 + **仓库内真实文本**的解析断言：`gazeAngle` / `screenToViewport` / `isOverCharacter` / `CAT_GEOMETRY` 的比例 / `heicat.css` 的 keyframes / `tauri.conf.json` 六键 / `capabilities/default.json` 四条 | ~80% | **35** | < 4 s | 4-1 每批同写 |
| **集成** | 跨进程边界：`@tauri-apps/api/mocks` 的 `mockIPC` 断言真实发出的 IPC 命令、**调用次数**与失败分支（`start_dragging` / `close` / `set_ignore_cursor_events` 的翻转语义） | ~14% | **6** | < 1 s | 4-1 批次 4 |
| **端到端** | 跑 `npm run tauri dev` 后真走一遍的 **3 条**：① 出现猫且背景透明 / 无边框 / 置顶 ② 瞳孔跟随鼠标 + 点透明区选中桌面图标 ③ 拖拽 + 右键「退出」后进程消失 | ~6% | **3**（人工） | 分钟级 | 4-3（人眼看） |

按文件分解（预计，4-1 批次 1 首跑后把"预计"改成实测值）：

| 文件 | 层 | 条数 | 对应判据 |
| :-- | :-- | --: | :-- |
| `src/tauriConfig.test.ts` | 单元 | 8 | 窗口 6 键（`window-config OK 6/6`）+ 授权上限 ≤5 与"无未调用授权"（`acl OK 4/4` 的补强） |
| `src/character/geometry.test.ts` | 单元 | 6 | M3 四条比例 + 白色只出现在 2 处眼白 + 头身比 |
| `src/character/motion.test.ts` | 单元 | 6 | M4 呼吸周期 / 眨眼时长 / 甩尾周期 / 摆幅 / 三组周期互不相同 / 只出现合成层属性 |
| `src/interaction/gaze.test.ts` | 单元 | 9 | M5 六个角度 + 远距归零 + 夹取与无 NaN + `SAMPLE_HZ === 60` |
| `src/interaction/hitTest.test.ts` | 单元 | 6 | M6 四组 `scaleFactor` + 猫身内外各 1 |
| `src/interaction/dragExit.test.ts` | 集成 | 6 | M7 两条命令 + **同一 tick 只读一次坐标** + 未翻转不 invoke + `E-IPC-02` / `E-IPC-01` 两条失败分支 |

- 三层各自"比例"= **用例条数占比**，不是覆盖率（本项目无覆盖率工具，见 §3）。
- 端到端为什么只有 3 条且不能自动化：见 §5「哪些不测」第 2 行。
- 每条单元用例必须能说出"改哪一行生产代码会让它红"；说不出、或只有常量值能让人红的 → 按 §7 的变异体表当场返工（**`SAMPLE_HZ === 60` 就是被点名的那类**，它的补强见 §7 反模式 1）。

## 2. 动作 2 · 关键路径清单（入口 → 动作 → 必须成立的结果）

### 2.1 自动化（`node --test` 覆盖，4-1 每批同写）

| # | 入口（命令） | 动作 | 必须成立的结果 | 用例落点 |
| :-- | :-- | :-- | :-- | :-- |
| KP-01 | `node --test src/tauriConfig.test.ts` | 读 `src-tauri/tauri.conf.json` 的 `app.windows[0]` | 六个键逐一成立：`width=260`/`height=300`/`transparent=true`/`decorations=false`/`alwaysOnTop=true`/`skipTaskbar=true`，**且 `shadow=false`**；打印 `window-config OK 6/6` | 该文件 |
| KP-02 | 同上 | 读 `src-tauri/capabilities/default.json` 的 `permissions` | 含 `core:window:allow-close`、`core:window:allow-start-dragging`、`core:window:allow-set-ignore-cursor-events`、`core:menu:default`；打印 `acl OK 4/4`；**且不含 `opener:default`** | 该文件 |
| KP-03 | 同上 | 数授权条目总数 | ≤ 5（NFR `security` S2），且**每条授权都能在 `src/interaction/` 里找到调用方**（不留未被调用的授权） | 该文件 |
| KP-04 | `node --test src/character/geometry.test.ts` | 读 `src/character/geometry.ts` 的 `CAT_GEOMETRY` | 两眼外接矩形合并宽 / 头宽 ≥ 0.60；耳距 / 头宽 ≥ 0.55；尾长 / 体高 ≥ 1.20；造型色板里 `#FFFFFF` 只出现 2 个区域（两只眼白）；**通体主色为黑** | 该文件 |
| KP-05 | `node --test src/character/motion.test.ts` | 读 `src/character/heicat.css` 文本 | 呼吸周期 3.2s±0.2；眨眼单次 ≤ 100ms；甩尾周期 2.4s±0.2；尾摆幅度 ±8°±1°；**三组周期两两不相等** | 该文件 |
| KP-06 | 同上 | 扫 `heicat.css` 的动画属性 | 三组 `@keyframes` 只动 `transform`/`opacity`（**合成层**，NFR `perf` P1 的模块约束），出现 `width`/`top`/`left` 之类即红 | 该文件 |
| KP-07 | `node --test src/interaction/gaze.test.ts` | 调纯函数 `gazeAngle(dx, dy)` | `(1,0)→0°`、`(0,1)→90°`、`(-1,0)→180°`、`(0,-1)→-90°`、`(0,0)→0°`、距窗口中心 >1500px 时归 0 | 该文件 |
| KP-08 | 同上 | 传极端与非法输入 | 角度落在 −180~180（夹取）；`NaN`/`Infinity` 输入不产出 `NaN`（U3 的机器面） | 该文件 |
| KP-09 | `node --test src/interaction/hitTest.test.ts` | `screenToViewport()` + `isOverCharacter()` | `scaleFactor` 取 1.0 / 1.25 / 1.5 / 2.0 四组时换算结果均正确；猫身矩形内 → `true`、外 → `false`（U1 的机器面） | 该文件 |
| KP-10 | `node --test src/interaction/dragExit.test.ts` | `mockIPC` 后触发左键 `mousedown` | 发出的命令是 `plugin:window\|start_dragging` | 该文件 |
| KP-11 | 同上 | 触发右键并点菜单项「退出」 | 发出的命令是 `plugin:window\|close`；菜单**只有一项** | 该文件 |
| **KP-12** | 同上 | 跑满一个 tick（受控时间，不用 sleep） | **同一个 tick 内 `cursor_position` 只被调用 1 次**；`overCharacter` 未翻转时**一次 `set_ignore_cursor_events` 都不发**；翻转时才发 1 次 | 该文件 |
| KP-13 | 同上 | `mockIPC` 让 `cursor_position` 返回 `null` | `gazeDeg` 回 0，函数不抛（`E-IPC-02` 失败分支，U3） | 该文件 |
| KP-14 | 同上 | `mockIPC` 让调用 reject（模拟 ACL 拒绝） | 不吞错：走到显式失败分支并留下 `E-IPC-01` 的可观测痕迹，进程不崩 | 该文件 |
| KP-15 | `npm run typecheck` | 全量 `tsc --noEmit` | 退出码 0（**含测试文件的类型检查**——这是买 `@types/node` 换来的那一层） | 全仓 |
| KP-16 | `powershell -NoProfile -ExecutionPolicy Bypass -File check.ps1` | 跑 4 条 STEP | 退出码 0，且输出里 4 条 STEP 各自 `[OK]`：`npm run typecheck` / `npm run test` / `git status --porcelain` / `security.ps1` | `check.ps1` |

> **阈值用例（卡要求"至少 1 条"）**：**KP-12** 就是——它是 NFR `perf` **P3「瞳孔跟随采样率 60 Hz ±5%」**唯一能在 `node --test` 里断言的形态（断言常量 + 断言"单 tick 单次采样"的行为，而不是只断言 `SAMPLE_HZ === 60` 这个数字）。
> **越权拒绝用例**：**无**——本项目零认证面（3-2 威胁建模永久跳过，五类红线域未触碰，裁剪依据见 `STATE.md`）。显式接受，替代手段见 §5 第 7 行。

### 2.2 阈值类（26 条实阈值，25 条**跑不出 `node --test`**，必须真机跑 → 归 4-3）

NFR 的 26 条实阈值逐条不漏地在这三处落定，本卡不重复它们的正文（信息阶梯：同一事实只写一处）：

| 维度 | 阈值编号 | 落在哪跑 | 命令载体 |
| :-- | :-- | :-- | :-- |
| 性能 | P1 / P2 / P4 | 4-3（应用运行中 / 计时） | `scripts/nfr.ps1 -Check perf` |
| 性能 | **P3** | **KP-12（`node --test`）** | `npm run test` |
| 容量 | C1 / C2 / C3 | 4-3 首件事（C1 基线本机没取到，需干净机器重取） | `scripts/nfr.ps1 -Check capacity` |
| 容量 | C4 | 4-1 **每批收尾** | `scripts/nfr.ps1 -Check capacity` |
| 可用性 | A1 / A2 | A2 在 4-3；A1 先在 4-3 跑 `-Minutes 30`，8 h 留 5-2 发布前 | `scripts/nfr.ps1 -Check availability` |
| 可用性 | A3 / A4 | A3 人工（无脚本）；A4 在 4-3 | `VERIFY.md` A3 条 / `nfr.ps1` |
| 安全 | S1 / S2 / S4 | 4-3（S1 需应用运行中） | `scripts/nfr.ps1 -Check security` |
| 安全 | S3 / S5 | 4-3 / 5-1 归档前 | `nfr.ps1` / `git ls-files` 计数 |
| 可维护 | M1 / M2 / M3 | M3 每批收尾；M1/M2 在 4-3 + 4-2 审查 | `scripts/nfr.ps1 -Check maintainability` |
| 可维护 | M4 / M5 | M4 在 5-1 前；M5 人工（4-2 逐文件复核，无可靠机械判据） | `nfr.ps1` / 4-2 |
| 兼容 | K1 / K2 / K4 | 4-3 + 5-2 发布前 | `scripts/nfr.ps1 -Check compat` |
| 兼容 | K3 | 人工（改系统缩放四档目视） | `VERIFY.md` K3 条 |

### 2.3 未覆盖输入五类（SCOPE §6 U1~U5，逐条给落点）

| # | 情形 | 落点 |
| :-- | :-- | :-- |
| U1 | 多显示器 + 混合 DPI | 机器面 = KP-09（4 组 `scaleFactor`）；人工面 = 拖到副屏看瞳孔与穿透 |
| U2 | 显示器拔掉 / 分辨率变更 | **本期不做**（SCOPE S4 是 Should）→ 写进 §5「哪些不测」第 4 行 |
| U3 | `cursorPosition()` 取不到值 | 机器面 = KP-08 + KP-13 |
| U4 | 拖拽与 60Hz 轮询并发 | 人工面：连续拖拽 10 次后，点猫身仍有反应、点透明区仍穿透 |
| U5 | 菜单开着点桌面 | 人工面：程序还在、再右键能正常弹出 |

## 3. 动作 3 · 覆盖率门槛（两行分开，禁止合并）

| 范围 | 门槛 | 怎么量 | 不达标怎么办 |
| :-- | :-- | :-- | :-- |
| **新增代码**（4-1 起新建的 14 个文件） | **关键路径 100% 有用例**（§2.1 的 KP-01~KP-16 逐条有落点）+ 每条判据做 **1 次变异体证伪**（改坏实现 → 对应用例必须变红） | `node --test "src/**/*.test.ts"` 全绿 + §7 的 MUT 表逐行有"改了哪一行 / 哪个用例红了 / 命令输出" | 补用例；确属脚手架（`src/main.tsx`、`src/vite-env.d.ts`、`src/tauriConfig.test.ts` 自身）→ 写进 §5 并在本行标注排除 |
| **全仓** | **只升不降**：口径 = 同一条命令的 `# pass N` 汇总行，**基线 = 4-1 批次 1 首次跑通时回填的实测数字**（预计 8），此后每批收工报同一个数字 | `npm run test` 的汇总行，逐批记在 4-1 的批次知会里 | 降了先补回再进 4-3；确因删功能而减少 → 同批在 `CHANGELOG.md` 与本行写明原因 |

> **本项目没有覆盖率工具**（W13 禁止 vitest/nyc/istanbul），故按卡内指定改用上表的量化替代：**"关键路径 100% 有用例 + 每个判据做一次变异体证伪"**。数字不是"覆盖率百分比"，不许在别处写成百分比。

## 4. 动作 4 · 夹具与测试数据策略

- **来源三选一 → 选手写静态常量（写在测试文件内）**。理由：被测物只有两类——① 纯函数的数值边界（角度 / 坐标 / 比例）② **仓库内真实文本**（`heicat.css` / `tauri.conf.json` / `capabilities/default.json`）。没有数据库、没有网络、没有时间依赖、没有随机数。
- **禁止使用生产数据**：本项目**不存在生产数据**（SCOPE W5 无联网、NFR `capacity` C3 写入用户目录文件数 = 0）→ 泄露面为零。这条不是"没做"，是"没有对象"。
- **落点**：**不建 `tests/fixtures/`**（零夹具）。若将来真的需要夹具，落 `tests/fixtures/`、随仓库提交、每条能被一条命令重置。
- **夹具自查命令**（卡内原文 + 本项目的零夹具口径，两次真实输出都贴在这里）：

```powershell
Select-String -Path 'tests/fixtures/*' -Pattern '\d{11}|@(qq|163|gmail)\.com' | Select-Object -First 5
```

实测输出（原文）：`Select-String : 找不到路径"D:\Code\Luoxiaohei\tests\fixtures"，因为该路径不存在。`——**这是零夹具仓库的预期表现，不是"没自查"**：目录不存在 ⇒ 不可能有夹具 ⇒ 不可能有生产数据。加强判据（本轮实跑）输出 `（无输出 = 合格）`：

```powershell
$hit = Select-String -Path 'tests/fixtures/*' -Pattern '\d{11}|@(qq|163|gmail)\.com' -ErrorAction SilentlyContinue | Select-Object -First 5; if ($hit) { $hit } else { '（无输出 = 合格）' }
```

## 5. 动作 5 · "哪些不测"（逐条给理由，一条不是"没想过"）

| 不测的东西 | 为什么 | 替代手段 |
| :-- | :-- | :-- |
| **像素级视觉差异**（"像不像罗小黑"） | 没有设计稿基线；判定权在用户（SCOPE §10 Q2） | 4-3 人工目检 + KP-04 用几何比例兜住硬指标 |
| **GUI 自动化**（真实鼠标点击 / 拖拽 / 按下拖动） | 需要 WebDriver 或 Tauri 驱动 = **新增依赖**，SCOPE W13 明令禁止 | `mockIPC` 断言"发出的命令与次数"（KP-10~KP-14）+ 3 条端到端人工（§1） |
| **真实 DPI 切换与显示器热插拔**（U1/U2） | 改系统缩放属"修改真实系统状态"，不可委托清单在册；本环境也无法稳定驻留 agent 派生的 GUI 进程（`STATE.md` 风险摘要 ⑦） | 纯函数在 4 组 `scaleFactor` 下断言（KP-09）+ NFR K3 的人工四档目视 |
| **U2 显示器拔插后回到可见区** | SCOPE **S4 是 Should，本期不做**（重启即回默认位置） | 无。已由用户在 SCOPE §10 的取舍覆盖 |
| **8 小时长跑（NFR A1）** | 单会话内跑不完，且本机取不到稳态基线 | 4-3 先跑 `nfr.ps1 -Check availability -Minutes 30` 做快速回归；8 h 留 5-2 发布前 |
| **100 次最小化↔还原（NFR A3）** | 无脚本判据，逐次人眼 | 人工按 `VERIFY.md` 第 A3 条走；真出现"透明区变黑"记现象 + 复现步骤，转 6-1 |
| **越权拒绝用例** | **本项目零认证面**：3-2 威胁建模永久跳过（不触碰认证/鉴权、计费、删数据、改表结构、对外接口），没有"拿 A 的身份访问 B 的资源"这种对象 | **无替代**——显式接受。若将来新增任何鉴权面，本条立即失效并回 3-2 |
| **覆盖率百分比** | 无覆盖率工具（W13） | §3 的量化替代：关键路径 100% + 变异体证伪 |
| **Won't Have 清单里的东西**（养成 W1 / 多角色 W2 / 语音 W3 / 自启 W4 / 联网 W5 / 跨平台 W6 / 托盘 W7 / 多显示器多实例 W11 / Live2D W14） | 本期不写代码，没有可测对象 | 无（碰到就是越界，4-1 立即停） |
| **守护脚本自身的判据**（`check.ps1` / `gate.ps1` / `orphans.ps1` 的算法） | 属工具链，不在本任务范围（D6① 禁越任务范围） | `doctor.ps1` 每会话开工跑；已知缺口登记在 `docs/TECH_DEBT.md` TD-001 / TD-003 |

## 6. 动作 6 · 本策略 = 4-3 验证分级的判据

**L 档口径**：① §2 的关键路径清单**逐条跑**（每条给通过 / 不通过的实测证据）② §3 的新增代码门槛达标 ③ **负面测试与失败分支必须有**（KP-13 / KP-14 / KP-08）④ **不许零测试**（当前 0 → 4-1 批次 1 起必须 > 0）⑤ 越权拒绝用例按 §5 显式记"无"。

**4-3 要跑的命令（一行一条，直接复制；每条后面写它的 Expected）**：

```text
powershell -NoProfile -ExecutionPolicy Bypass -File check.ps1
  Expected：退出码 0，且输出里 4 条 STEP 各自 [OK]
npm run typecheck
  Expected：退出码 0，无 TS 报错
npm run test
  Expected：`# pass 41`（预计值，以 4-1 首跑回填的实测值为准）、`# fail 0`，退出码 0
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check all
  Expected：退出码 0（某项不达标 = 1；环境缺失 = 2，**不算通过**）
powershell -NoProfile -ExecutionPolicy Bypass -File doctor.ps1
  Expected：逐行 [OK]，无版本不符
powershell -NoProfile -ExecutionPolicy Bypass -File orphans.ps1
  Expected：汇总行里「未跟踪 0 项」「读取失败 0 项」（这两项非 0 时退出码为 1）
powershell -NoProfile -ExecutionPolicy Bypass -File gate.ps1 -Anchor <本批起点> -ScopeFiles "<本批文件>" -RepoRoot .
  Expected：[GREEN]（-Anchor 是**本批**起点锚点，不是任务起点——见 docs/TECH_DEBT.md TD-003）
powershell -NoProfile -ExecutionPolicy Bypass -File gate.ps1 -Anchor HEAD~1 -ScopeFiles "src-tauri/Cargo.lock" -RepoRoot .
  Expected：TD-001 未清偿前会红（生成物无豁免通道）——4-3 时按当时 TD-001 的状态判读
```

**手工清单（4-3 逐条走，每条写"看到什么"）**：① 猫出现且背景透明、无边框、置顶、不在任务栏 ② 瞳孔随鼠标转、鼠标到屏幕远端回正 ③ 点透明区选中桌面图标、点猫身不穿透 ④ 呼吸 / 眨眼 / 甩尾三组可见且不同步 ⑤ 拖拽跟随、松开停住 ⑥ 右键菜单只有「退出」、点了进程消失（任务管理器无残留）⑦ 拖拽 10 次后穿透状态仍正确（U4）⑧ 菜单开着点桌面 → 程序还在、再右键能弹出（U5）。

## 7. 动作 7 · 接缝先约定 + 两种反模式 + 变异体证伪表

**接缝约定（派单给实现者之前定；实现者不许自己另挑一个）**

| 被测物 | 允许被替换 / 打桩吗 | 怎么替换 |
| :-- | :-- | :-- |
| `@tauri-apps/api/core` 的 `invoke` | **允许，且是唯一允许的替换点** | `@tauri-apps/api/mocks` 的 `mockIPC` + **每个用它的文件顶部必须加一行 `window` 垫片**（见下方实测表第 2 行） |
| `gazeAngle` / `screenToViewport` / `isOverCharacter` / `CAT_GEOMETRY` | **不替换** | 直接调真实现——它们本来就是纯函数，替换掉等于没测 |
| `heicat.css` / `tauri.conf.json` / `capabilities/default.json` | **不替换，也不许在测试里内联一份"期望副本"** | 读**真实文件文本**。内联副本 = 同义反复（改坏真文件测试照样绿） |
| `setInterval` 定时器 | 不 mock 真实时钟；需要"跑一个 tick"时用受控时间（`node:test` 的 timer mock），**禁止固定 sleep** | KP-12 用受控时间推进一个 tick，等待一律写成"轮询条件 + 明确超时" |
| `currentMonitor()` / `cursorPosition()` 的系统返回值 | 允许以 payload 形式注入给纯函数 | 纯函数只吃数字参数，系统值由 hook 层取——这层分工由 `ARCHITECTURE.md` §5 的模块约束保证 |

**接缝已实测（2026-10-06 本轮，`node --test "src/**/*.test.ts"` 实跑；探针文件跑完即删，工作树未留副本）**

| # | 探针 | 实测结果 | 对策略的影响 |
| --: | :-- | :-- | :-- |
| 1 | 直接 `mockIPC(...)` | ✖ **`ReferenceError: window is not defined`**（`@tauri-apps/api/mocks.js:6` 的 `mockInternals()` 直接读 `window`） | **SCOPE M7 的验收命令照原样写跑不起来**——`@tauri-apps/api` v2.12.1 明确假设浏览器环境（其 JSDoc 示例是 Vitest） |
| 2 | 先 `(globalThis as unknown as { window: unknown }).window = globalThis` 再 `mockIPC` | ✔ `invoke('plugin:window\|cursor_position')` 返回 mock 值，回调收到的 cmd 逐字正确 | **KP-10~KP-12 成立**；这行垫片**是接缝约定的一部分**，每个用 `mockIPC` 的测试文件顶部都要写，不许各自发明写法 |
| 3 | 不 mock 直接 `invoke(...)` | ✔ 抛错（Promise reject） | **KP-13 / KP-14 的失败分支可测**：`E-IPC-01` 用"mock 回调里 throw"构造，`E-IPC-02` 用"mock 返回 `null`"构造 |
| 4 | `t.mock.timers.enable({ apis: ['setInterval'] })` + `tick(16)` | ✔ 回调恰好触发 1 次 | **KP-12 的"跑一个 tick"可受控驱动**——不需要 sleep，也不需要新依赖（Node 24 内置） |

**两种反模式（收工前逐条自查）**
1. **同义反复测试**：断言重抄实现。判据一句话：这条测试说得出"改哪一行生产代码会让它变红"吗？**本卡已点出两处高危**——`SAMPLE_HZ === 60`（NFR P3 的验收命令原文就是断言这个常量）与 `window-config OK 6/6` 里的常量比对。二者的处理：常量断言**保留**（它们是 SCOPE/NFR 逐字指定的命令判据），但**必须**各配一条行为断言——KP-12（单 tick 单次采样 + 未翻转不 invoke）与 KP-03（每条授权都能找到调用方）。只留常量断言的用例 = 不合格。
2. **横向切片**：按层切任务（先做完整个数据层、再做整个接口层），做完整层都不产生可运行行为。本项目**批次的切法本身就是纵向的**（`DESIGN.md` §10：批次 1 = M1+M2+M8 配置与门禁、批次 2 = M3 造型可见、批次 3 = M4+M5 动画与跟随、批次 4 = M6+M7 穿透与退出），每个批次收尾都能 `npm run tauri dev` 演示一条用户行为。**4-1 不许按"先写全部测试文件、再写全部实现"切**。

**变异体证伪表**（§3 新增代码门槛的量化替代；4-1 每批至少做 1 次，改完立刻改回；不改回 = 该批不许提交）

| # | 改坏哪一行（人工制造） | 必须变红的用例 |
| :-- | :-- | :-- |
| MUT-1 | `SAMPLE_HZ` 60 → 30 | `gaze.test.ts` 的采样常量断言 **+** KP-12 的"单 tick 单次采样"断言 |
| MUT-2 | `gazeAngle` 去掉 −180~180 夹取 | `gaze.test.ts` 的夹取与 `NaN` 用例（KP-08） |
| MUT-3 | `heicat.css` 呼吸周期 3.2s → 1.6s | `motion.test.ts` 的周期断言 |
| MUT-4 | `heicat.css` 把 `transform` 改成 `width` | `motion.test.ts` 的合成层断言（KP-06） |
| MUT-5 | `tauri.conf.json` 的 `transparent` → `false` | `tauriConfig.test.ts` 的 `window-config` 用例 |
| MUT-6 | `capabilities/default.json` 删掉 `core:menu:default` | `tauriConfig.test.ts` 的 `acl` 用例 |
| MUT-7 | `hitTest.ts` 的 `scaleFactor` 除法改成乘法 | `hitTest.test.ts` 的四组缩放用例（KP-09） |
| MUT-8 | `usePointerPassthrough.ts` 改成**每个 tick 都** invoke | `dragExit.test.ts` 的 KP-12"未翻转不 invoke"用例 |

> 重构**不属于这个循环**：测试-实现-重构里的"重构"是同一批内就地小步收拾，不是另开一批。要成规模重构 → 另立任务走 7-8。

## 8. 本卡检查清单（收工前逐条勾，原文见卡 §① 第 4 项）

```text
- [x] ① 金字塔三层各自"覆盖什么"写清，比例有数字          → §1（80% / 14% / 6%，条数 35 / 6 / 3）
- [x] ② 关键路径清单逐条写清入口与预期结果                → §2.1 KP-01~KP-16、§2.3 U1~U5（U2 显式不做并给理由）
- [x] ③ 覆盖率门槛分两行（新增代码／全仓），各给数字        → §3（无覆盖率工具 → 用量化替代，两行分开）
- [x] ④ 夹具与测试数据策略写明来源，且明确不用生产数据      → §4（零夹具；本项目无生产数据，两次自查输出已贴）
- [x] ⑤ "哪些不测"逐条列出并给理由                        → §5（10 条，每条带替代手段或显式接受）
```
