// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 3（批次 4 补 `windowOrigin` / `scaleFactor` / 导出 tick 体）｜ M5
//
// 为什么只有这个文件允许起定时器：ARCHITECTURE §5 第 2 行——「瞳孔跟随**只允许一个定时器**（60Hz）」。
// 批次 4 的 `usePointerPassthrough` 会消费同一个 tick 的 `cursorScreen` + `windowOrigin`，**自己不起表**：
// 两个 60Hz 定时器 = 120 次/秒 IPC，直接顶 NFR perf P1（空闲 CPU ≤1%）。gaze.test.ts 的 M5·⑨ 会数这件事。
// 因此每个 tick **只发一次** `cursor_position`；窗口几何（位置 / 尺寸 / 缩放）走**事件驱动**缓存
// （挂载 + move/resize），不逐帧查——多一条逐帧 IPC 就够把上面那条约束掏空。
//
// 失败分支（DESIGN §3.3 的两条错误码）：
// - `cursor_position` 取不到坐标（E-IPC-02：鼠标移出所有屏幕 / 显示器拔插）→ 瞳孔回正（角度与幅度都归 0），
//   `cursorScreen` 交 `null` 给下游（穿透开关保持上一次取值是批次 4 的事）。**这条分支的现实形态是
//   `TypeError` 而不是 `null`**，见 `readCursorScreen` 的注释（批次 4 实测的上游行为）。
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

/**
 * 一个 tick 的四件事实。`gazeTravel` 是批次 3 的加法（见 STATE 未决问题 11），
 * `windowOrigin` 与 `scaleFactor` 是批次 4 的加法（见未决问题 12）：穿透层要拿它们把**同一个拍**的
 * `cursorScreen` 换算成视口坐标——补这两个字段是为了让窗口几何仍然只有这一个读取者（`readGeometry`），
 * 而不是让 `usePointerPassthrough` 自己再监听一次 move/resize 去读第二份。
 */
export type CursorFollow = {
  /** 瞳孔角度（度，−180 ~ 180）：0 = 回正。DESIGN §2 的 D-a */
  gazeDeg: number;
  /** 归一化幅度（0 ~ 1）：0 = 回正、1 = 满偏（SCOPE §7：眼白短半径的 45%） */
  gazeTravel: number;
  /** 光标屏幕坐标（**物理 px**，`null` = 取不到）：批次 4 的 `usePointerPassthrough` 消费它 */
  cursorScreen: Point | null;
  /** 窗口左上角（**物理 px**，`null` = 几何读不到）：`screenToViewport` 的原点 */
  windowOrigin: Point | null;
  /** 窗口所在显示器的缩放（读不到时 1）：`screenToViewport` 的除数 */
  scaleFactor: number;
};

const NEUTRAL: CursorFollow = {
  gazeDeg: 0,
  gazeTravel: 0,
  cursorScreen: null,
  windowOrigin: null,
  scaleFactor: 1,
};

/**
 * 窗口几何缓存：左上角 + 屏幕中心（都是物理 px）+ 显示器缩放。
 * 三者必须同时换，否则 DPI 一变门限就整体偏移（U1）；`center` 由 `origin` 推出，不许各算一份。
 */
export type WindowGeometry = { origin: Point; center: Point; scaleFactor: number };

/** `cursor_position` 的命令名：失败报告与恢复报告必须用**同一个键**，否则去重表会分裂成两条。 */
const CURSOR_POSITION = "plugin:window|cursor_position";

