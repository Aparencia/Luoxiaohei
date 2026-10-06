# nfr.ps1 · 2-4 卡「六维非功能阈值」的检查命令（一条命令产出一个能判红/绿的裁决）
#
# 用法（在项目根）：
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/nfr.ps1 -Check perf
#   -Check 取值：perf | capacity | availability | security | maintainability | compat | all
#   可选：-Seconds 60（CPU 采样秒数）、-Hours 8（长跑浸泡小时数）、-Launches 100（启停循环次数；**给了才跑 A2**）
#
# 退出码：0 = 本维全部阈值通过；1 = 有阈值不达标；2 = 环境不满足（产物/进程缺失 → 没法测，**不是通过**）
#
# 数字口径（口径与数字必须同时声明，见 docs/lessons/2026-09-11_数字口径与CRLF.md）：
#   CPU%  = 单核百分比 = Δ进程 CPU 时间 ÷ Δ墙钟时间 × 100（**不是**任务管理器那种"占全机"百分比）
#   内存  = WorkingSet64（工作集），进程树（主进程 + WebView2 子进程）求和
#   行数  = [IO.File]::ReadAllLines().Count（含空行；禁 Get-Content）

[CmdletBinding()]
param(
    [ValidateSet('perf', 'capacity', 'availability', 'security', 'maintainability', 'compat', 'all')]
    [string]$Check = 'all',
    [int]$Seconds = 60,
    [int]$Hours = 0,
    [int]$Minutes = 0,
    [int]$Launches = 100
)

chcp 65001 > $null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'src-tauri\target\release\luoxiaohei.exe'
$distDir = Join-Path $root 'dist'

# ---- 阈值表：与 docs/specs/2026-10-06_desktop-pet/NFR.md 逐行对应；改这里必须同批改 NFR.md ----
$TH = @{
    IdleCpuPercent     = 1.0      # 空闲 CPU（单核%）上限
    WorkingSetMB       = 250      # 进程树工作集上限（稳态）
    StartupSeconds     = 6.0      # 冷启动到窗口可见上限（热启动中位数 ≤3.0 s 为回归参考）
    ExeSizeMB          = 20       # 主程序体积上限
    MaxSourceLines     = 500      # 单文件行数上限（测试文件 1000）
    MaxTestFileLines   = 1000     # 测试文件行数上限
    MaxPermissionCount = 5        # capability 授权条目上限（最小权限）：core:default + 4 条窗口/菜单命令
    MinWindowsBuild    = 17763    # Windows 10 1809
    MinWebView2Major   = 100
    LeakGrowthMB       = 5        # 长跑工作集增长上限
    LaunchFailuresMax  = 0        # 启停失败次数上限
}

$script:fail = 0
$script:env = 0

function Say([string]$tag, [string]$msg) { Write-Host ("[{0}] {1}" -f $tag, $msg) }
function Pass([string]$msg) { Say 'OK' $msg }
function Fail([string]$msg) { Say 'FAIL' $msg; $script:fail++ }
function Env([string]$msg) { Say 'ENV' $msg; $script:env++ }
function Cmp([double]$actual, [double]$limit, [string]$unit, [string]$what) {
    $t = if ($actual -le $limit) { 'OK' } else { 'FAIL' }
    Say $t ("{0} = {1} {2}（阈值 ≤ {3}）" -f $what, $actual, $unit, $limit)
    if ($t -eq 'FAIL') { $script:fail++ }
}

# ---- 进程树工具：主进程 + WebView2 子进程（内存/CPU 必须按树求和，单看主进程会漏掉渲染进程）----
function Get-ProcessTree([int]$rootPid) {
    $all = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Select-Object ProcessId, ParentProcessId, Name)
    $ids = New-Object System.Collections.ArrayList
    [void]$ids.Add($rootPid)
    $added = $true
    while ($added) {
        $added = $false
        foreach ($p in $all) {
            if (($ids -contains [int]$p.ParentProcessId) -and -not ($ids -contains [int]$p.ProcessId)) {
                [void]$ids.Add([int]$p.ProcessId); $added = $true
            }
        }
    }
    return $ids
}
function Get-TreeWorkingSetMB([int]$rootPid) {
    $sum = 0
    foreach ($id in (Get-ProcessTree $rootPid)) {
        $p = Get-Process -Id $id -ErrorAction SilentlyContinue
        if ($p) { $sum += $p.WorkingSet64 }
    }
    return [Math]::Round($sum / 1MB, 2)
}

