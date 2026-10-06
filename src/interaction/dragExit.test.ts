/// <reference types="node" />
// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 4 ｜ 载体：SCOPE §5 M7 的验收命令 + TESTPLAN KP-12 / KP-13 / KP-14
//
// 三条写法是 TESTPLAN §7「接缝约定」的一部分，不许各写各的：
// 1. `window` 垫片必须在**最前面**，且 Tauri 模块只能**动态 import**——ESM 的静态 import 先于本文件
//    任何语句求值，写成静态 import 时 `@tauri-apps/api/mocks` 会在垫片之前跑，实测
//    `ReferenceError: window is not defined`（TESTPLAN §7 实测表第 1 行）。垫片是 `window = globalThis`。
// 2. 不 mock 时钟；等待一律"轮询条件 + 明确超时"，不写固定 sleep（TESTPLAN §7 第 4 行）。
// 3. 断言的是**发出去的 IPC 命令与次数**（SCOPE §5 M7 的原文），不是"某个函数被调过"——
//    `reply` 里记的是真实 `invoke` 的 payload，所以改坏生产代码里的命令名或参数会立刻变红。
//
// 为什么拖拽/菜单能在 Node 里测：两个 hook 的副作用都走**显式传入的端口**（D14①：依赖显式传入，
// 禁止函数深处直连全局单例）——`createDragExit(ports)` / `createPassthrough(ports)` 是纯逻辑，
// `tauriDragExitPorts()` / `tauriPassthroughPorts()` 才是真端口。用例测的是**真端口**（不是自己
// 造一份假端口），所以"命令名写错""菜单多一项""忘了 preventDefault"都会红。
(globalThis as unknown as { window: unknown }).window = globalThis;

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gazeAngle, gazeTravel } from "./gaze.ts";
import type { Point } from "../character/geometry.ts";
import type { CursorFollow, WindowGeometry } from "./useCursorFollow.ts";

type Call = { cmd: string; args: Record<string, unknown> };
const calls: Call[] = [];
type Reply = (cmd: string, args: Record<string, unknown>) => unknown;
let reply: Reply = () => undefined;

const countOf = (cmd: string): number => calls.filter((c) => c.cmd === cmd).length;
const argsOf = (cmd: string): Array<Record<string, unknown>> =>
  calls.filter((c) => c.cmd === cmd).map((c) => c.args);
const lastValue = (cmd: string): unknown => {
  const all = argsOf(cmd);
  return all.length === 0 ? undefined : all[all.length - 1].value;
};

/** 装 mock：`mockWindows('main')` 是 `getCurrentWindow()` 读得到 label 的前提（否则命令参数里没有 label）。 */
const installIpc = async (): Promise<void> => {
  calls.length = 0;
  reply = () => undefined;
  const mocks = await import("@tauri-apps/api/mocks");
  mocks.clearMocks();
  mocks.mockWindows("main");
  mocks.mockIPC((cmd, args) => {
    const payload = (args ?? {}) as Record<string, unknown>;
    calls.push({ cmd, args: payload });
    return reply(cmd, payload);
  });
};

const waitFor = async (done: () => boolean, what: string, timeoutMs = 1000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (!done()) {
    if (Date.now() > deadline) throw new Error(`等待超时（${timeoutMs}ms）：${what}`);
    await new Promise((resolve) => setTimeout(resolve, 1)); // 轮询，不是固定 sleep
  }
};

/** 冲一次宏任务队列：让 `.finally()` / `.catch()` 这些微任务链跑完（不是 sleep，不是等时间）。 */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const loadCursorFollow = () => import("./useCursorFollow.ts");
const loadPassthrough = () => import("./usePointerPassthrough.ts");
const loadDragExit = () => import("./useDragExit.ts");

const noop = (): void => {};