/**
 * E-IPC-01 的报告人。写清"发生了什么 + 那条命令 + 怎么办"（docs/UI.md §8 的错误模板）。
 * 三个 interaction 模块共用这一处落点（D12 信息阶梯：错误码的格式只写一遍），`command` 由调用方
 * 点名——`plugin:window|cursor_position` / `plugin:window|set_ignore_cursor_events` /
 * `plugin:window|close` 断掉的样子完全不同，痕迹里没有命令名就没人知道该查哪条链。
 *
 * **去重口径** = `docs/UI.md` §2 的 S3 行：「同一处连续失败只打第一次（防 60 次/秒刷屏）、
 * 恢复后再失败才再打」。60Hz tick 逐拍调它，不去重就是每秒 60 行同一条，真实后续报错被冲掉
 * （4-2 的 S-06）。去重必须**成对**：只压不解除 = 一次抖动之后这条链路永久静音。
 * 状态住在工厂闭包而不是模块级变量（D14① 禁隐式全局），`write` 显式传入 → Node 用例能把条数数出来。
 */
export type IpcFailureReporter = {
  reportFailure: (command: string, error: unknown) => void;
  /** 成功一拍：解除该命令的静音（下一次再失败会重新打印）。 */
  noteSuccess: (command: string) => void;
};

export const createIpcFailureReporter = (
  // ⚠️ 默认值必须是**箭头函数**而不是 `console.error` 本身：捕获函数引用会让 `t.mock.method(console, …)`
  // 这类替身失效（KP-14 就是这么数痕迹条数的）——每次调用都要现取 `console.error`。
  write: (line: string) => void = (line) => console.error(line),
): IpcFailureReporter => {
  const muted = new Set<string>();
  return {
    reportFailure: (command, error) => {
      if (muted.has(command)) return;
      muted.add(command);
      write(
        `[ipc] E-IPC-01 ${command} 被拒绝或桥不可用：${String(error)}。` +
          `功能停在当前取值上，不重试、不假装成功。排查：src-tauri/capabilities/default.json 必须含 core:default` +
          `（其 core:window:default 提供 allow-cursor-position / allow-outer-position / allow-inner-size / allow-current-monitor），` +
          `写命令另需三条具名授权：allow-close / allow-start-dragging / allow-set-ignore-cursor-events，菜单需 core:menu:default。`,
      );
    },
    noteSuccess: (command) => {
      muted.delete(command);
    },
  };
};

const defaultReporter = createIpcFailureReporter();

/** 三个 interaction 模块共用的失败落点（`useDragExit` / `usePointerPassthrough` 也 import 它）。 */
export const reportIpcFailure = defaultReporter.reportFailure;

/** 恢复落点：成功的那一拍解除静音，本身不打印。 */
export const noteIpcSuccess = defaultReporter.noteSuccess;

