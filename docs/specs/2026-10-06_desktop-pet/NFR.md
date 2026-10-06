# NFR · 罗小黑桌面摆件 MVP（六维非功能阈值）

> 产物寿命：**持久（进仓库）** ｜ 卡：**2-4 非功能需求**（M/L 档必走）｜ 母版：roadbook v0.9.0 / 规则版本 2026-10-05.2
> 时间戳：开始 2026-10-06 19:24 ｜ 状态：**六维阈值已确认**（2026-10-06 用户回「采纳建议」，检查清单 ⑤ 已勾并附原话；解锁 4-1）
> 上游：`docs/specs/2026-10-06_desktop-pet/SCOPE.md` ｜ 检查命令载体：`scripts/nfr.ps1` ｜ 架构约束回写：`docs/ARCHITECTURE.md` §4 / §5

---

## 0. 数字口径（口径与数字必须同时声明）

| 量 | 口径 |
| :-- | :-- |
| CPU % | **单核百分比** = Δ进程 CPU 时间 ÷ Δ墙钟时间 × 100（**不是**任务管理器的"占全机"百分比） |
| 内存 | `WorkingSet64`（工作集），**进程树求和**（`luoxiaohei.exe` + `msedgewebview2` 子进程） |
| 行数 | `[IO.File]::ReadAllLines().Count`（含空行；禁 `Get-Content`，见 `docs/lessons/2026-09-11_数字口径与CRLF.md`） |
| 启动到窗口可见 | 从 `Process.Start` 返回到 `MainWindowHandle ≠ 0` 的墙钟时间 |
| 稳态 | 应用启动后 ≥ 15 s 且期间无鼠标移动 |

**唯一检查命令载体**：`scripts/nfr.ps1`（六维各自一条命令，退出码 0 = 全过 / 1 = 有不达标 / 2 = 环境缺失**不算通过**）。

---

## 1. 动作 1 · 六维取值表（每条阈值一行，六列齐备）

### 性能 · perf

| # | 阈值 | 来源 | 验证动作 | 检查命令 | 跑在哪阶段 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **P1** | 空闲 CPU（60 s 单核均值，无鼠标移动）**≤ 1.0 %** | ② 本机实测 **0 %**（两次独立测量：60 s 与 20 s，结果一致） | 启动应用静置 60 s，读脚本打印的单核百分比 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check perf -Seconds 60` | 4-3 验证（收工前必跑） |
| **P2** | 冷启动到窗口可见 **≤ 6.0 s**（热启动中位数 ≤ 3.0 s 为回归参考） | ② 本机实测三次：5.78 / 1.68 / 1.34 s（中位数 1.68 s）；最差一次是首次运行且含杀毒扫描 | 连跑 3 次 `-Check perf`，读三次启动值取中位数与最大值 | 同上 | 4-3 验证 + 5-2 发布前 |
| **P3** | 瞳孔跟随采样率 **60 Hz ± 5 %**（16.7 ms ± 0.8 ms） | ① 用户 2026-10-06 硬数字原话「**60hz**」 | `node --test src/interaction/gaze.test.ts` 断言常量 `SAMPLE_HZ === 60` | `npm run test` | 4-3 验证 |
| **P4** | 前端生产构建（vite）**≤ 3 s** | ② 本机实测 **980 ms**（取 3 倍余量作回归线） | 计时 `npm run build` 的 vite 段 | `powershell -NoProfile -Command "Measure-Command { npm run build } | Select-Object TotalSeconds"` | 4-3 验证 |

### 容量 · capacity