$procName = 'luoxiaohei'
function Get-AppProcess { Get-Process -Name $procName -ErrorAction SilentlyContinue | Select-Object -First 1 }

# ================= compat =================
function Check-Compat {
    Say '--' 'compat · 目标环境'
    $os = Get-CimInstance Win32_OperatingSystem
    $build = [int]$os.BuildNumber
    if ($build -ge $TH.MinWindowsBuild) { Pass ("Windows build {0} ≥ {1}（Windows 10 1809+）" -f $build, $TH.MinWindowsBuild) }
    else { Fail ("Windows build {0} < {1}" -f $build, $TH.MinWindowsBuild) }

    $wvKey = 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
    $wv = (Get-ItemProperty $wvKey -ErrorAction SilentlyContinue).pv
    if ($wv) {
        $maj = [int]($wv -split '\.')[0]
        if ($maj -ge $TH.MinWebView2Major) { Pass ("WebView2 {0}（major {1} ≥ {2}）" -f $wv, $maj, $TH.MinWebView2Major) }
        else { Fail ("WebView2 {0} major {1} < {2}" -f $wv, $maj, $TH.MinWebView2Major) }
    } else { Env 'WebView2 版本未在注册表取到（可能在 HKCU 或随系统预装）' }

    if (Test-Path $exe) { Cmp ([Math]::Round((Get-Item $exe).Length / 1MB, 2)) $TH.ExeSizeMB 'MB' '主程序体积' }
    else { Env "未找到 $exe —— 先跑 npm run tauri build -- --no-bundle" }
}

