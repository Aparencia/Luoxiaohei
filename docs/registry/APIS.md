# APIS · 接口清单
> 最近核对 2026-10-06 @ 3-1 卡（设计卡首次登记；核对后填 <日期> @ <提交哈希> 的规矩见下行）
> 用法：加/改接口前先查；改完必须回写（设计卡更新，归档卡核对）。
> **新错误码必须登记在"错误码"列**——4-2 代码审查卡会 grep 核对，查不到 = 红灯。
> **本项目无服务端、无 HTTP 接口**（`docs/ARCHITECTURE.md` §1 已按"删比留空准"删除 API 行）。
> 真实接口面 = **Tauri IPC**：前端 `invoke('plugin:<模块>|<命令>', payload)` → `Promise`，**同进程、不监听端口、不对外暴露**（故不构成 AGENTS.md C3 红线域的「新增对外接口」）。

## IPC 命令（Tauri invoke，2026-10-06 · 3-1 卡登记）

> 命令字符串与 payload 形状**逐条从已装包源码读出**：`node_modules/@tauri-apps/api/window.js` 与 `node_modules/@tauri-apps/api/menu/`；设计依据见 `docs/specs/2026-10-06_desktop-pet/DESIGN.md` §3.1。

| # | 命令（路径） | 用途 | 鉴权（capability 条目） | 错误码 | 说明 |
| :-- | :-- | :-- | :-- | :-- | :-- |
| I1 | `plugin:window\|close` | 右键菜单「退出」→ 关窗并退出进程（SCOPE M7） | `core:window:allow-close` | `E-IPC-01` / `E-IPC-03` | req `{"label":"main"}` → res `null` |
| I2 | `plugin:window\|start_dragging` | 左键按住猫身拖动窗口（SCOPE M7） | `core:window:allow-start-dragging` | `E-IPC-01` | req `{"label":"main"}` → res `null`；**阻塞式**，与 60Hz 轮询并发（SCOPE U4） |
| I3 | `plugin:window\|set_ignore_cursor_events` | 透明区鼠标穿透开关（SCOPE M6） | `core:window:allow-set-ignore-cursor-events` | `E-IPC-01` | req `{"label":"main","value":true}` → res `null`；**仅在翻转时调用**，不逐帧调 |
| I4 | `plugin:window\|cursor_position` | 60Hz 全局光标采样（SCOPE M5） | `core:window:default` 已含 | `E-IPC-02` | req 无参数 → res `{"x":960,"y":540}` 或 `null` |
| I5 | `plugin:window\|current_monitor` | 取 `scaleFactor` 做混合 DPI 换算（SCOPE U1） | `core:window:default` 已含 | `E-IPC-02` | req 无参数 → res `{"name":"…","size":{…},"scaleFactor":1.25}` 或 `null` |
| I6 | `plugin:window\|outer_position` | 命中判定所需的窗口原点（SCOPE M6） | `core:window:default` 已含 | `E-IPC-02` | req `{"label":"main"}` → res `{"x":820,"y":460}` |
| I7 | `plugin:menu\|new` + `plugin:menu\|popup` | 右键原生菜单，**只有一项「退出」**（SCOPE M7） | `core:menu:default` | `E-IPC-01` / `E-IPC-02` | `new` req `{"kind":"Menu","options":{…},"handler":<Channel>}` → res `["<rid>","<id>"]`；`popup` req `{"rid":"<rid>","kind":"Menu","window":"main","at":{"x":1100,"y":640}}` → res `null` |

## 错误码

> 本项目**不使用** 9xxx 占位通道（那是"本期不实现但契约先行的 HTTP 占位接口"专用）；无 HTTP → 无 503 语义。错误码定义与门禁拦截点同文见 `DESIGN.md` §3.3。

| 错误码 | 含义 | 现象 | 处置（代码写法定死） | 门禁拦截点 |
| :-- | :-- | :-- | :-- | :-- |
| `E-IPC-01` | capability 缺条目，ACL 拒绝该命令 | `invoke` 返回 rejected Promise | 不吞错：`console.error('[ipc] E-IPC-01 <命令名>', err)`；功能失效由门禁拦，不靠运行时兜底 | `src/tauriConfig.test.ts` 的 `acl OK 4/4` 用例 |
| `E-IPC-02` | 光标 / 显示器信息不可用（`cursorPosition()` 取不到值；`currentMonitor()` 返回 `null`） | **rejection**：`cursorPosition()` 内部 `new PhysicalPosition(null)` 抛 `TypeError: Cannot use 'in' operator …`（`@tauri-apps/api` v2.12.1 本机实测）；上游哪天修好了会回到契约原文的形态（Promise **resolved 为** `null`）——**两种形态都归本码**（4-2 的 S-03 勘误，原表只写了后者） | 瞳孔回正 0°、幅度 0；穿透开关保持上一次取值；不重试、不写盘。`readCursorScreen()` **同时挡两种形态**，判据用 `instanceof TypeError` 而不是比字符串——ACL 拒绝抛的是 Rust 给的字符串（那是 `E-IPC-01`），两者混起来 KP-14 会空转 | `src/interaction/dragExit.test.ts` 的 **KP-13**（真封装 + mock 回 `null`，实测就是这条 TypeError）；`gaze.test.ts` / `hitTest.test.ts` 的 `null` 入参用例只覆盖纯函数侧 |
| `E-IPC-03` | 窗口生命周期末端的调用（`close()` 之后仍有 tick 排队） | rejected Promise | 忽略（`close()` 是最后一动作，进程随即退出） | 无（不可达路径；4-2 审查核对"`close()` 后不再写状态"） |

## 约定

- 错误响应统一结构：`{ code, message, detail? }` —— 本约定**仅适用于未来若引入 HTTP 接口时**；当前的 IPC 错误形态是 rejected Promise，不带结构体。
- 404 = 路径不存在；503 + 9xxx 错误码 = 功能故意未做（负向契约）—— 同上，本项目无适用对象。
- **能力边界**：本项目不新增任何对外接口。Tauri `invoke` 是同进程 IPC，不监听端口、不对外暴露（RESEARCH §9 第 4 条已判）。
