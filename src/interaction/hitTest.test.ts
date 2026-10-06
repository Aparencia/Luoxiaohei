/// <reference types="node" />
// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 4 ｜ 载体：SCOPE §5 M6 的验收命令
//
// 为什么这里一个打桩都没有：`screenToViewport` / `isOverCharacter` / `characterBounds()` 全是纯函数
// （D14⑤），TESTPLAN §7 的接缝约定把它们列进"不替换"那一行——打桩等于把被测物换掉。
//
// 四组 `scaleFactor` 是 M6 验收命令的逐字要求（1.0 / 1.25 / 1.5 / 2.0），同时它们就是 TESTPLAN §7
// MUT-7 的靶子：把 `screenToViewport` 里的除法改成乘法，四条全红。
//
// 期望值为什么写成整数字面量而不是 `(screen.x - origin.x) / scale`：后者是把实现抄一遍
// （同义反复）。四条用例的输入都刻意选成**二进制精确**的商，于是"字面量 = 数学结果"成立，
// 断言才有资格说"改哪一行会让它红"。
import { test } from "node:test";
import assert from "node:assert/strict";
import { CAT_GEOMETRY, DESIGN_TO_CSS, characterBounds } from "../character/geometry.ts";
import type { Bounds, Point } from "../character/geometry.ts";
import { isOverCharacter, screenToViewport } from "./hitTest.ts";

/** 视口坐标（CSS px，窗口左上角为原点）——与 `characterBounds()` 同一坐标系。 */
const at = (x: number, y: number): Point => ({ x, y });

test("M6·① scaleFactor = 1.0：视口坐标 = 屏幕坐标 − 窗口原点", () => {
  const viewport = screenToViewport(at(500, 300), at(480, 280), 1);
  console.log(`M6·① 屏幕 (500,300) − 原点 (480,280) ÷ 1 → 视口 (${viewport.x}, ${viewport.y})`);
  assert.deepEqual(viewport, at(20, 20));
});

test("M6·② scaleFactor = 1.25：除以缩放（含副屏在左侧的负坐标，SCOPE U1）", () => {
  const primary = screenToViewport(at(500, 300), at(480, 280), 1.25);
  // 副屏在主屏左侧：窗口原点是负数，屏幕坐标也是负数——换算不能靠 abs 或 clamp 蒙对
  const secondary = screenToViewport(at(-100, 50), at(-260, 0), 1.25);
  console.log(
    `M6·② 1.25 缩放 → 视口 (${primary.x}, ${primary.y})；副屏负坐标 → 视口 (${secondary.x}, ${secondary.y})`,
  );
  assert.deepEqual(primary, at(16, 16));
  assert.deepEqual(secondary, at(128, 40));
});

test("M6·③ scaleFactor = 1.5：两道坐标各自缩放，不许把 y 也按 x 的比例算", () => {
  const viewport = screenToViewport(at(500, 350), at(455, 200), 1.5);
  console.log(`M6·③ 屏幕 (500,350) − 原点 (455,200) ÷ 1.5 → 视口 (${viewport.x}, ${viewport.y})`);
  assert.deepEqual(viewport, at(30, 100));
});

test("M6·④ scaleFactor = 2.0：200% 缩放下同样成立", () => {
  const viewport = screenToViewport(at(500, 300), at(420, 180), 2);
  console.log(`M6·④ 屏幕 (500,300) − 原点 (420,180) ÷ 2 → 视口 (${viewport.x}, ${viewport.y})`);
  assert.deepEqual(viewport, at(40, 60));
});