test("M7·① 左键按在猫身上 → plugin:window|start_dragging（一次按下一条；在途不重复触发）", async () => {
  await installIpc();
  const START = "plugin:window|start_dragging";
  const { createDragExit, tauriDragExitPorts } = await loadDragExit();
  let release: () => void = noop;
  reply = (cmd) => (cmd === START ? new Promise<void>((resolve) => (release = resolve)) : undefined);
  const exit = createDragExit(tauriDragExitPorts());

  exit.onMouseDown({ button: 2, preventDefault: noop });
  assert.equal(countOf(START), 0, "右键不该发出拖拽命令（M7 原文只写左键）");

  exit.onMouseDown({ button: 0, preventDefault: noop });
  assert.equal(countOf(START), 1, "左键按下必须发一条 start_dragging");
  assert.deepEqual(argsOf(START)[0], { label: "main" });

  // `startDragging()` 的 Promise 在**拖拽结束时**才 resolve → 在途时再按左键不许重复触发（SCOPE U4）
  exit.onMouseDown({ button: 0, preventDefault: noop });
  assert.equal(countOf(START), 1, "拖拽在途时又发一条 = U4 的『重复触发拖拽』");

  release();
  await settle();
  exit.onMouseDown({ button: 0, preventDefault: noop });
  assert.equal(countOf(START), 2, "松手之后必须解锁：否则第二次拖拽永远起不来");
  console.log(`M7·① ${START} 共 ${countOf(START)} 次（右键 0 次、在途那一次被互斥挡住）`);
});

test("M7·② 右键 → 原生菜单只有一项「退出」；点它 → plugin:window|close（菜单复用不重建）", async () => {
  await installIpc();
  const NEW = "plugin:menu|new";
  const POPUP = "plugin:menu|popup";
  const CLOSE = "plugin:window|close";
  const { createDragExit, tauriDragExitPorts } = await loadDragExit();
  reply = (cmd) => (cmd === NEW ? [11, "quit-menu"] : undefined);
  const exit = createDragExit(tauriDragExitPorts());

  let prevented = 0;
  exit.onContextMenu({ button: 2, preventDefault: () => (prevented += 1) });
  await waitFor(() => countOf(POPUP) === 1, "第一次菜单弹出");
  assert.equal(prevented, 1, "必须 preventDefault，否则 WebView 自带的右键菜单会一起冒出来");

  const created = argsOf(NEW);
  assert.equal(created.length, 1, "第一次右键建一个原生菜单");
  type Item = { id: string; text: string; handler: { id: number } };
  const options = created[0].options as { items: Item[] };
  assert.equal(options.items.length, 1, "菜单**只能有一项**（SCOPE §5 M7 原文）");
  assert.equal(options.items[0].text, "退出");

  // 点菜单项的真实链路 = Rust → Channel → 前端；mock 里等价的动作就是 `runCallback`（垫片提供的正是它）
  const internals = (
    globalThis as unknown as { __TAURI_INTERNALS__: { runCallback: (id: number, data: unknown) => void } }
  ).__TAURI_INTERNALS__;
  internals.runCallback(options.items[0].handler.id, { index: 0, message: options.items[0].id });
  await waitFor(() => countOf(CLOSE) === 1, "「退出」发出 close");
  assert.deepEqual(argsOf(CLOSE)[0], { label: "main" }, "关的必须是 main 窗口（关掉它 = 进程退出）");

  exit.onContextMenu({ button: 2, preventDefault: noop });
  await waitFor(() => countOf(POPUP) === 2, "第二次菜单弹出");
  assert.equal(countOf(NEW), 1, "菜单必须复用：每次右键都新建 = 每右键一次在 Rust 侧留一个没人释放的 rid");
  console.log(
    `M7·② ${NEW} ${countOf(NEW)} 次 / ${POPUP} ${countOf(POPUP)} 次 / ${CLOSE} ${countOf(CLOSE)} 次；` +
      `条目 ${JSON.stringify(options.items.map((i) => i.text))}`,
  );
});