/** 不在 Tauri 里（浏览器直开、Node 单测）时 `getCurrentWindow()` 会抛——按"取不到几何"处理，不崩。 */
const currentWindowOrNull = (): Window | null => {
  try {
    return getCurrentWindow();
  } catch (error) {
    reportIpcFailure("plugin:window|getCurrentWindow", error);
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
  const origin = { x: position.x, y: position.y };
  return {
    origin,
    center: { x: origin.x + size.width / 2, y: origin.y + size.height / 2 },
    // U1（多显示器 + 混合 DPI）：除数必须是正的有限值，否则角度会算出 NaN/Infinity
    scaleFactor: monitor && monitor.scaleFactor > 0 ? monitor.scaleFactor : 1,
  };
};

const GEOMETRY_COMMANDS = "plugin:window|outer_position/inner_size/current_monitor";

/**
 * 取一次光标坐标（物理 px）；`null` = 取不到（E-IPC-02）。
 *
 * ⚠️ 本机实测（4-1 批次 4，`@tauri-apps/api` v2.12.1）：DESIGN §3.3 写的"E-IPC-02 = Promise **resolved 为**
 * null、不抛错"对**封装函数**不成立——`cursorPosition()` 的实现是
 * `invoke('plugin:window|cursor_position').then(v => new PhysicalPosition(v))`，
 * Rust 侧回 `null` 时它在 `dpi.js` 里抛
 * `TypeError: Cannot use 'in' operator to search for 'Physical' in null`。
 * 所以"取不到坐标"这条分支有**两种形态**，两种都归 E-IPC-02：
 *   ① resolve 出 `null`（契约原文的形态；上游哪天修好了仍走这条）
 *   ② 上面那个 `TypeError`（当前版本的现实）
 * 判据用 `instanceof TypeError` 而不是比字符串：ACL 拒绝抛的是 Rust 给的**字符串**
 * （E-IPC-01），两者必须分得开——把"权限被拒"当成"鼠标移出屏幕"会让 KP-14 空转。
 */
const readCursorScreen = async (): Promise<Point | null> => {
  try {
    const cursor: PhysicalPosition | null = await cursorPosition();
    return cursor === null ? null : { x: cursor.x, y: cursor.y };
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
};

/**
 * 采样一次 → 四件事实。**一拍只读一次坐标**（KP-12 的判据本体：这里多写一次 `cursorPosition()`
 * 就是 120 次/秒 IPC）。`cursorScreen` 保持物理 px：DESIGN §3.5 的 `screenToViewport` 要吃它。
 * 导出是为了让 KP-12·① 能"跑一拍、数一次"——不需要渲染 React 就能验这条约束。
 */
export const sampleCursor = async (geometry: WindowGeometry | null): Promise<CursorFollow> => {
  const carried = { windowOrigin: geometry?.origin ?? null, scaleFactor: geometry?.scaleFactor ?? 1 };
  const cursorScreen = await readCursorScreen();
  if (cursorScreen === null) return { ...NEUTRAL, ...carried }; // E-IPC-02：取不到坐标 → 回正（SCOPE U3）
  if (geometry === null) return { ...NEUTRAL, ...carried, cursorScreen }; // 几何未知：角度无从算，坐标仍交给下游
  // 角度与幅度按**逻辑 px** 算：方向本身与缩放无关，而 400/1500 这两个门限不该随 DPI 变形（U1）
  const dx = (cursorScreen.x - geometry.center.x) / geometry.scaleFactor;
  const dy = (cursorScreen.y - geometry.center.y) / geometry.scaleFactor;
  return { ...carried, gazeDeg: gazeAngle(dx, dy), gazeTravel: gazeTravel(dx, dy), cursorScreen };
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
          // 成功就解除静音：读几何失败过一次之后，恢复的那一拍必须让下一次失败重新可见（UI.md S3）
          noteIpcSuccess(GEOMETRY_COMMANDS);
        })
        .catch((error) => reportIpcFailure(GEOMETRY_COMMANDS, error));
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
        // 事件订阅走 core:event:default 的 allow-listen/allow-unlisten（core:default 已含）
        .catch((error) => reportIpcFailure("plugin:event|listen（onMoved/onResized）", error));
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
      void sampleCursor(geometry.current)
        .then((next) => {
          noteIpcSuccess(CURSOR_POSITION); // 恢复一拍就解除静音（只压不解除 = 一次抖动之后永久静音）
          const prev = latest.current;
          // 窗口原点与缩放也算"值"：窗口被拖动时同一屏幕坐标会落到不同的视口点，
          // 漏掉这两项 = 穿透判定拿旧原点算（拖动那几帧点错地方）
          const unchanged =
            next.gazeDeg === prev.gazeDeg &&
            next.gazeTravel === prev.gazeTravel &&
            next.cursorScreen?.x === prev.cursorScreen?.x &&
            next.cursorScreen?.y === prev.cursorScreen?.y &&
            next.windowOrigin?.x === prev.windowOrigin?.x &&
            next.windowOrigin?.y === prev.windowOrigin?.y &&
            next.scaleFactor === prev.scaleFactor;
          if (unchanged) return;
          latest.current = next;
          setState(next);
        })
        .catch((error) => reportIpcFailure(CURSOR_POSITION, error));
    };
    const timer = setInterval(tick, 1000 / SAMPLE_HZ);
    return () => clearInterval(timer);
  }, [enabled]);

  return state;
}
