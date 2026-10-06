// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 3 ｜ M5 的副作用层：全项目唯一的 60Hz 定时器持有者
//
// 为什么只有这个文件允许起定时器：ARCHITECTURE §5 第 2 行——「瞳孔跟随**只允许一个定时器**（60Hz）」。
// 批次 4 的 `usePointerPassthrough` 会消费同一个 tick 的 `cursorScreen`，**自己不起表**：
// 两个 60Hz 定时器 = 120 次/秒 IPC，直接顶 NFR perf P1（空闲 CPU ≤1%）。gaze.test.ts 的 M5·⑨ 会数这件事。
// 因此每个 tick **只发一次** `cursor_position`；窗口几何（位置 / 尺寸 / 缩放）走**事件驱动**缓存
// （挂载 + move/resize），不逐帧查——多一条逐帧 IPC 就够把上面那条约束掏空。
//
// 失败分支（DESIGN §3.3 的两条错误码）：
// - `cursor_position` 回 `null`（E-IPC-02：鼠标移出所有屏幕 / 显示器拔插）→ 瞳孔回正（角度与幅度都归 0），
//   `cursorScreen` 交 `null` 给下游（穿透开关保持上一次取值是批次 4 的事）。
// - IPC 被 ACL 拒绝或桥不可用（E-IPC-01）→ 落一条能指到根因的 console 错误，跳过这个 tick；不吞错、不重试风暴。
//
// ceiling: 窗口几何是**缓存**的（挂载 + move/resize 事件）——系统拖动窗口的那几帧里，瞳孔用的还是上一次的中心
// upgrade: 4-3 实测"拖动过程中瞳孔明显偏向旧中心" → 在 move 回调里同步换算，或改为拖动结束后立刻重采样
// ceiling: `enabled=false` 只是不起表，**不重置**瞳孔（本项目当前恒传 true，没有"暂停跟随"这个交互）
// upgrade: 真出现"暂停跟随"入口（如 reduce 下的开关）→ 在禁用分支补一次归零，避免瞳孔停在最后一次的角度
import { useEffect, useRef, useState } from "react";
import type { PhysicalPosition } from "@tauri-apps/api/dpi";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { currentMonitor, cursorPosition, getCurrentWindow } from "@tauri-apps/api/window";
import type { Window } from "@tauri-apps/api/window";
import type { Point } from "../character/geometry.ts";
import { SAMPLE_HZ, gazeAngle, gazeTravel } from "./gaze.ts";

/** 一个 tick 的三件事实。前两项是 D-a / D-b 之外的本批加法（`gazeTravel` 见 STATE 未决问题 11）。 */
export type CursorFollow = {
  /** 瞳孔角度（度，−180 ~ 180）：0 = 回正。DESIGN §2 的 D-a */
  gazeDeg: number;
  /** 归一化幅度（0 ~ 1）：0 = 回正、1 = 满偏（SCOPE §7：眼白短半径的 45%） */
  gazeTravel: number;
  /** 光标屏幕坐标（**物理 px**，`null` = 取不到）：批次 4 的 `usePointerPassthrough` 消费它 */
  cursorScreen: Point | null;
};

const NEUTRAL: CursorFollow = { gazeDeg: 0, gazeTravel: 0, cursorScreen: null };

/** 窗口几何缓存：屏幕中心（物理 px）+ 显示器缩放。两者必须同时换，否则 DPI 一变门限就整体偏移。 */
type WindowGeometry = { center: Point; scaleFactor: number };

/** E-IPC-01：这条链路断了。写清"发生了什么 + 为什么 + 怎么办"（docs/UI.md §8 的错误模板）。 */
const reportIpcFailure = (error: unknown): void => {
  console.error(
    `[ipc] E-IPC-01 plugin:window 的读查询被拒绝或桥不可用：${String(error)}。` +
      `瞳孔跟随停在回正 0°，不重试、不假装成功。排查：src-tauri/capabilities/default.json 必须含 core:default` +
      `（其 core:window:default 提供 allow-cursor-position / allow-outer-position / allow-inner-size / allow-current-monitor）。`,
  );
};