test("KP-12·① 一个 tick 只读一次坐标；穿透层零采样（NFR perf P3 / ARCHITECTURE §5）", async () => {
  await installIpc();
  const CURSOR = "plugin:window|cursor_position";
  reply = (cmd) => (cmd === CURSOR ? { x: 900, y: 400 } : undefined);
  const { sampleCursor } = await loadCursorFollow();
  const geometry: WindowGeometry = { origin: { x: 700, y: 300 }, center: { x: 830, y: 450 }, scaleFactor: 1 };

  const first: CursorFollow = await sampleCursor(geometry);
  assert.equal(countOf(CURSOR), 1, "一拍只许采样一次");
  await sampleCursor(geometry);
  assert.equal(countOf(CURSOR), 2, "两拍就是两次采样（不许把上一拍的值当缓存复用，瞳孔会停在原地）");

  assert.deepEqual(first.cursorScreen, { x: 900, y: 400 }, "cursorScreen 原样保留物理 px（screenToViewport 要吃它）");
  assert.deepEqual(first.windowOrigin, { x: 700, y: 300 }, "窗口原点必须随同一拍交出去（穿透层拿它换算视口坐标）");
  // 角度/幅度按**逻辑 px** 算（U1）：门限不该随 DPI 变形 —— 除数是 scaleFactor，不是别的
  assert.equal(first.gazeDeg, gazeAngle(900 - 830, 400 - 450));
  assert.equal(first.gazeTravel, gazeTravel(70, -50));
  const hdpi: WindowGeometry = { ...geometry, scaleFactor: 2 };
  const scaled = await sampleCursor(hdpi);
  assert.equal(scaled.gazeTravel, gazeTravel(70 / 2, -50 / 2), "150%/200% 缩放下 400px 的满偏半径不许变形（U1）");

  // 穿透层零采样：只消费同一拍的结果，自己不起表也不读坐标（两个 60Hz 定时器 = 120 次/秒 IPC）
  const src = readFileSync(new URL("./usePointerPassthrough.ts", import.meta.url), "utf8");
  const offenders = ["cursorPosition", "setInterval(", "requestAnimationFrame("].filter((k) => src.includes(k));
  console.log(
    `KP-12·① ${CURSOR} 第 1 拍 1 次 → 两拍累计 ${countOf(CURSOR)} 次；穿透层自采样关键词命中 ${offenders.length} 个`,
  );
  assert.deepEqual(offenders, [], "穿透层不许自己采样或起表（ARCHITECTURE §5 第 2 行：只允许一个定时器）");
});

test("KP-12·② 未翻转时一次 set_ignore_cursor_events 都不发；翻转才各发一次（MUT-8 的靶子）", async () => {
  await installIpc();
  const IGNORE = "plugin:window|set_ignore_cursor_events";
  const { createPassthrough, tauriPassthroughPorts } = await loadPassthrough();
  const passthrough = createPassthrough(tauriPassthroughPorts());
  const origin: Point = { x: 0, y: 0 };
  const blank: Point = { x: 5, y: 5 }; // 视口 (5,5)：窗口里、猫身之外
  const onCat: Point = { x: 130, y: 113.75 }; // 视口：头部中心（设计坐标 (160,140) × 0.8125）

  for (let i = 0; i < 60; i++) passthrough.update(blank, origin, 1);
  assert.equal(countOf(IGNORE), 1, "首次判定发一条");
  assert.equal(lastValue(IGNORE), true, "光标在透明区 → 忽略光标事件，点击落到桌面（M6 的判据）");

  for (let i = 0; i < 60; i++) passthrough.update(blank, origin, 1);
  assert.equal(countOf(IGNORE), 1, "60 拍没翻转：一次都不许发（MUT-8 把它改成每拍都 invoke，这里立刻红）");

  passthrough.update(onCat, origin, 1);
  assert.equal(countOf(IGNORE), 2, "走进猫身 → 翻转一次");
  assert.equal(lastValue(IGNORE), false, "在猫身上 → 必须收回穿透，否则拖不动它");

  for (let i = 0; i < 60; i++) passthrough.update(onCat, origin, 1);
  assert.equal(countOf(IGNORE), 2);
  passthrough.update(null, origin, 1);
  assert.equal(countOf(IGNORE), 2, "E-IPC-02（坐标取不到）必须保持上一次取值，不许翻成整窗穿透（DESIGN §3.3）");
  passthrough.update(onCat, { x: 0, y: 0 }, 0);
  assert.equal(countOf(IGNORE), 2, "缩放读不到（U1）时不猜：保持上一次取值");

  console.log(`KP-12·② ${IGNORE} 共 ${countOf(IGNORE)} 次（首次 1 + 翻转 1；未翻转的 120 拍与两条失败分支各 0 次）`);
});