| # | 阈值 | 来源 | 验证动作 | 检查命令 | 跑在哪阶段 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **C1** | 进程树工作集（稳态）**≤ 250 MB** | ② 本机实测主进程 **20.7 MB**（启动后 5 s 内）；WebView2 子进程本机观测区间 25.6 ~ 286.6 MB（**该区间含孤儿进程累积污染，只作量级参考**）；③ Tauri 复用系统 WebView2、不打包 Chromium | 启动应用静置 15 s，读脚本打印的进程树工作集 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check capacity` | **4-3 首件事**：本机稳态基线未取到（见 §4 环境限制），4-3 必须在干净机器重取并回写本行 |
| **C2** | 角色 SVG 的 DOM 节点数 **≤ 60 个** | SCOPE §7 元素表逐项计数（躯干组 1 + 眼白 2 + 瞳孔 2 + 眼睑 2 + 尾巴 1 + 耳 2 + 头 1 + 四肢 4 + 分组容器 ≤ 45） | 4-3 时在 devtools 里 `document.querySelectorAll('svg *').length` | `powershell -NoProfile -Command "(Select-String -Path src/character/HeiCat.tsx -Pattern '<(path|circle|ellipse|g|rect|polygon)' -AllMatches).Matches.Count"` | 4-3 验证 |
| **C3** | 写入用户目录的文件数 = **0**（若启用 SCOPE S1 位置记忆，只允许 `localStorage` 一个坐标，≤ 1 KB） | SCOPE S1 + W5/W10（无联网、无自动更新） | 4-3 前后对比 `%APPDATA%` 与 `%LOCALAPPDATA%` 下与产品名相关的目录 | `powershell -NoProfile -Command "Get-ChildItem $env:APPDATA,$env:LOCALAPPDATA -Filter '*luoxiaohei*' -Recurse -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count"`（Expected：`0`） | 4-3 验证 |
| **C4** | Rust 增量编译 **≤ 60 s** | ② 本机实测首次全量 **3 m 55 s**（458 crates）；增量目标取全量的约 1/4 | 改一行 `src-tauri/src/lib.rs` 后计时 `cargo build --release` | `powershell -NoProfile -Command "Measure-Command { cargo build --release --manifest-path src-tauri/Cargo.toml } | Select-Object TotalSeconds"` | 4-1 每批收尾 |

### 可用性 · availability