# ================= maintainability =================
function Check-Maintainability {
    Say '--' 'maintainability · 可维护'
    $files = @()
    $files += Get-ChildItem (Join-Path $root 'src') -Recurse -File -Include *.ts, *.tsx -ErrorAction SilentlyContinue
    $files += Get-ChildItem (Join-Path $root 'src-tauri\src') -Recurse -File -Include *.rs -ErrorAction SilentlyContinue
    $files += Get-ChildItem (Join-Path $root 'scripts') -Recurse -File -Include *.ps1 -ErrorAction SilentlyContinue
    if ($files.Count -eq 0) { Env '没找到任何源文件'; return }

    $worst = 0; $worstF = ''
    foreach ($f in $files) {
        $n = [IO.File]::ReadAllLines($f.FullName).Count
        $limit = if ($f.Name -match '\.(test|spec)\.') { $TH.MaxTestFileLines } else { $TH.MaxSourceLines }
        if ($n -gt $limit) { Fail ("{0} = {1} 行 > 上限 {2}" -f $f.FullName.Substring($root.Length + 1), $n, $limit) }
        if ($n -gt $worst) { $worst = $n; $worstF = $f.FullName.Substring($root.Length + 1) }
    }
    Pass ("已扫 {0} 个源文件，单文件最长 {1} 行（{2}）≤ 上限 {3}/{4}" -f $files.Count, $worst, $worstF, $TH.MaxSourceLines, $TH.MaxTestFileLines)

    # .ps1 一律 UTF-8 带 BOM：无 BOM 时 Windows PowerShell 5.1 按系统码页(GBK)读 → 中文判词乱码甚至 ParserError。
    # 这条不是理论：2026-10-06 本项目的 scripts/nfr.ps1 被一次编辑掉掉 BOM 后，`-ge` 里的 `≥` 变成 `鈮?`，
    # 脚本直接 ParserError 退出码 1，看起来像"阈值不达标"——仪器失败伪装成代码缺陷。故做成机器断言。
    # 枚举口径为什么用 -Filter 而不是 -Include（4-2 第二轮复审 P3；本机实测）：`-Include` 只在同时给了 `-Recurse` 时才生效——
    # `Get-ChildItem $root -File -Include *.ps1`（无 -Recurse）实测返回 **0 个**，且不报错不告警；于是「1 个 .ps1 全部带 BOM」
    # 只覆盖了 scripts/nfr.ps1，根目录的 check/doctor/gate/orphans/security 五个被静默丢掉（判据是对的，覆盖面 1/6 = 假绿）。
    # `-Filter` 由文件系统提供程序在枚举层过滤，不依赖 -Recurse；打印「已扫 N 个」是为了跟它的文件数对账，漏扫看得见。
    $ps1 = @()
    $ps1 += Get-ChildItem (Join-Path $root 'scripts') -Recurse -File -Filter *.ps1 -ErrorAction SilentlyContinue
    $ps1 += Get-ChildItem $root -File -Filter *.ps1 -ErrorAction SilentlyContinue
    $ps1 = @($ps1 | Sort-Object -Property FullName -Unique)   # 去重：将来若 scripts/ 换成根下子目录也不会重复计数
    $noBom = @()
    foreach ($f in $ps1) {
        $b = [IO.File]::ReadAllBytes($f.FullName)
        $hasBom = ($b.Length -ge 3) -and ($b[0] -eq 0xEF) -and ($b[1] -eq 0xBB) -and ($b[2] -eq 0xBF)
        if (-not $hasBom) { $noBom += $f.FullName.Substring($root.Length + 1) }
    }
    if ($noBom.Count -eq 0) { Pass ("已扫 {0} 个 .ps1（scripts/ + 项目根），全部 UTF-8 带 BOM" -f $ps1.Count) }
    else { Fail ("已扫 {0} 个 .ps1，其中以下 {1} 个缺 UTF-8 BOM（PS 5.1 会按系统码页读，中文判词乱码/解析失败）：{2}" -f $ps1.Count, $noBom.Count, ($noBom -join ', ')) }

    # 门禁本身必须绿——"写了测试"不等于"跑过"
    $gate = Join-Path $root 'check.ps1'
    if (Test-Path $gate) {
        $out = & powershell -NoProfile -ExecutionPolicy Bypass -File $gate 2>&1
        if ($LASTEXITCODE -eq 0) { Pass 'check.ps1 退出码 0' } else { Fail ("check.ps1 退出码 {0}（末行：{1}）" -f $LASTEXITCODE, ($out | Select-Object -Last 1)) }
    } else { Env 'check.ps1 不存在' }
}

# ================= security =================
function Check-Security {
    Say '--' 'security · 安全（最小权限 / 零外联）'
    $cap = Join-Path $root 'src-tauri\capabilities\default.json'
    if (Test-Path $cap) {
        $j = Get-Content -LiteralPath $cap -Raw -Encoding UTF8 | ConvertFrom-Json
        $n = @($j.permissions).Count
        if ($n -le $TH.MaxPermissionCount) { Pass ("capability 授权条目 {0} 条 ≤ {1}（最小权限）" -f $n, $TH.MaxPermissionCount) }
        else { Fail ("capability 授权条目 {0} 条 > {1}" -f $n, $TH.MaxPermissionCount) }
    } else { Env 'capabilities/default.json 不存在' }

    $tr = & git -C $root ls-files 2>$null
    if (@($tr | Where-Object { $_ -match '(^|/)\.env$' }).Count -eq 0) { Pass '.env 未被 git 跟踪' }
    else { Fail '.env 已被 git 跟踪（密钥入仓）' }

    $p = Get-AppProcess
    if (-not $p) { Env '应用未在运行——外联检查需要先启动（-Check security 会在启动后复测）'; return }
    $ids = Get-ProcessTree $p.Id
    $conns = @(Get-NetTCPConnection -ErrorAction SilentlyContinue | Where-Object { $ids -contains [int]$_.OwningProcess })
    $est = @($conns | Where-Object { $_.State -eq 'Established' })
    $lis = @($conns | Where-Object { $_.State -eq 'Listen' })
    if ($est.Count -eq 0) { Pass '无 ESTABLISHED 外联连接' } else { Fail ("有 {0} 条 ESTABLISHED 连接" -f $est.Count) }
    if ($lis.Count -eq 0) { Pass '无监听端口' } else { Fail ("有 {0} 个监听端口" -f $lis.Count) }
}