test("KP-13 cursor_position 返回 null → 回正 0°、不抛（E-IPC-02 / SCOPE U3）", async () => {
  await installIpc();
  const CURSOR = "plugin:window|cursor_position";
  const { sampleCursor } = await loadCursorFollow();
  const geometry: WindowGeometry = { origin: { x: 0, y: 0 }, center: { x: 100, y: 100 }, scaleFactor: 1.5 };

  // 这条用例跑的是**真封装**：mock 让 Rust 侧回 `null`，`cursorPosition()` 内部
  // `new PhysicalPosition(null)` 会抛 TypeError（v2.12.1 实测）——E-IPC-02 的现实形态就是这个。
  // 第一版实现只挡了 `cursor === null`，本用例当场红（详见 STATE 风险摘要）。
  reply = (cmd) => (cmd === CURSOR ? null : undefined);
  const neutral: CursorFollow = await sampleCursor(geometry);
  assert.equal(neutral.gazeDeg, 0, "取不到坐标 → 角度回 0，不是 NaN（U3 禁 rotate(NaN)）");
  assert.equal(neutral.gazeTravel, 0, "幅度也要回 0，否则瞳孔停在边缘看着像瞪着远处");
  assert.equal(neutral.cursorScreen, null, "交给下游的是 null，不是 {x:0,y:0} 这个假坐标");

  reply = (cmd) => (cmd === CURSOR ? { x: 5, y: 6 } : undefined);
  const noGeometry: CursorFollow = await sampleCursor(null);
  assert.equal(noGeometry.gazeDeg, 0, "几何没读到（浏览器直开/Node）也不抛：角度 0");
  assert.deepEqual(noGeometry.cursorScreen, { x: 5, y: 6 }, "但坐标照样交给下游（穿透层自己判断要不要用）");
  console.log(
    `KP-13 null → gazeDeg ${neutral.gazeDeg}° / travel ${neutral.gazeTravel} / cursorScreen ${neutral.cursorScreen}；` +
      `几何缺失 → gazeDeg ${noGeometry.gazeDeg}° 且坐标不丢`,
  );
});

test("KP-14 调用被拒（ACL）→ 不吞错：留下 E-IPC-01 痕迹，进程不崩", async (t) => {
  await installIpc();
  const CURSOR = "plugin:window|cursor_position";
  const IGNORE = "plugin:window|set_ignore_cursor_events";
  const logged = t.mock.method(console, "error", noop);
  const text = (): string => logged.mock.calls.map((c) => c.arguments.join(" ")).join("\n");

  // ① 读坐标被拒：必须**拒绝**（不给个 0° 假装成功），由调用方的 catch 落到 E-IPC-01
  reply = (cmd) => {
    if (cmd === CURSOR) throw new Error("window.cursor_position not allowed. Permissions associated with this command");
    return undefined;
  };
  const { sampleCursor, reportIpcFailure } = await loadCursorFollow();
  await assert.rejects(sampleCursor(null), /not allowed/, "被 ACL 拒绝时必须拒绝：吞成 0° 就等于把故障藏起来");
  reportIpcFailure(CURSOR, new Error("not allowed"));
  assert.match(text(), /E-IPC-01/, "失败分支必须留下可观测痕迹");
  assert.match(text(), new RegExp(CURSOR.replace("|", "\\|")), "痕迹里要有**命令名**，否则没人知道断在哪条链上");

  // ② 穿透开关被拒：真端口 + 真报告器（不是注入的假端口）——覆盖率最高的那条失败路径
  reply = (cmd) => {
    if (cmd === IGNORE) throw new Error("window.set_ignore_cursor_events not allowed");
    return undefined;
  };
  const { createPassthrough, tauriPassthroughPorts } = await loadPassthrough();
  const passthrough = createPassthrough(tauriPassthroughPorts());
  passthrough.update({ x: 5, y: 5 }, { x: 0, y: 0 }, 1);
  await settle();
  assert.match(text(), new RegExp(IGNORE.replace("|", "\\|")), "穿透开关失败也要落到 E-IPC-01");
  passthrough.update({ x: 5, y: 5 }, { x: 0, y: 0 }, 1);
  assert.equal(countOf(IGNORE), 1, "失败之后不许每拍重试（60 次/秒的失败风暴比失败本身更糟）");

  console.log(`KP-14 console.error 命中 ${logged.mock.calls.length} 条；${IGNORE} 失败后未重试（累计 ${countOf(IGNORE)} 次）`);
});