/** 不在 Tauri 里（浏览器直开、Node 单测）时 `getCurrentWindow()` 会抛——按"取不到几何"处理，不崩。 */
const currentWindowOrNull = (): Window | null => {
  try {
    return getCurrentWindow();
  } catch (error) {
    reportIpcFailure(error);
    return null;
  }
};

const readGeometry = async (win: Window): Promise<WindowGeometry> => {
  // `currentMonitor()` 是模块级函数（不是 Window 的方法）：返回窗口所在的那块显示器
  const [position, size, monitor] = await Promise.all([
    win.outerPosition(),
    win.innerSize(),
    currentMonitor(),
  ]);
  return {
    center: { x: position.x + size.width / 2, y: position.y + size.height / 2 },
    // U1（多显示器 + 混合 DPI）：除数必须是正的有限值，否则角度会算出 NaN/Infinity
    scaleFactor: monitor && monitor.scaleFactor > 0 ? monitor.scaleFactor : 1,
  };
};

/** 采样一次 → 三件事实。`cursorScreen` 保持物理 px：DESIGN §3.5 的 `screenToViewport` 要吃它。 */
const sample = async (geometry: WindowGeometry | null): Promise<CursorFollow> => {
  const cursor: PhysicalPosition | null = await cursorPosition();
  if (cursor === null) return NEUTRAL; // E-IPC-02：取不到坐标 → 回正（SCOPE U3）
  const cursorScreen = { x: cursor.x, y: cursor.y };
  if (geometry === null) return { ...NEUTRAL, cursorScreen }; // 几何未知：角度无从算，但坐标仍交给下游
  // 角度与幅度按**逻辑 px** 算：方向本身与缩放无关，而 1500px 这个门限不该随 DPI 变形（U1）
  const dx = (cursor.x - geometry.center.x) / geometry.scaleFactor;
  const dy = (cursor.y - geometry.center.y) / geometry.scaleFactor;
  return { gazeDeg: gazeAngle(dx, dy), gazeTravel: gazeTravel(dx, dy), cursorScreen };
};

export function useCursorFollow(enabled: boolean): CursorFollow {
  const [state, setState] = useState<CursorFollow>(NEUTRAL);
  const geometry = useRef<WindowGeometry | null>(null);
  const latest = useRef<CursorFollow>(NEUTRAL);

  // ① 窗口几何：挂载读一次，之后只在系统报 move / resize 时刷新（事件驱动，不逐帧）
  useEffect(() => {
    let alive = true;
    const win = currentWindowOrNull();
    if (win === null) return;
    const refresh = (): void => {
      void readGeometry(win)
        .then((next) => {
          if (alive) geometry.current = next;
        })
        .catch(reportIpcFailure);
    };
    refresh();
    const stops: UnlistenFn[] = [];
    const listen = (pending: Promise<UnlistenFn>): void => {
      void pending
        .then((stop) => {
          // 组件在 await 期间卸载：立刻退订，别把监听器漏在窗口上
          if (alive) stops.push(stop);
          else stop();
        })
        .catch(reportIpcFailure);
    };
    listen(win.onMoved(refresh));
    listen(win.onResized(refresh));
    return () => {
      alive = false;
      stops.forEach((stop) => stop());
    };
  }, []);

  // ② 60Hz 采样：本项目的唯一定时器。值没变就不 setState —— 鼠标不动时 React 一次都不重渲染（NFR P1）
  useEffect(() => {
    if (!enabled) return;
    const tick = (): void => {
      void sample(geometry.current)
        .then((next) => {
          const prev = latest.current;
          const unchanged =
            next.gazeDeg === prev.gazeDeg &&
            next.gazeTravel === prev.gazeTravel &&
            next.cursorScreen?.x === prev.cursorScreen?.x &&
            next.cursorScreen?.y === prev.cursorScreen?.y;
          if (unchanged) return;
          latest.current = next;
          setState(next);
        })
        .catch(reportIpcFailure);
    };
    const timer = setInterval(tick, 1000 / SAMPLE_HZ);
    return () => clearInterval(timer);
  }, [enabled]);

  return state;
}