# ================= perf / capacity / availability 共用：启动与采样 =================
# 为什么不用 Start-Process（2026-10-06 实测教训）：本环境下 `Start-Process -PassThru` 会阻塞，
# 且 GUI 子进程会继承调用方的 stdout/stderr 管道——外层靠读管道判"命令是否结束"的调用方永远等不到 EOF，
# 表现为"命令挂住"，同时把启动耗时测成 61 s / 52 s 这种假值（真值 6 s 量级）。
# 仪器失败会伪装成"阈值不达标"，所以这里改用 ProcessStartInfo + UseShellExecute=$true：由 shell 启动，不继承我们的句柄。
function Start-App {
    if (-not (Test-Path $exe)) { Env "未找到 $exe —— 先跑 npm run tauri build -- --no-bundle"; return $null }
    $existing = Get-AppProcess
    if ($existing) { return $existing }
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $exe
    $psi.UseShellExecute = $true
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Normal
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $p = [System.Diagnostics.Process]::Start($psi)
    $deadline = 15000
    while ($sw.Elapsed.TotalMilliseconds -lt $deadline) {
        try { $p.Refresh() } catch { break }
        if ($p.HasExited) { break }
        if ($p.MainWindowHandle -ne 0) { break }
        Start-Sleep -Milliseconds 50
    }
    $sw.Stop()
    $script:startupSec = [Math]::Round($sw.Elapsed.TotalSeconds, 2)
    return $p
}

# 关闭应用按进程树杀：WebView2 渲染/GPU 子进程的存活与主进程解耦，父进程退出后它们可能仍占用 CPU/内存，
# 不按树杀会让下一次采样把上一轮的残留算进来（仪器串扰，不是被测物的缺陷）。
# ⚠️ 归因纠正（2026-10-06）：NFR §5 已**撤回**「主进程退出后 WebView2 子进程必变孤儿」这条断言——
# 本机 msedgewebview2 的 PID 与启动时刻会随会话活动自行更替（更可能是 DSH 宿主自身的 WebView2），
# 无法归因到本应用。故此处**只声明"按树杀"这一动作**，不引用任何残留计数；早期注释里的「实测残留 6 个」已删（TD-005）。
function Stop-App {
    $p = Get-AppProcess
    if (-not $p) { return }
    foreach ($id in (Get-ProcessTree $p.Id)) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
}

function Check-Perf {
    Say '--' 'perf · 性能'
    $p = Start-App
    if (-not $p) { return }
    if ($script:startupSec -gt 0) { Cmp $script:startupSec $TH.StartupSeconds 's' '启动到窗口可见（冷/暖按当次实况）' }

    Start-Sleep -Seconds 3   # 让首帧与 WebView2 渲染进程稳定
    $p.Refresh()
    $c0 = $p.TotalProcessorTime
    $sw = [Diagnostics.Stopwatch]::StartNew()
    Start-Sleep -Seconds $Seconds
    $sw.Stop()
    $p.Refresh()
    $cpuMs = ($p.TotalProcessorTime - $c0).TotalMilliseconds
    $idle = [Math]::Round($cpuMs / $sw.Elapsed.TotalMilliseconds * 100, 3)
    Cmp $idle $TH.IdleCpuPercent '%（单核）' ("空闲 CPU（{0} s 采样，无鼠标移动）" -f $Seconds)
}

