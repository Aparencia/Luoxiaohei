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
import { characterBounds, mayBeOnTail, tailSwayAngleAt } from "../character/geometry.ts";
import type { Bounds, Point } from "../character/geometry.ts";
import { isOverCharacter, screenToViewport } from "./hitTest.ts";
import { noteIpcSuccess, reportIpcFailure } from "./useCursorFollow.ts";

const SET_IGNORE = "plugin:window|set_ignore_cursor_events";

export type PassthroughPorts = {
  /** 真正的副作用：`true` = 窗口不再接收光标事件（点击落到背后的桌面）。 */
  setIgnore: (ignore: boolean) => Promise<void>;
  /** 失败报告端口：共用的 E-IPC-01 落点（DESIGN §3.3 的格式，实现在 useCursorFollow.ts）。 */
  reportFailure: (command: string, error: unknown) => void;
  /**
   * 尾巴**当前**的摆动角（度，绕尾根）。命中环要跟着 CSS 动画转（4-2 第 2 轮的 R-13）。
   * 只在这一拍的光标可能落在尾巴上时才会被调用（`mayBeOnTail` 先判）——空闲时一次样式读都不发。
   */
  readTailRotation: () => number;
  /** 成功端口：解除该命令的静音（`UI.md` §2 S3「恢复后再失败才再打」的另一半，4-2 的 R-16）。 */
  noteSuccess: (command: string) => void;
};

export type PassthroughController = {
  /** 喂一拍的值。`cursorScreen` / `windowOrigin` 为 `null`（E-IPC-02）时不改变上一次的取值。 */
  update: (cursorScreen: Point | null, windowOrigin: Point | null, scaleFactor: number) => void;
};

/**
 * 穿透开关的状态机（纯逻辑 + 注入副作用）。
 * `boundsFor` 可注入只是为了测试能喂固定形状；生产路径用 `characterBounds()` 的默认值。
 * 它收**摆角**（而不是直接收一组 `Bounds`）是因为命中区域依赖动画相位：尾巴甩到两端时
 * 静态轮廓与画出来的尾巴差 1.48%~3.30% 的窗口面积，那几帧点得中/点不中全看这个入参。
 */
export function createPassthrough(
  ports: PassthroughPorts,
  boundsFor: (tailRotationDeg: number) => Bounds[] = characterBounds,
): PassthroughController {
  // `null` = 还没下发过（首拍必定下发一次）；此后它就是"窗口当前的实际取值"
  let applied: boolean | null = null;
  // 摆角没变就复用上一组形状：光标不在尾巴附近时（绝大多数帧）恒为 0°，于是每拍零分配
  let cachedDeg: number | null = null;
  let cached: Bounds[] = [];
  const boundsAt = (deg: number): Bounds[] => {
    if (cachedDeg !== deg) {
      cachedDeg = deg;
      cached = boundsFor(deg);
    }
    return cached;
  };
  return {
    update: (cursorScreen, windowOrigin, scaleFactor) => {
      // E-IPC-02：坐标或窗口几何取不到 → **保持上一次取值**，不许翻成整窗穿透（DESIGN §3.3 明文）
      if (cursorScreen === null || windowOrigin === null) return;
      // U1：缩放读不到时不猜（猜错会让门限整体偏移）；下一拍读到再判定
      if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return;
      const viewport = screenToViewport(cursorScreen, windowOrigin, scaleFactor);
      // 相位只在"点可能落在尾巴上"时才值得问（R-13）：旋转保距，圈外的点按 0° 判不会误判
      const deg = mayBeOnTail(viewport) ? ports.readTailRotation() : 0;
      const over = isOverCharacter(viewport, boundsAt(Number.isFinite(deg) ? deg : 0));
      if (over === applied) return; // 未翻转：这一次 IPC 根本不该发（KP-12 的判据本体）
      // 先记后发：失败也记（否则下一拍会重试，变成 60 次/秒的失败风暴）。功能失效由门禁拦
      // （`acl OK 4/4` + `acl-callers`），不靠运行时兜（DESIGN §3.3 的 E-IPC-01 处置）。
      applied = over;
      void ports
        .setIgnore(!over)
        .then(() => ports.noteSuccess(SET_IGNORE))
        .catch((error) => ports.reportFailure(SET_IGNORE, error));
    },
  };
}

/**
 * 尾巴当前的旋转角（度）：问**动画自己的时钟**，不在 JS 里另起一份相位。
 *
 * 为什么必须问浏览器（R-13）：±8° 的摆动是 CSS 动画（`heicat.css` 的 `tailSway`，MOTION §2），
 * 相位由浏览器的动画时间轴持有。在 JS 里按 `performance.now()` 复算一遍就会与屏幕上的猫错开
 * （动画在文档时间轴上跑，页签被节流或机器休眠时两者不同步）——错开的表现是"看得见的尾巴点不动"。
 *
 * 为什么取 `currentTime` 而不是渲染值（4-2 第 2 轮实测，探针在 `%TEMP%\r3-pixels`）：
 * 这套 Chromium 里**合成器动画**的当前值读不出来——`getComputedStyle(el).transform` 恒为 `none`、
 * Typed OM 同样、`getBoundingClientRect()` 也不随动画变；只有 Web Animations API 的
 * `currentTime` 在走（实测 200.026 → 400.018 → 600.01 → 800.002）。角度由 `tailSwayAngleAt`
 * 这个纯函数映射，而它的常量被 M6·⑨ 逐项绑回 `heicat.css` 的关键帧。
 *
 * 读不到（元素还没挂上 / Node 里没有 DOM / `reduce` 分支下动画不存在 / `currentTime` 不是数字）
 * 一律回 0 = **静态模型** = 本批之前的行为，不会比现在更差。
 */
function readTailRotationDeg(): number {
  if (typeof document === "undefined") return 0;
  const tail = document.querySelector(".hei-tail");
  const currentTime = tail?.getAnimations?.()[0]?.currentTime;
  return typeof currentTime === "number" ? tailSwayAngleAt(currentTime) : 0;
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
    readTailRotation: readTailRotationDeg,
    noteSuccess: noteIpcSuccess,
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
