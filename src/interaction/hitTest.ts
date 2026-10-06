// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 4 ｜ M6 的纯函数侧：屏幕坐标 → 视口坐标 → 是否落在猫身上
//
// 为什么这两个函数必须是纯的、输入全部显式传入（D14①）：SCOPE §5 M6 的验收命令就是
// `node --test src/interaction/hitTest.test.ts`——Node 里没有窗口、没有 DPI、没有鼠标，
// 能测的只有"给定原点与缩放，坐标怎么换算"。把 `getCurrentWindow()` 之类的调用塞进来，
// 这个文件就不可测了（这正是 DESIGN §9 拒绝 `document.elementFromPoint` 的理由）。
//
// 坐标系一句话（三个数各自的出处都写死，免得 4-2 问"这个 px 是哪种 px"）：
//   `screen`       = 物理 px，`cursorPosition()` / `outerPosition()` 的原样输出
//   `windowOrigin` = 窗口左上角，物理 px（无边框窗口上 outer == 客户区左上角，见 lib.rs 的 `decorations:false`）
//   `scaleFactor`  = 窗口所在显示器的缩放（1.0 / 1.25 / 1.5 / 2.0，`currentMonitor().scaleFactor`）
// 三者除出来 = 视口坐标（CSS px，窗口左上角为原点），与 `characterBounds()` 同一坐标系（DESIGN §3.5）。
import type { Bounds, Point } from "../character/geometry.ts";

/**
 * 屏幕坐标 → 视口坐标（CSS px）。
 * `scaleFactor` 非法（0 / 负数 / NaN / Infinity）时按 1 算：U1 要求"DPI 读不到"不许把坐标乘成 0 或 NaN——
 * 按 1 算的后果只是判定偏一点，按 0 算的后果是**所有坐标都塌成窗口原点**（整窗判成"在猫身上"，永不穿透）。
 */
export function screenToViewport(screen: Point, windowOrigin: Point, scaleFactor: number): Point {
  const scale = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
  return { x: (screen.x - windowOrigin.x) / scale, y: (screen.y - windowOrigin.y) / scale };
}

/**
 * 视口点是否落在猫身上（`characterBounds()` 的输出）。
 * 三条口径写死：
 * - **非有限坐标一律 false**：坐标坏掉时宁可让点击穿到桌面，也不要把整窗吃住——后者会让用户既点不到
 *   桌面、又拖不动猫（两个功能一起坏）。上游还有 `screenToViewport` 的缩放守卫兜一层。
 * - **边界算命中**（闭区间 / 椭圆取 ≤1 / 三角形取同号含 0）：形状本身已按描边外扩过（`geometry.ts`
 *   的 `RIM_HALF`），再在边界上抠 1px 没有意义，反而会让猫身与透明区的交界处随亚像素抖动。
 * - **按形状判，不按外接矩形判**：头是椭圆、耳是三角形、躯干与尾段是矩形（4-2 的 R-01——
 *   把椭圆和三角形退化成矩形会让 9.9% 的窗口面积变成"既点不到桌面也拖不动"的死区）。
 */
export function isOverCharacter(viewport: Point, bounds: Bounds[]): boolean {
  if (!Number.isFinite(viewport.x) || !Number.isFinite(viewport.y)) return false;
  return bounds.some((b) => {
    if (b.shape === "rect") {
      return (
        viewport.x >= b.x &&
        viewport.x <= b.x + b.width &&
        viewport.y >= b.y &&
        viewport.y <= b.y + b.height
      );
    }
    if (b.shape === "ellipse") {
      const nx = (viewport.x - b.cx) / b.rx;
      const ny = (viewport.y - b.cy) / b.ry;
      return nx * nx + ny * ny <= 1;
    }
    // 三角形：对三条边各取一次叉积，三个叉积同号（含 0）= 在内部或边上
    const side = (p: Point, q: Point): number =>
      (viewport.x - q.x) * (p.y - q.y) - (p.x - q.x) * (viewport.y - q.y);
    const cross = [side(b.a, b.b), side(b.b, b.c), side(b.c, b.a)];
    return !(cross.some((c) => c < 0) && cross.some((c) => c > 0));
  });
}