function Check-Capacity {
    Say '--' 'capacity · 容量'
    $p = Get-AppProcess
    if ($p) {
        $ws = Get-TreeWorkingSetMB $p.Id
        Cmp $ws $TH.WorkingSetMB 'MB' '工作集（进程树求和）'
        $n = @(Get-ProcessTree $p.Id).Count
        Say 'OK' ("进程树 {0} 个进程（主进程 1 + WebView2 渲染/GPU 子进程）" -f $n)
    } else { Env '应用未在运行——先跑 -Check perf 或 -Check capacity（会自动启动）' }
}

function Check-Availability {
    Say '--' 'availability · 可用性'
    $p = Get-AppProcess
    if (-not $p) { $p = Start-App }
    if (-not $p) { return }

    $mins = $Minutes
    if ($Hours -gt 0) { $mins = $Hours * 60 }
    if ($mins -le 0) { $mins = 1 }
    $total = $mins * 60
    $ws0 = Get-TreeWorkingSetMB $p.Id
    Say 'i' ("长跑 {0} 分钟：起始工作集 {1} MB（期间每秒采样，可 Ctrl+C 中断）" -f $mins, $ws0)
    $peak = $ws0
    $elapsed = 0
    while ($elapsed -lt $total) {
        Start-Sleep -Seconds 5; $elapsed += 5
        $p.Refresh()
        if ($p.HasExited) { Fail ("应用在长跑第 {0} 秒退出（崩溃或被关闭）" -f $elapsed); return }
        $ws = Get-TreeWorkingSetMB $p.Id
        if ($ws -gt $peak) { $peak = $ws }
    }
    $grow = [Math]::Round($peak - $ws0, 2)
    Cmp $grow $TH.LeakGrowthMB 'MB' ("长跑 {0} 分钟后工作集增长（峰值口径）" -f $mins)
}