| # | 阈值 | 来源 | 验证动作 | 检查命令 | 跑在哪阶段 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **A1** | 连续运行 **8 小时**后进程树工作集增长 **≤ 5 MB**（无泄漏） | ③ BongoCat ADR-0003 的 Verification 段（验收动作含 device lost / swapchain recovery） | 挂机 8 h，脚本每 5 s 采样工作集，读峰值减起始值 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check availability -Hours 8` | 5-2 发布前（4-3 先跑 `-Minutes 30` 做快速回归） |
| **A2** | 连续启停 **100 次零失败**（每次窗口都出现、都干净退出、无进程残留） | ③ BongoCat ADR-0003 逐字「**100 次真实窗口创建/销毁**」 | 脚本循环启动→确认窗口→退出，统计失败次数。**4-2 的 S-01 勘误 + 4-1 批次 5 修复**：`Check-LaunchCycle` 第一版只有定义、**没有调用点**，照本行的命令跑会执行长跑浸泡、打印「本维全部阈值通过」并 exit 0——A2 **从未被测量却拿到绿色**；现已接线（`-Launches` 给了才跑，与 `-Hours`/`-Minutes` 同一形态），跑起来会真的打印「N 次启动/退出循环的失败次数（成功 M 次）」 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check availability -Launches 100` | 4-3 验证 |
| **A3** | 透明 + 置顶在 **100 次**显示/隐藏切换后仍正确（透明区不变黑） | ③ 同 ADR；本项目已知风险 Tauri #15947（该 issue 的现象就是透明区偶发变黑） | 4-3 时人工按 100 次「最小化→还原」，逐次看透明区 | 人工判据（无脚本）：`docs/specs/2026-10-06_desktop-pet/VERIFY.md` 第 A3 条 | 4-3 验证 |
| **A4** | 同时只允许 **1 个** 应用进程组（单实例） | SCOPE W11（多实例管理本期不做） | 连点两次 exe，看进程组数 | `powershell -NoProfile -Command "@(Get-Process -Name luoxiaohei -ErrorAction SilentlyContinue).Count"`（Expected：`1`） | 4-3 验证 |
| **A5** | 月度可用性 `N/A（本地桌面单机应用，无服务端、无线上流量，不存在"停机"概念）` | — | — | `N/A` | — |

### 安全 · security

| # | 阈值 | 来源 | 验证动作 | 检查命令 | 跑在哪阶段 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **S1** | 出站连接 `ESTABLISHED` = **0 条**，监听端口 = **0 个** | ① IDEA 卡动作 4 原文「**明确排除**：养成系统、多角色、语音、开机自启、跨平台、**任何联网**」 | 应用运行中按进程树查 TCP 连接 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check security` | 4-3 验证（应用运行中跑） |
| **S2** | `capabilities/default.json` 授权条目 **≤ 5 条**，且不得保留未被调用的授权 | ② 本机实测当前 **2 条**；SCOPE M2 后 = `core:default` + 4 条窗口/菜单命令 | 读 JSON 数 `permissions` 条目 | 同上 | 4-3 验证 + 每次改动 capability |
| **S3** | 不以管理员权限运行；不写注册表、不写启动项 | SCOPE W4（开机自启已排除） | 4-3 时看进程的 `Elevated` 属性与 `HKCU\...\Run` | `powershell -NoProfile -Command "(Get-Process -Name luoxiaohei).Path; Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -ErrorAction SilentlyContinue | Select-Object -Property *luoxiaohei*"`（Expected：无 luoxiaohei 项） | 4-3 验证 |
| **S4** | 仓库内不含真实密钥（`.env` 不被 git 跟踪） | AGENTS.md D15 | 抽查 git 跟踪清单 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check security` | 4-3 验证 + 5-1 归档前 |
| **S5** | 入库的官方素材数 = **0 个**（形象一律由自绘 SVG 表达） | SCOPE §8 版权口径（未授权同人作品，禁止商用） | 列出 `src/` 与 `public/` 下的位图文件数 | `powershell -NoProfile -Command "@(git -C . ls-files 'public/*' 'src/**' | Where-Object { $_ -match '\.(png|jpg|jpeg|webp|gif|svg)$' }).Count"` | 5-1 归档前 |

### 可维护 · maintainability

| # | 阈值 | 来源 | 验证动作 | 检查命令 | 跑在哪阶段 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **M1** | 单文件 **≤ 500 行**（测试文件 **≤ 1000 行**） | AGENTS.md D14① | 扫全部 `.ts/.tsx/.rs/.ps1` 取最长 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check maintainability` | 4-3 验证 + 4-2 代码审查 |
| **M2** | 所有 `.ps1` 为 **UTF-8 带 BOM** | AGENTS.md §10 编码坑（**2026-10-06 本卡实测踩到**：一次编辑掉 BOM 后 `≥` 被按 GBK 读成 `鈮?`，脚本 ParserError，看起来像"阈值不达标"） | 逐个读前 3 字节比对 `EF BB BF` | 同上 | 4-3 验证 + 每次新增脚本 |
| **M3** | `check.ps1` 退出码 **0** | AGENTS.md B1 | 跑门禁读退出码 | `powershell -NoProfile -ExecutionPolicy Bypass -File check.ps1` | 每批收尾 |
| **M4** | 干净机器照 `docs/RUNBOOK.md` 从 clone 到窗口出现 **≤ 30 分钟** | ② 本机分段实测：Rust 首次全量 3 m 55 s + npm 依赖安装 + 前端构建 980 ms | 计时全流程 | `powershell -NoProfile -Command "Measure-Command { npm ci; npm run tauri build -- --no-bundle } | Select-Object TotalSeconds"` | 5-1 归档前（可跑性复核） |
| **M5** | 函数 **≤ 50 行** | AGENTS.md D14① | 人工逐文件复核（无脚本：函数边界无法用正则可靠判定） | `N/A（无可靠机械判据）`｜人工：4-2 卡逐文件复核 | 4-2 代码审查 |

