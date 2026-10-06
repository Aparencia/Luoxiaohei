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

/** 椭圆：`rx/ry` 已含描边半宽（`geometry.ts` 的 `RIM_HALF`），归一化后 ≤1 = 内部或边界。 */
const inEllipse = (p: Point, e: Extract<Bounds, { shape: "ellipse" }>): boolean => {
  const nx = (p.x - e.cx) / e.rx;
  const ny = (p.y - e.cy) / e.ry;
  return nx * nx + ny * ny <= 1;
};

/**
 * 射线法（even-odd）：落在轮廓**内部**即命中。
 * 退化输入不会把整窗吃住：点数 < 3、或三点共线（叉积全 0）时一个交点都数不出来 → 恒 false。
 * 这一条取代了旧三角判定的"三个叉积同号含 0"——那个写法在三点共线时对**任意**点返回 true
 * （4-2 第 2 轮的 B5-08：今天不可达，但改耳顶点的人会让穿透永久失效，且没有断言会红）。
 */
const inPolygon = (points: Point[], p: Point): boolean => {
  if (points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    // 只处理"跨过这条水平线"的边；该条件本身排除了 b.y === a.y 的除零
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
};

/**
 * 到轮廓边界的距离 ≤ `rim` —— 即**描边带**。
 * 为什么这就是画出来的那一圈：`heicat.css` 给这四个形状统一 `stroke-width: 4` +
 * `stroke-linejoin: round`（圆角连接），于是描边区域 = 边界上每一点的法向 ±2 设计 px 的并集
 * = "到边界的欧氏距离 ≤ 半宽"。圆弧连接不产生斜接尖刺，所以这个式子对尖角同样成立
 * （旧版沿"顶点→重心"外扩，耳缘实测只外移 0.761~1.329 设计 px，漏了约 1 CSS px 宽的一圈）。
 */
const nearRing = (points: Point[], p: Point, rim: number): boolean => {
  const limit = rim * rim;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const ex = p.x - (a.x + t * dx);
    const ey = p.y - (a.y + t * dy);
    if (ex * ex + ey * ey <= limit) return true;
  }
  return false;
};

/**
 * 视口点是否落在猫身上（`characterBounds()` 的输出）。
 * 三条口径写死：
 * - **非有限坐标一律 false**：坐标坏掉时宁可让点击穿到桌面，也不要把整窗吃住——后者会让用户既点不到
 *   桌面、又拖不动猫（两个功能一起坏）。上游还有 `screenToViewport` 的缩放守卫兜一层。
 * - **边界算命中**（椭圆取 ≤1 / 多边形取内部 ∪ 距离 ≤ `rim`）：形状本身已按描边外扩过，再在边界上抠
 *   1px 没有意义，反而会让猫身与透明区的交界处随亚像素抖动。
 * - **按形状判、且判的就是画出来的那一份**：头是椭圆；躯干 / 尾 / 耳是**渲染用的那条真实轮廓**
 *   加描边带（`Bounds` 的 `polygon`）。这条是两轮修正的结论——R-01 把"头含耳一个大矩形"换成精确
 *   形状后死区仍有 7.12%（R-12），根因就是矩形是外接框：框里没画到的像素会被吃住。
 *   尾巴那条轮廓由调用方按**当前摆角**传进来（`characterBounds(tailRotationDeg)`），所以
 *   ±8° 甩尾期间也不会出现"看得见的尾巴点不动"。
 */
export function isOverCharacter(viewport: Point, bounds: Bounds[]): boolean {
  if (!Number.isFinite(viewport.x) || !Number.isFinite(viewport.y)) return false;
  return bounds.some((b) =>
    b.shape === "ellipse"
      ? inEllipse(viewport, b)
      : inPolygon(b.points, viewport) || nearRing(b.points, viewport, b.rim),
  );
}
