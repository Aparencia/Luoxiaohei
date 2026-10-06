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
import { characterBounds } from "../character/geometry.ts";
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
  console.log(`M6·⑤ 粗筛盒 ${bounds.length} 个｜猫身内 ${results.join(" ｜ ")}`);
  assert.equal(bounds.length, 8, "粗筛盒 = 头含耳 1 + 躯干 1 + 尾巴 6（geometry.ts 的固定形状）");
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
  const windowRect: Bounds = { x: 0, y: 0, width: 260, height: 300 };
  // 四个角上的点都落在窗口矩形内（`characterBounds()` 只盖住猫），且都不在任何粗筛盒里
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