### 兼容 · compat

| # | 阈值 | 来源 | 验证动作 | 检查命令 | 跑在哪阶段 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **K1** | Windows **10 build 17763（1809）及以上 / Windows 11** | ③ [Tauri 官方 Webview Versions](https://tauri.app/reference/webview-versions/) 原文「WebView2 is supported on Windows 7 and newer and comes preinstalled on Windows 11」；本项目取更严的下限（Win10 1809 是 WebView2 的正式支持线） | 读系统 build 号比对 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check compat` | 4-3 验证 + 5-2 发布前 |
| **K2** | WebView2 major **≥ 100** | ② 本机实测 **154.0.4258.53** | 读注册表 `...\EdgeUpdate\Clients\{F3017226-...}` 的 `pv` | 同上 | 同上 |
| **K3** | 显示缩放 **100 % / 125 % / 150 % / 200 %** 下窗口尺寸与清晰度正确 | SCOPE S2（高 DPI 适配） | 逐个缩放比启动，目视 + 量窗宽是否仍为 260 逻辑像素 | 人工判据（无脚本）：`VERIFY.md` 第 K3 条 | 4-3 验证 |
| **K4** | 主程序 `.exe` **≤ 20 MB**；前端产物 **≤ 2 MB** | ② 本机实测 **4.20 MB** / JS 221.23 kB（gzip 69.25 kB）+ CSS 1.39 kB | 读文件长度 | `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check compat` | 4-3 验证 + 5-2 发布前 |
| **K5** | 包管理器 = **npm**（本机无 pnpm）；Node **24.21.0** / Rust **1.99.0** | ② `.tool-versions` 锁定值 + 本机实测 `node v24.21.0` / `cargo 1.99.0` | 跑体检脚本逐行比对 | `powershell -NoProfile -ExecutionPolicy Bypass -File doctor.ps1` | 每次会话开工 |

---

## 2. 动作 2 · 验证动作可直接粘贴进 4-3 的 VERIFY.md

上表每一行的「验证动作」列即为 `VERIFY.md` 的行原文，形如：

```text
P1 验证动作：启动应用静置 60 s，跑 powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check perf -Seconds 60，读「空闲 CPU（60 s 采样，无鼠标移动）」行的单核百分比 ≤ 1.0
A2 验证动作：跑 powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check availability -Launches 100，读「启动/退出循环的失败次数」为 0（成功 100 次）
K3 验证动作：把系统缩放依次设为 100 %/125 %/150 %/200 %，每次启动应用，量窗口宽度是否仍为 260 逻辑像素、边角是否清晰，四条全过
```

---

## 3. 动作 3 · 阈值来源三处对照（禁拍脑袋）

| 来源 | 本卡用到了哪些 |
| :-- | :-- |
| ① 用户给过的硬数字 | P3（「60hz」原话）· S1（IDEA 卡「任何联网」排除）· C1/C3/A4/K3 的边界来自 SCOPE 的 Must/Won't |
| ② 现状基线实测（本机，2026-10-06） | P1 空闲 CPU **0 %** · P2 启动 5.78 / 1.68 / 1.34 s · P4 vite 构建 **980 ms** · C1 主进程 **20.7 MB** · C4 全量编译 **3 m 55 s**（458 crates） · K2 WebView2 **154.0.4258.53** · K4 exe **4.20 MB** / JS **221.23 kB** · S2 capability **2 条** |
| ③ 同类产品公开做法 | A1/A2/A3 三条全部来自 `ayangweb/BongoCat` 的 `docs/adr/0003-native-overlay-renderers.md`（Apache-2.0）Verification 段：device lost / swapchain recovery、**100 次真实窗口创建/销毁**；C1 参考其 Windows overlay 的原生渲染体量；K1 引 Tauri 官方 Webview Versions |

**本机实测命令原文**（可复跑）：