test("M6·⑤ 猫身内的视口点命中（三个部件的已知坐标 + 屏幕↔视口往返）", () => {
  const bounds: Bounds[] = characterBounds();
  // 三个点都取自设计坐标 × 0.8125（260/320）：头部中心 (160,140)、躯干中部 (160,240)、尾巴中段 (283,246)
  // ⚠️ 第三点挑的是**尾巴**那 6 个分段的盒子（x 202..256）——不挑尾根：尾根被躯干盒盖住，
  // 拿它当"尾巴命中"的证据等于没测到分段（几何见 geometry.ts 的 `characterBounds()`）
  const onCat: Point[] = [at(130, 113.75), at(130, 195), at(230, 200)];
  const results = onCat.map((p) => `${p.x},${p.y}→${isOverCharacter(p, bounds)}`);
  console.log(`M6·⑤ 命中形状 ${bounds.length} 个｜猫身内 ${results.join(" ｜ ")}`);
  // 形状数是**固定几何**的机械后果，改 `characterBounds()` 必须同批改这里：
  // 头 1 个椭圆 + 耳 2 个三角形 + 躯干 1 个矩形 + 尾 6 个矩形 = 10（4-2 的 R-01 把"头含耳一个大盒"
  // 换成了精确形状——外接矩形的死区实测占窗口 9.9%，见 M6·⑦）
  assert.equal(bounds.length, 10, "命中形状 = 头 1 + 耳 2 + 躯干 1 + 尾 6（geometry.ts 的固定形状）");
  assert.deepEqual(
    bounds.map((b) => b.shape),
    ["ellipse", "triangle", "triangle", "rect", "rect", "rect", "rect", "rect", "rect", "rect"],
    "头必须是椭圆、耳必须是三角形（退化成矩形 = 死区涨回 9.9%，R-01）",
  );
  for (const p of onCat) assert.ok(isOverCharacter(p, bounds), `视口 (${p.x}, ${p.y}) 应在猫身上`);

  // 往返：屏幕坐标 = 原点 + 视口 × 缩放 → 换算回来必须还是同一个视口点（U1 的多显示器/混合 DPI 前提）
  const origin = at(300, 200);
  const scaleFactor = 1.5;
  const head = onCat[0];
  const screen = at(origin.x + head.x * scaleFactor, origin.y + head.y * scaleFactor);
  const back = screenToViewport(screen, origin, scaleFactor);
  console.log(`M6·⑤ 往返：视口 ${head.x},${head.y} → 屏幕 ${screen.x},${screen.y} → 视口 ${back.x},${back.y}`);
  assert.deepEqual(back, head);
  assert.ok(isOverCharacter(back, bounds), "往返回来的点必须仍然命中");
});

test("M6·⑥ 窗口里、猫身之外的四个透明点必须不命中（M6 的穿透前提）", () => {
  const bounds: Bounds[] = characterBounds();
  const windowRect = { width: 260, height: 300 };
  // 四个角上的点都落在窗口矩形内（`characterBounds()` 只盖住猫），且都不在任何命中形状里
  const blank: Point[] = [at(5, 5), at(250, 10), at(43, 26), at(20, 290)];
  const results = blank.map((p) => `(${p.x},${p.y})→${isOverCharacter(p, bounds)}`);
  console.log(`M6·⑥ 窗口内透明点 ${results.join(" ｜ ")}（窗口 ${windowRect.width}×${windowRect.height}）`);
  for (const p of blank) {
    assert.ok(
      p.x >= 0 && p.x <= windowRect.width && p.y >= 0 && p.y <= windowRect.height,
      `(${p.x}, ${p.y}) 不在窗口里，这条用例就没在测穿透`,
    );
    assert.equal(isOverCharacter(p, bounds), false, `视口 (${p.x}, ${p.y}) 是透明区，必须不命中`);
  }
  // 反空转：同一个点集里至少有一个命中，否则"全 false"也能让上面四条过（用猫身内的点当对照）
  assert.ok(isOverCharacter(at(130, 113.75), bounds), "对照组：该点必须命中，否则本用例恒真");
});

/**
 * M6·⑦ 是 4-2 的 **R-01** 的靶子：第一版把「头含耳」写成一个**外接矩形**，盒里大量像素什么都没画
 * （实测死区 7740 CSS px² = 窗口面积 **9.9%**）——那些像素上 SCOPE §5 M6 的用户故事不成立：
 * 点它们既点不到背后的桌面图标（被判成"在猫身上"），也拖不动猫（那片没有形状可命中）。
 *
 * 两条判据方向相反、必须同时成立：
 * - **不许漏盖**：画出来的像素（头部椭圆 ∪ 两个耳三角形，各含一半外露的描边）必须全部命中；
 * - **不许盖太多**：命中区域里"什么都没画"的面积占比要小，否则透明区被吃掉。
 * 期望值由 `CAT_GEOMETRY` 的几何 + `heicat.css` 的 `stroke-width: 4`（一半 = 2 设计 px）算出，
 * 不是把 `characterBounds()` 抄一遍；把形状退回矩形这条用例立刻红（实测 9.9% > 0.5%）。
 */