# ================= availability · 启停循环的窗口判据（Win32 P/Invoke） =================
# 为什么不能再用 `WaitForInputIdle` 当"窗口出现"（4-2 第二轮复审 P2；本机独立探针原文）：
#   WaitForInputIdle = True   MainWindowHandle = 1640244   MainWindowTitle = []
#   可见顶层窗口：hwnd=1640244 rect=0,0,16,16 area=256 class='Tao Thread Event Target'；4.3 s 后 exitcode = 0xC0000409
# 那个 True 指的是 tao 的 16×16 事件靶窗（与 STATE.md 风险摘要 ㊳ 同形），不是一个可见主窗口（tauri.conf.json 的 title 实测为空），
# 于是原判据把「窗口没出现」「进程自己崩了」「被杀才退出」三种真实失败全记成成功。下面两条硬判据把"窗口"钉死：
#   ① 面积 ≥ 40000 px²：靶窗只有 16×16 = 256 px²，而本应用的窗口是数百像素量级 ⇒ 40000 ≈ 200×200，正常窗口不会误伤（宁漏判不假红）；
#   ② 类名 ≠ 'Tao Thread Event Target'：该靶窗可见且同属本进程，是已实测的唯一假阳性来源——按类名排它比按面积猜更稳（面积随 DPI 漂移，类名不）。
function Initialize-NfrWindowApi {
    if ('NfrWin32' -as [type]) { return }
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
// 只枚举"本进程的可见顶层窗口"；面积/类名的筛选放在 PowerShell 侧，落选窗口也能原样进诊断行（判据失败时要看得见探到了什么）。
public class NfrWin32 {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder s, int max);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
    public static List<string[]> VisibleWindows(uint pid) {
        List<string[]> found = new List<string[]>();
        EnumWindows(delegate(IntPtr h, IntPtr l) {
            uint wpid; GetWindowThreadProcessId(h, out wpid);
            if (wpid == pid && IsWindowVisible(h)) {
                RECT r; GetWindowRect(h, out r);
                StringBuilder c = new StringBuilder(256); GetClassName(h, c, 256);
                found.Add(new string[] { h.ToInt64().ToString(), c.ToString(), ((r.Right - r.Left) * (r.Bottom - r.Top)).ToString() });
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
'@
}

$script:MinWindowAreaPx = 40000
$script:TaoEventWindowClass = 'Tao Thread Event Target'
$script:lastWinDump = ''    # 进程存活期间最后一次"看到了窗口但不合格"的快照，只用于失败诊断
# 窗口等待上界：这是**仪器上界**，不是新阈值——NFR P3 的「启动到窗口可见 ≤ 6.0 s」才是阈值，10 s 取它的 ~1.7 倍余量
$script:WindowAppearMs = 10000
# 请它自己退的宽限：WM_CLOSE 之后最多等这么久，超时才算"非正常退出"（强杀只做收尾，不参与判净）
$script:GracefulExitMs = 5000

function Get-AppWindows([int]$processId) {
    Initialize-NfrWindowApi
    $out = @()
    foreach ($w in [NfrWin32]::VisibleWindows([uint32]$processId)) {
        $out += [pscustomobject]@{ Handle = [IntPtr][int64]$w[0]; Class = $w[1]; Area = [int]$w[2] }
    }
    return $out
}
function Format-AppWindows($wins) {
    # 必须先滤掉 $null：PowerShell 的 `@($null)` 是**1 个元素**（不是 0 个）——函数返回空时
    # 参数位上的 `(Get-AppWindows ...)` 求值成 $null，不过滤就会打出 "  px²" 这种空壳诊断（本机踩过一次）。
    $list = @($wins | Where-Object { $null -ne $_ })
    if ($list.Count -eq 0) { return '无可见顶层窗口' }
    return (@($list | ForEach-Object { "{0} {1} px²" -f $_.Class, $_.Area }) -join ' ｜ ')
}
# 等真窗口出现。进程自己先退出就提前收手（"不会再出现"是确定的，没必要干等满超时——本机单次崩溃实测 4.3~19.8 s 不等）
function Wait-AppWindow([System.Diagnostics.Process]$p, [int]$timeoutMs) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalMilliseconds -lt $timeoutMs) {
        $wins = @(Get-AppWindows $p.Id)
        if ($wins.Count -gt 0) { $script:lastWinDump = Format-AppWindows $wins }
        foreach ($w in $wins) {
            if ($w.Area -ge $script:MinWindowAreaPx -and $w.Class -ne $script:TaoEventWindowClass) { return $w }
        }
        try { $p.Refresh() } catch { return $null }
        if ($p.HasExited) { return $null }
        Start-Sleep -Milliseconds 100
    }
    return $null
}

function Check-LaunchCycle {
    Say '--' 'availability · 启停循环'
    if (-not (Test-Path $exe)) { Env "未找到 $exe"; return }

    # 失败三类分开计（复审要求：100 次里哪一类失败必须看得出来）：① 窗口未出现 ② 非正常退出（含 ExitCode ≠ 0）③ 残留进程。
    # 一个循环最多归一类，优先级 ① > ② > ③——① 是根因时 ② 通常只是它的下游（进程崩了当然也没法"干净退出"），拆开记等于同一件事数两遍。
    # 这样保证「三类之和 = 失败循环数 = K」，最后那行「成功 M 次 = N − K」才自洽（否则一次循环记两笔，M 会算成负数）。
    $noWindow = 0; $badExit = 0; $leftover = 0
    $exitCodes = @{}
    $detailPrinted = $false

    for ($i = 1; $i -le $Launches; $i++) {
        $script:lastWinDump = ''
        $p = $null
        try {
            $psi2 = New-Object System.Diagnostics.ProcessStartInfo
            $psi2.FileName = $exe
            $psi2.UseShellExecute = $true
            $psi2.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Normal
            $p = [System.Diagnostics.Process]::Start($psi2)
        } catch { $p = $null }

        # ---- 阶段 1：窗口出现（硬判据见文件上方那段 Why）----
        $win = $null
        if ($p) { $win = Wait-AppWindow $p $script:WindowAppearMs }
        $winDump = if ($p) { Format-AppWindows (Get-AppWindows $p.Id) } else { '（进程根本没起来）' }
        if ($winDump -eq '无可见顶层窗口' -and $script:lastWinDump) {
            $winDump = "{0}（存活期间观测到，但不满足 面积 ≥ {1} px² 且 类名 ≠ 靶窗）" -f $script:lastWinDump, $script:MinWindowAreaPx
        }

        # ---- 阶段 2：退出（先请它自己退，再判干不干净）----
        # 为什么不再"先强杀再看 HasExited"：NFR A2 要的是「**都干净退出**」。强杀之后再读 HasExited，等于把
        # "被杀才退出"记成成功——那是我们自己动的手，不是应用自己退的，证明不了任何事。
        $exitNote = ''
        if ($p) {
            $dead = $true
            try { $p.Refresh(); $dead = $p.HasExited } catch { $dead = $true }
            if ($dead) { $exitNote = '未收到关闭请求就自行退出（崩溃/被杀）' }
            else {
                # WM_CLOSE 发给**枚举到的真窗口**句柄，而不是 `$p.CloseMainWindow()`：本机实测 MainWindowHandle 指的就是那个
                # 16×16 靶窗，对靶窗发 WM_CLOSE 不会让应用退出 ⇒ 判据会变成假超时。
                $signalled = $false
                if ($win) { $signalled = [NfrWin32]::PostMessage($win.Handle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) }
                if (-not $signalled) { try { $signalled = $p.CloseMainWindow() } catch { $signalled = $false } }
                if (-not $signalled) { $exitNote = '没有可发 WM_CLOSE 的窗口句柄' }
                else {
                    $sw2 = [Diagnostics.Stopwatch]::StartNew()
                    while ($sw2.Elapsed.TotalMilliseconds -lt $script:GracefulExitMs) {
                        try { $p.Refresh() } catch { break }
                        if ($p.HasExited) { break }
                        Start-Sleep -Milliseconds 100
                    }
                    $sw2.Stop()
                    if (-not $p.HasExited) { $exitNote = ('WM_CLOSE 后 {0} ms 内未退出' -f $script:GracefulExitMs) }
                }
            }
            if ($p.HasExited) {
                # 退出码留档：0xC0000409 这类"崩溃"与"被 WM_CLOSE 正常关闭"在这一行里区分得出来
                $code = $null
                try { $code = $p.ExitCode } catch { $code = $null }
                if ($null -ne $code) {
                    $key = '0x{0:X8}' -f $code
                    if (-not $exitCodes.ContainsKey($key)) { $exitCodes[$key] = 0 }
                    $exitCodes[$key]++
                    if (-not $exitNote -and $code -ne 0) { $exitNote = "退出码 $key（非 0）" }
                }
            }
        }

        # ---- 阶段 3：收尾兜底 + 残留 ----
        # 强杀只在这里出现，且**改不了阶段 2 的结论**：超时没退 / 窗口都没出现时不能把进程留在机器上，但 Kill 这个动作
        # 本身不算"干净退出"，也不额外记一笔失败（失败已在 $win / $exitNote 里记过）。3000 ms 是等强杀收干净的宽限。
        $residual = $false
        if ($p) {
            try { $p.Refresh() } catch { }
            if (-not $p.HasExited) {
                foreach ($cid in (Get-ProcessTree $p.Id)) { Stop-Process -Id $cid -Force -ErrorAction SilentlyContinue }
            }
            $sw3 = [Diagnostics.Stopwatch]::StartNew()
            while ($sw3.Elapsed.TotalMilliseconds -lt 3000) {
                if (-not (Get-Process -Id $p.Id -ErrorAction SilentlyContinue)) { break }
                Start-Sleep -Milliseconds 100
            }
            # 残留按 PID + 进程名双查：PID 会被系统复用，而 NFR A4 已定"同时只允许 1 个应用进程组"，此刻还有同名进程 = 本轮没清干净
            if (Get-Process -Id $p.Id -ErrorAction SilentlyContinue) { $residual = $true }
            elseif (@(Get-Process -Name $procName -ErrorAction SilentlyContinue).Count -gt 0) { $residual = $true }
        }

        # ---- 归类：一个循环只记一笔，三类之和 = 失败循环数 ----
        if (-not $win) { $noWindow++ }
        elseif ($exitNote) { $badExit++ }
        elseif ($residual) { $leftover++ }

        if ((-not $win) -or $exitNote -or $residual) {
            if (-not $detailPrinted) {
                $detailPrinted = $true
                $why = if ($exitNote) { $exitNote } else { '正常' }
                Say 'i' ("首个失败循环 #{0} 现场：可见顶层窗口 = {1}；退出 = {2}；残留进程 = {3}" -f $i, $winDump, $why, $residual)
            }
        }
        if (($i % 10) -eq 0) { Say 'i' ("已完成 {0}/{1} 次（窗口未出现 {2} / 非正常退出 {3} / 残留进程 {4}）" -f $i, $Launches, $noWindow, $badExit, $leftover) }
    }

    $k = $noWindow + $badExit + $leftover
    Say 'i' ("失败分项：窗口未出现 {0} 次 ｜ 非正常退出 {1} 次 ｜ 残留进程 {2} 次（三项之和 = {3} = 失败循环数）" -f $noWindow, $badExit, $leftover, $k)
    if ($exitCodes.Count -gt 0) {
        $pairs = @($exitCodes.GetEnumerator() | Sort-Object -Property Name | ForEach-Object { "{0} × {1} 次" -f $_.Key, $_.Value })
        Say 'i' ("本轮观测到的进程退出码：{0}（0x00000000 之外都算非正常退出）" -f ($pairs -join '、'))
    }
    $cnt = $Launches - $k
    Cmp $k $TH.LaunchFailuresMax '次' ("{0} 次启动/退出循环的失败次数（成功 {1} 次）" -f $Launches, $cnt)
}

# ================= 主流程 =================
Say 'i' ("nfr.ps1 · -Check {0} · 项目根 {1}" -f $Check, $root)

if ($Check -eq 'all' -or $Check -eq 'compat') { Check-Compat }
if ($Check -eq 'all' -or $Check -eq 'maintainability') { Check-Maintainability }
if ($Check -eq 'all' -or $Check -eq 'security') { Check-Security }
if ($Check -eq 'all' -or $Check -eq 'perf') { Check-Perf }
if ($Check -eq 'all' -or $Check -eq 'capacity') { Check-Capacity }
if ($Check -eq 'all' -or $Check -eq 'availability') { Check-Availability }
# A2 的启停循环（NFR.md:48）：只有**显式给了 -Launches** 才跑——与 -Hours / -Minutes 同一形态（不传 = 不跑那条阈值）。
# 4-2 的 S-01：这个开关以前不存在——A2 的检查器**定义了却没有调用点**，而 NFR.md:48/91 把 A2 的验证动作
# 写成 `-Check availability -Launches 100` ⇒ 照它跑只会执行长跑浸泡、打印「本维全部阈值通过」并 exit 0，
# A2 从未被测量却拿到绿色（假绿）。接线后同一命令会真的跑 100 次启停，并打印「启动/退出循环的失败次数」那一行。
# ⚠️ 这段注释刻意**不写那个函数名**：`orphans.ps1` 的「零引用导出」判据扫全文，注释里提一次
# 就等于把这条机械判据关掉。实测过一次（同类坑见 STATE.md 风险摘要 ㊶/㊸）：注释里写了名字之后，
# 把下面这行接线删掉，判据仍然报「零引用导出 0 项」——判据被自己的注释满足了。
if (($Check -eq 'all' -or $Check -eq 'availability') -and $PSBoundParameters.ContainsKey('Launches')) { Check-LaunchCycle }

if ($Check -ne 'availability') { Say 'i' '关闭本次启动的应用实例（按进程树，含 WebView2 子进程）'; Stop-App }

Say '--' '汇总'
if ($script:fail -gt 0) { Say 'RESULT' ("{0} 项阈值不达标" -f $script:fail); exit 1 }
if ($script:env -gt 0) { Say 'RESULT' ("全部已测阈值通过，但有 {0} 项因环境缺失未能测（**不算通过**）" -f $script:env); exit 2 }
Say 'RESULT' '本维全部阈值通过'
exit 0