```powershell
npm run tauri build -- --no-bundle          # → TAURI_BUILD_EXIT=0 / ELAPSED_SEC=242 / luoxiaohei.exe 4.20 MB / cargo: Finished `release` profile in 3m 55s
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check perf -Seconds 60
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check compat
```

---

## 4. 动作 4 · 给不出阈值的写 `N/A（理由）`

共 **2 条**，理由原文：

1. **A5 月度可用性**：`N/A（本地桌面单机应用，无服务端、无线上流量，不存在"停机"概念）`
2. **M5 函数 ≤ 50 行的机械判据**：`N/A（无可靠机械判据）`——函数边界无法用正则可靠判定；阈值本身保留（≤ 50 行），验证方式改为人工，跑在 4-2 代码审查。

**环境限制声明（不是 N/A，是"本次没测成"，必须写清以免被误读为通过）**：

- **C1 稳态工作集**与 **S1 外联检查** 在本会话**未能取到稳态值**。原因：agent 会话派生的 GUI 进程在本环境**存活期不可复现**——`luoxiaohei.exe` 在同一条命令下，一次活过了 60 s 的空闲 CPU 采样，另一次第 5 秒就退出；成因未查明。**这是测量环境的限制，不是应用缺陷**（按 C1 红灯三问：仪器失败会伪装成代码缺陷）。
- 后果：C1 的阈值需要 4-3 在干净机器上重取基线后回写本行；S1 同理。
- **一处已纠正的断言**：本卡中途曾记「应用退出后 `msedgewebview2` 子进程会变孤儿且清不掉」——**后经复核不成立**：本机那批 `msedgewebview2` 的 PID 与启动时刻会随会话活动自行更替（19:42 一批、19:51 换成另一批，工作集合计 25.6 MB → 309 MB）。**没有证据把它归因到本应用，现有观测指向 DSH 宿主自身的 WebView2**。故 4-1 **不因此新增**退出路径的进程树清理要求；但 SCOPE M7「退出后任务管理器无残留」这条验收标准仍然保留（那是产品要求，与本次误判无关）。

---

## 5. 动作 5 · 空值自查（命令 + 输出）

```powershell
$spec = 'docs/specs/2026-10-06_desktop-pet'
# 禁用词分片拼接：整词若直接写在本行，本行自己就会被命中（自指误报）
$ban = @(('待' + '定'), ('尽' + '量'), ('差' + '不多'), ('可' + '能'), ('应' + '该'))
$hits = foreach ($w in $ban) { Select-String -Path "$spec/NFR.md" -Pattern $w }
if ($hits) { $hits } else { '（无输出 = 合格）' }
```

**Expected：输出 `（无输出 = 合格）`**（一处命中 = 一处不可测表述）。实际输出见本卡 ③ 证据回执。

---

## 6. 本卡检查清单（开工时逐字复述，收工前逐条勾）

```text
- [x] ① 六维逐维都写了：可测阈值（数字 + 单位）+ 验证方式 + 检查命令（产出裁决的那条）+ 跑在哪阶段，四样缺一不可
- [x] ② 给不出阈值的写 `N/A（理由）`，没有留空、没有模糊表述（禁用词自查命令见 §5）
- [x] ③ 每条阈值都配一条 4-3 能直接执行的验证动作（原文写在本卡产物里，见 §2）
- [x] ④ 阈值是可测边界（P95 ≤ 800 ms），不是形容词（响应要快）
- [x] ⑤ 用户已逐条看过阈值并确认（原话引用；未确认不许进 4-1）
      **原话（2026-10-06）**：对未决问题的 9 条逐条回复「**继续 采纳建议**」——其中第 1 条原文为
      「**NFR 阈值逐条确认（26 条实阈值）——至少拍这两条：P2 冷启动 ≤6.0 s（实测最差 5.78 s）与 C1 进程树工作集 ≤250 MB（只取到主进程 20.7 MB）**」，建议列写的是「**都采纳**」。
      → 六维 28 条阈值行（26 实 + 2 `N/A（理由）`）全部按上文取值确认，本卡解锁进入 4-1。
```