test("M6·⑦ 头/耳的形状像素全部被盖住，且死区 ≤ 窗口 0.5%（R-01 的靶子）", () => {
  const shapes = characterBounds().filter((b) => b.shape !== "rect");
  const head = CAT_GEOMETRY.head;
  const ears = CAT_GEOMETRY.ears;
  const RIM = 2; // 设计 px：`stroke-width: 4` 有一半画在填充之外（`heicat.css` 的描边口径）

  type Tri = { a: Point; b: Point; c: Point };
  const dilate = (t: Tri, by: number): Tri => {
    const v = [t.a, t.b, t.c];
    const c = { x: (v[0].x + v[1].x + v[2].x) / 3, y: (v[0].y + v[1].y + v[2].y) / 3 };
    const out = v.map((p) => {
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: p.x + (dx / len) * by, y: p.y + (dy / len) * by };
    });
    return { a: out[0], b: out[1], c: out[2] };
  };
  const inTri = (t: Tri, X: number, Y: number): boolean => {
    const side = (p: Point, q: Point): number => (X - q.x) * (p.y - q.y) - (p.x - q.x) * (Y - q.y);
    const d = [side(t.a, t.b), side(t.b, t.c), side(t.c, t.a)];
    return !(d.some((s) => s < 0) && d.some((s) => s > 0));
  };
  const earTris = ears.map((e) => dilate({ a: e.tip, b: e.outer, c: e.inner }, RIM));
  const painted = (X: number, Y: number): boolean => {
    const nx = (X - head.cx) / (head.rx + RIM);
    const ny = (Y - head.cy) / (head.ry + RIM);
    return nx * nx + ny * ny <= 1 || earTris.some((t) => inTri(t, X, Y));
  };

  const STEP = 1; // 设计 px
  const x0 = head.cx - head.rx - RIM;
  const x1 = head.cx + head.rx + RIM;
  const y0 = Math.min(...ears.flatMap((e) => [e.tip.y, e.outer.y, e.inner.y])) - RIM;
  const y1 = head.cy + head.ry + RIM;
  let leak = 0;
  let dead = 0;
  let paintedCount = 0;
  for (let X = x0; X <= x1; X += STEP) {
    for (let Y = y0; Y <= y1; Y += STEP) {
      const onCat = painted(X, Y);
      const hit = isOverCharacter(at(X * DESIGN_TO_CSS, Y * DESIGN_TO_CSS), shapes);
      if (onCat) paintedCount++;
      if (onCat && !hit) leak++;
      if (!onCat && hit) dead++;
    }
  }
  const cell = (STEP * DESIGN_TO_CSS) ** 2;
  const windowArea = 260 * 300;
  console.log(
    `M6·⑦ 采样 ${paintedCount} 个形状像素：漏盖 ${leak} 个；死区 ${(dead * cell).toFixed(0)} CSS px² = ` +
      `窗口面积 ${((dead * cell * 100) / windowArea).toFixed(2)}%（要求 0 漏盖 / ≤0.5% 死区；旧实现 9.9%）`,
  );
  assert.equal(shapes.length, 3, "这一层只有头 1 个椭圆 + 耳 2 个三角形（躯干/尾段是矩形，不参与本判据）");
  assert.equal(leak, 0, `${leak} 个画出来的像素不在任何命中形状里：那片猫身点不到也拖不动`);
  assert.ok(
    (dead * cell) / windowArea <= 0.005,
    `死区占窗口 ${(((dead * cell) / windowArea) * 100).toFixed(2)}% > 0.5%：那些像素既点不到桌面也拖不动猫（R-01）`,
  );
  // 定点回归：R-01 实测为"命中"的四个透明像素，现在必须是 false（它们什么都没画）
  for (const p of [at(130, 25), at(130, 21), at(57, 49), at(203, 49)]) {
    assert.equal(
      isOverCharacter(p, shapes),
      false,
      `视口 (${p.x}, ${p.y}) 是头顶上方/椭圆四角的透明像素，不许判成猫身（R-01）`,
    );
  }
  // 反向定点：形状边界再往外 1 个设计 px 的地方（描边所在的那一圈）必须仍然命中，否则边缘拖不动
  const rimProbe = at(head.cx * DESIGN_TO_CSS, (head.cy - head.ry - 1) * DESIGN_TO_CSS);
  assert.ok(isOverCharacter(rimProbe, shapes), "描边那一圈（椭圆外 1 设计 px）必须命中：它是画出来的");
});