test("M7·③ 同一次 menu|new 往返内的两次右键 → 只建 1 个菜单，两次都弹（S-02 的靶子）", async () => {
  await installIpc();
  const NEW = "plugin:menu|new";
  const POPUP = "plugin:menu|popup";
  const { createDragExit, tauriDragExitPorts } = await loadDragExit();
  let release: () => void = noop;
  reply = (cmd) =>
    cmd === NEW ? new Promise((resolve) => (release = () => resolve([11, "quit-menu"]))) : undefined;
  const exit = createDragExit(tauriDragExitPorts());

  // 两次右键落在**同一次** Menu.new 往返内：第一版实现把 `menu ??= await Menu.new(...)` 写在 await 之后，
  // 于是两次都读到 null、各建一个 Rust 侧菜单，其中一个句柄永久丢失（4-2 的 S-02）。
  // 修法 = 缓存 **Promise** 而不是结果——第二次右键读到的是同一个在途 Promise。
  exit.onContextMenu({ button: 2, preventDefault: noop });
  exit.onContextMenu({ button: 2, preventDefault: noop });
  assert.equal(countOf(NEW), 1, "同一次往返内的第二次右键必须复用那个在途的 Menu.new（不许各建一个）");
  assert.equal(countOf(POPUP), 0, "菜单还没建好就 popup = 弹一个不存在的菜单");

  release();
  await waitFor(() => countOf(POPUP) === 2, "两次右键各弹一次（复用的只是建菜单那一步，弹出不能省）");
  assert.equal(countOf(NEW), 1, "全程只建一个菜单");
  exit.onContextMenu({ button: 2, preventDefault: noop });
  await waitFor(() => countOf(POPUP) === 3, "第三次右键（缓存已就绪）照常弹出");
  assert.equal(countOf(NEW), 1, "复用缓存：第三次也不许再建");
  console.log(`M7·③ 连发两次右键 → ${NEW} ${countOf(NEW)} 次 / ${POPUP} ${countOf(POPUP)} 次（三次右键）`);
});

test("KP-15 E-IPC-01 去重：同一处连续失败只留一条痕迹，恢复后再失败才再打（docs/UI.md §2 S3）", async () => {
  await installIpc();
  const CURSOR = "plugin:window|cursor_position";
  const IGNORE = "plugin:window|set_ignore_cursor_events";
  const { createIpcFailureReporter } = await loadCursorFollow();
  const lines: string[] = [];
  const reporter = createIpcFailureReporter((line) => lines.push(line));

  // UI.md §2 的 S3 行写死：同一处连续失败只打第一次（防 60 次/秒刷屏）、恢复后再失败才再打。
  // 60Hz tick 逐拍调它 ⇒ 不去重就是每秒 60 行同一条，真实后续报错被冲掉（4-2 的 S-06）。
  for (let i = 0; i < 60; i++) reporter.reportFailure(CURSOR, new Error("window.cursor_position not allowed"));
  assert.equal(lines.length, 1, `60 拍同因失败留下 ${lines.length} 条：只许 1 条`);
  assert.match(lines[0], /E-IPC-01/, "痕迹必须带错误码");
  assert.ok(lines[0].includes(CURSOR), "痕迹必须带命令名，否则没人知道断在哪条链上");

  reporter.noteSuccess(CURSOR); // 恢复一拍
  reporter.reportFailure(CURSOR, new Error("window.cursor_position not allowed"));
  assert.equal(lines.length, 2, "恢复之后再失败必须再打一次：否则第二段故障被第一段的静音永久盖住");

  reporter.reportFailure(IGNORE, new Error("window.set_ignore_cursor_events not allowed"));
  assert.equal(lines.length, 3, "去重按**命令**分：另一条链断掉不许被上一条的静音吃掉");

  // 生产侧接线（Node 里渲染不了 React，只能核结构）：成功的那个 tick 必须报告恢复，
  // 否则一次失败之后这条链路永久静音——去重的一半是"记得解除"。
  // ⚠️ 断言的是**调用点**而不是标识符：只查 `noteIpcSuccess(` 会被它自己的那行导出
  // （`export const noteIpcSuccess = defaultReporter.noteSuccess;`）满足——实测 MUT-18
  // （把 tick 里的调用删掉）照样全绿。带上参数才是那个调用点。
  const src = readFileSync(new URL("./useCursorFollow.ts", import.meta.url), "utf8");
  assert.ok(
    src.includes("noteIpcSuccess(CURSOR_POSITION)"),
    "每一拍成功时必须调 noteIpcSuccess(CURSOR_POSITION)：只加去重不加解除 = 一次抖动之后再也不报",
  );
  assert.ok(
    src.includes("noteIpcSuccess(GEOMETRY_COMMANDS)"),
    "窗口几何读成功时也要解除静音（它和坐标是两条独立的链）",
  );
  console.log(`KP-15 60 拍同因失败 → ${1} 条；恢复后再失败 → ${2} 条；另一条链 → ${3} 条（共 ${lines.length} 条）`);
});
