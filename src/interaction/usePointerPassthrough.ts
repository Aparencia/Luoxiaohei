// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 4 ｜ M6 的副作用层：**零定时器**，只消费 useCursorFollow 的同一拍
//
// 为什么这里一行采样都没有（ARCHITECTURE §5 第 2 行）：瞳孔跟随只允许一个定时器（60Hz）。
// 本模块从参数拿 `cursorScreen`，自己不读坐标、不起表——再起一个 60Hz 就是 120 次/秒 IPC，
// 直接顶 NFR perf P1（空闲 CPU ≤1%）。`dragExit.test.ts` 的 KP-12·① 会扫这个文件的源码盯死它。
//
// 为什么判定要过一层"端口"（D14①：依赖显式传入，禁止函数深处直连全局单例）：
// 真正的副作用只有一条——`set_ignore_cursor_events`。把它做成参数之后，"未翻转不 invoke"
// 这条判据（TESTPLAN KP-12 / MUT-8 的靶子）就能在 Node 里数 IPC 次数，而不是靠"看代码觉得对"。
//
// 为什么不进 React state（DESIGN §2 的 D-c 行）：`overCharacter` 不驱动任何渲染，只决定"要不要翻转"。
// 放进 state 会让 App 每次穿越猫身边界都重渲染一次，而渲染结果完全一样（D12：不产生行为差异的状态删掉）。
import { useEffect, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { characterBounds } from "../character/geometry.ts";
import type { Bounds, Point } from "../character/geometry.ts";
import { isOverCharacter, screenToViewport } from "./hitTest.ts";
import { reportIpcFailure } from "./useCursorFollow.ts";

const SET_IGNORE = "plugin:window|set_ignore_cursor_events";

export type PassthroughPorts = {
  /** 真正的副作用：`true` = 窗口不再接收光标事件（点击落到背后的桌面）。 */
  setIgnore: (ignore: boolean) => Promise<void>;
  /** 失败报告端口：共用的 E-IPC-01 落点（DESIGN §3.3 的格式，实现在 useCursorFollow.ts）。 */
  reportFailure: (command: string, error: unknown) => void;
};

export type PassthroughController = {
  /** 喂一拍的值。`cursorScreen` / `windowOrigin` 为 `null`（E-IPC-02）时不改变上一次的取值。 */
  update: (cursorScreen: Point | null, windowOrigin: Point | null, scaleFactor: number) => void;
};

/**
 * 穿透开关的状态机（纯逻辑 + 注入副作用）。
 * `bounds` 可注入只是为了测试能喂固定盒子；生产路径用 `characterBounds()` 的默认值。
 */
export function createPassthrough(
  ports: PassthroughPorts,
  bounds: Bounds[] = characterBounds(),
): PassthroughController {
  // `null` = 还没下发过（首拍必定下发一次）；此后它就是"窗口当前的实际取值"
  let applied: boolean | null = null;
  return {
    update: (cursorScreen, windowOrigin, scaleFactor) => {
      // E-IPC-02：坐标或窗口几何取不到 → **保持上一次取值**，不许翻成整窗穿透（DESIGN §3.3 明文）
      if (cursorScreen === null || windowOrigin === null) return;
      // U1：缩放读不到时不猜（猜错会让门限整体偏移）；下一拍读到再判定
      if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return;
      const over = isOverCharacter(screenToViewport(cursorScreen, windowOrigin, scaleFactor), bounds);
      if (over === applied) return; // 未翻转：这一次 IPC 根本不该发（KP-12 的判据本体）
      // 先记后发：失败也记（否则下一拍会重试，变成 60 次/秒的失败风暴）。功能失效由门禁拦
      // （`acl OK 4/4` + `acl-callers`），不靠运行时兜（DESIGN §3.3 的 E-IPC-01 处置）。
      applied = over;
      void ports.setIgnore(!over).catch((error) => ports.reportFailure(SET_IGNORE, error));
    },
  };
}

/**
 * 真端口。授权口径：`set_ignore_cursor_events` **不在** `core:window:default` 的 28 条读查询里
 * （2-1 卡逐条读 `acl-manifests.json` 得来），它是批次 0 追加的具名授权
 * `core:window:allow-set-ignore-cursor-events`——缺它这条链路会在运行时被 ACL 拒绝（E-IPC-01）。
 */
export function tauriPassthroughPorts(): PassthroughPorts {
  return {
    setIgnore: (ignore) => getCurrentWindow().setIgnoreCursorEvents(ignore),
    reportFailure: reportIpcFailure,
  };
}

// ceiling: 判定只在"同一拍的值发生变化"时跑——窗口被拖动的那几帧用的还是**事件刷新后**的原点
// upgrade: 4-3 若观察到"拖动窗口时点击判定明显错位" → 在 `update` 里补一次同步读原点（多一条非逐帧 IPC）
// ceiling: 挂载到第一个 tick 之间（≤17ms）窗口还没被判定过（`applied = null`），这瞬间整窗可点
// upgrade: 若"启动瞬间点透明区不穿透"被当成缺陷 → 挂载时先发一次 `setIgnore(true)`，再交给判定接管
export function usePointerPassthrough(
  cursorScreen: Point | null,
  windowOrigin: Point | null,
  scaleFactor: number,
): void {
  const controller = useMemo(() => createPassthrough(tauriPassthroughPorts()), []);
  useEffect(() => {
    controller.update(cursorScreen, windowOrigin, scaleFactor);
  }, [controller, cursorScreen, windowOrigin, scaleFactor]);
}
