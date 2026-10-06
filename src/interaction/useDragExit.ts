// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 4 ｜ M7：左键按住猫身拖窗口 + 右键原生菜单「退出」
//
// 为什么右键用 Tauri 原生菜单而不是 HTML 自绘（SCOPE §7 的两个"被定死的实现选择"之一）：
// 窗口只有 260×300，HTML 菜单**出不了窗口边界**，而且"点窗口外的桌面关掉菜单"这件事
// 那部分桌面根本不归我们的 WebView 管。代价是多一条权限 `core:menu:default`（批次 1 已落）。
//
// 为什么逻辑与真端口分开（D14①：依赖显式传入，禁止函数深处直连全局单例）：
// `createDragExit(ports)` 是纯逻辑（含 U4 的"拖拽在途不重复触发"互斥），`tauriDragExitPorts()`
// 才是真端口。`dragExit.test.ts` 用**真端口**在 Node 里数 IPC 命令与参数——所以"命令名写错"
// "菜单多一项""忘了 preventDefault"都会红，而不是"看起来对"。
import { useState } from "react";
import { Menu } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { reportIpcFailure } from "./useCursorFollow.ts";

/** `React.MouseEvent` 里本模块真正读到的两个成员——结构类型让 Node 用例不必造合成事件（D14⑤）。 */
export type PointerEventLike = { button: number; preventDefault: () => void };

export type DragExitHandlers = {
  onMouseDown: (event: PointerEventLike) => void;
  onContextMenu: (event: PointerEventLike) => void;
};

export type DragExitPorts = {
  startDragging: () => Promise<void>;
  showQuitMenu: () => Promise<void>;
  /** 失败报告端口：共用的 E-IPC-01 落点（DESIGN §3.3 的格式，实现在 useCursorFollow.ts）。 */
  reportFailure: (command: string, error: unknown) => void;
};

const START_DRAGGING = "plugin:window|start_dragging";
const CLOSE_WINDOW = "plugin:window|close";
/** 开菜单是两条命令（先 `new` 再 `popup`），报告时点明这一对，别让人以为是单条命令断了。 */
const MENU_COMMANDS = "plugin:menu|new 或 plugin:menu|popup";
const QUIT_ITEM_ID = "quit";
const QUIT_ITEM_TEXT = "退出";

/**
 * 纯逻辑：把两个 DOM 事件变成两条命令。
 * `dragging` 是本闭包里的状态，不是模块级变量（D14① 禁隐式全局）：`startDragging()` 的 Promise
 * 在**拖拽结束时**才 resolve（阻塞式语义），所以在途期间再按左键必须被挡住——SCOPE U4 原文
 * "不卡死、**不重复触发拖拽**"。
 */
export function createDragExit(ports: DragExitPorts): DragExitHandlers {
  let dragging = false;
  return {
    onMouseDown: (event) => {
      if (event.button !== 0) return; // 只认左键（M7 原文）；右键走 contextmenu，中间键什么都不做
      if (dragging) return;
      dragging = true;
      void ports
        .startDragging()
        .catch((error) => ports.reportFailure(START_DRAGGING, error))
        .finally(() => {
          dragging = false;
        });
    },
    onContextMenu: (event) => {
      // 不 preventDefault 的话 WebView 自带的右键菜单会跟原生菜单一起冒出来（两个菜单叠在一起）
      event.preventDefault();
      void ports.showQuitMenu().catch((error) => ports.reportFailure(MENU_COMMANDS, error));
    },
  };
}

/**
 * 真端口。菜单**只建一次并复用**：每次右键都 `Menu.new` 会在 Rust 侧留一个没人释放的 rid
 * （菜单是 Rust 侧对象，前端只持句柄——`menu.d.ts` 的模块注释原文）。
 *
 * ⚠️ 缓存的是 **Promise** 而不是结果（4-2 的 S-02）：写成 `menu ??= await Menu.new(...)` 时，
 * `??=` 在 `await` **之后**才写回闭包变量——同一次 `Menu.new` 往返内到达的第二次右键会读到
 * `null`，于是各建一个菜单、其中一个句柄永久丢失（M7·② 的"复用"断言只覆盖顺序右键，看不出来）。
 * 失败时把缓存清掉：缓存一个**被拒**的 Promise 等于菜单永久坏掉、后续每次右键都走同一条死路。
 * 关窗即退出进程：`close()` 是 `core:window:allow-close`（批次 1 已落），关掉唯一窗口 = 进程结束。
 */
export function tauriDragExitPorts(): DragExitPorts {
  const quit = (): Promise<void> => getCurrentWindow().close();
  let menuPromise: Promise<Menu> | null = null;
  return {
    startDragging: () => getCurrentWindow().startDragging(),
    showQuitMenu: async () => {
      menuPromise ??= Menu.new({
        items: [
          {
            id: QUIT_ITEM_ID,
            text: QUIT_ITEM_TEXT,
            action: () => {
              void quit().catch((error) => reportIpcFailure(CLOSE_WINDOW, error));
            },
          },
        ],
      }).catch((error: unknown) => {
        menuPromise = null;
        throw error;
      });
      const menu = await menuPromise;
      await menu.popup();
    },
    reportFailure: reportIpcFailure,
  };
}

// ceiling: 拖动过程中"穿透开关"停在按下那一刻的取值（`startDragging` 阻塞期间没有新拍进来）
// upgrade: 4-3 若观察到"拖完停住后点击错位" → 松手时补一次 update，或在 startDragging 的 finally 里重判
// ceiling: 菜单在不接受右键的环境里（A3 未定：透明区可能本来就不穿透）也能从窗口任意处弹出
// upgrade: 批次 0 的 A3 结论落地后，若"透明区本来就不穿透" → 右键弹出的位置口径要重新写进 docs/UI.md §9
export function useDragExit(): DragExitHandlers {
  // 惰性建一次：端口里有菜单缓存，每次渲染重建 = 每次右键都新建一个 Rust 侧菜单
  const [handlers] = useState(() => createDragExit(tauriDragExitPorts()));
  return handlers;
}
