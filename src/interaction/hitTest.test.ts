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
import { readFileSync } from "node:fs";
import { CAT_GEOMETRY, DESIGN_TO_CSS, TAIL_SWAY_DEG, TAIL_SWAY_EASING, TAIL_SWAY_MS, characterBounds, tailSwayAngleAt } from "../character/geometry.ts";
import type { Bounds, Point } from "../character/geometry.ts";
import { isOverCharacter, screenToViewport } from "./hitTest.ts";

/** 视口坐标（CSS px，窗口左上角为原点）——与 `characterBounds()` 同一坐标系。 */
const at = (x: number, y: number): Point => ({ x, y });

const root = new URL("../../", import.meta.url);
const readText = (rel: string) => readFileSync(new URL(rel, root), "utf8");

/**
 * 绝对 `M/L/C/Q/Z` 的路径解析（曲线按 `per` 段折线化）——**不复用生产侧任何代码**。
 * 这是 4-2 第 2 轮 R-14 的整改：旧用例的 `painted()` 把生产的 `dilateTriangle` 抄了一遍，
 * 于是"漏盖"那一半恒等于 0（自己给自己打分）。这里改成直接读生产**渲染用的那条 `d`**，
 * 按 CSS 的描边语义算"画没画"，与被测物是两条独立的路。
 * 见到不认识的命令直接抛——防"悄悄少算一段"。
 */
function parsePoly(d: string, per = 32): Point[] {
  const tokens = d.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g) ?? [];
  const pts: Point[] = [];
  let i = 0;
  let cur = at(0, 0);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "Z") continue;
    if (cmd === "M" || cmd === "L") {
      cur = at(Number(tokens[i++]), Number(tokens[i++]));
      pts.push(cur);
      continue;
    }
    if (cmd === "C" || cmd === "Q") {
      const c1 = at(Number(tokens[i++]), Number(tokens[i++]));
      const c2 = cmd === "C" ? at(Number(tokens[i++]), Number(tokens[i++])) : c1;
      const to = at(Number(tokens[i++]), Number(tokens[i++]));
      for (let k = 1; k <= per; k++) {
        const t = k / per;
        const u = 1 - t;
        pts.push(
          cmd === "C"
            ? at(
                u * u * u * cur.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
                u * u * u * cur.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y,
              )
            : at(
                u * u * cur.x + 2 * u * t * c1.x + t * t * to.x,
                u * u * cur.y + 2 * u * t * c1.y + t * t * to.y,
              ),
        );
      }
      cur = to;
      continue;
    }
    throw new Error(`路径解析器只认绝对 M/L/C/Q/Z，收到 "${cmd}"（d=${d.slice(0, 40)}…）`);
  }
  return pts;
}

/** 环的内部（射线法）。 */
const insideRing = (ring: Point[], p: Point): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

/** 到环边界的最近距离（欧氏）。 */
const distToRing = (ring: Point[], p: Point): number => {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
};

/** 从 `heicat.css` 现读某个选择器所在规则的 `stroke-width`：命中区域的一半依赖它，不许靠记忆写常数。 */
function strokeWidthOf(css: string, selector: string): number {
  // 解析前去掉注释：注释不是 CSS（`motion.test.ts` 的同一条口径），留着会把选择器读成 "/* … */ .hei-leg"
  const plain = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const block of plain.split("}")) {
    const [selectors, body = ""] = block.split("{");
    if (!selectors || !body) continue;
    if (!selectors.split(",").some((s) => s.trim() === selector)) continue;
    const width = body.match(/stroke-width:\s*([\d.]+)/);
    if (width) return Number(width[1]);
  }
  throw new Error(`heicat.css 里找不到 ${selector} 的 stroke-width：命中区域的描边带宽度没有出处了`);
}

/** 绕枢轴旋转（设计坐标）——与生产 `characterBounds(tailRotationDeg)` 同一条定义。 */
const rotateAbout = (p: Point, pivot: Point, deg: number): Point => {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return at(pivot.x + dx * cos - dy * sin, pivot.y + dx * sin + dy * cos);
};

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
  // 头部中心 (160,140) 与躯干中部 (160,240) 取设计坐标 × 0.8125（260/320）。
  // 尾巴那一点**从渲染用的轮廓里现取**：环是对称的（左缘第 i 点与右缘第 i 点的中点 = 该处中心线），
  // 所以两个对应点的中点必然落在尾巴里，而且随几何一起动。
  // ⚠️ 手写的 (230,200) 已删：4-2 第 2 轮的真渲染实测那个像素是**纯洋红**（什么都没画）——它落在
  //    尾巴弯里的透明区（尾巴甩到 −8° 时才盖住它），旧用例却把它当"尾巴命中"的证据，等于把死区
  //    写成了期望行为。相位本身另有用例（M6·⑧）。
  const tailRing = parsePoly(CAT_GEOMETRY.tail.outlineD);
  const midIndex = 20;
  const tailMid = at(
    ((tailRing[midIndex].x + tailRing[tailRing.length - 1 - midIndex].x) / 2) * DESIGN_TO_CSS,
    ((tailRing[midIndex].y + tailRing[tailRing.length - 1 - midIndex].y) / 2) * DESIGN_TO_CSS,
  );
  const onCat: Point[] = [at(130, 113.75), at(130, 195), tailMid];
  const results = onCat.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}→${isOverCharacter(p, bounds)}`);
  console.log(`M6·⑤ 命中形状 ${bounds.length} 个｜猫身内 ${results.join(" ｜ ")}`);
  // 形状数是**固定几何**的机械后果，改 `characterBounds()` 必须同批改这里：
  // 头 1 个椭圆 + 耳 2 个三角形 + 躯干 1 条轮廓 + 尾 1 条轮廓 = 5。
  // （4-2 的 R-01 先把"头含耳一个大盒"换成精确形状；第 2 轮的 R-12 又把躯干与尾段的 7 个**外接矩形**
  //  换成真实轮廓——矩形框里没画到的像素会被吃住，那正是 7.12% 死区的主因）
  assert.equal(bounds.length, 5, "命中形状 = 头 1 + 耳 2 + 躯干 1 + 尾 1（geometry.ts 的固定形状）");
  assert.deepEqual(
    bounds.map((b) => b.shape),
    ["ellipse", "polygon", "polygon", "polygon", "polygon"],
    "头是椭圆、其余四条必须是真实轮廓多边形（退回矩形 = 死区涨回 7.12%，R-12）",
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
 * M6·⑦ 是 **R-01 / R-12 / R-13 / R-14** 四条一起的靶子：窗口里"判得中的"与"画出来的"必须是同一批像素。
 *
 * 旧版有两个结构性洞（4-2 第 2 轮实测）：
 * - 取样域被 `filter((b) => b.shape !== "rect")` 砍成头+耳 ⇒ 承载 7.12% 死区的躯干与尾段**不在判据内**；
 * - "漏盖"那半边用的 `dilate` 是生产 `dilateTriangle` 的复制品 ⇒ 两边同源，恒等于 0（自己给自己打分）。
 * 现在：取样域 = **全部**命中形状；`painted()` 只认"生产渲染用的那条 `d`" + CSS 的描边语义；
 * 尾巴按 ±8° 两端各量一次（`heicat.css` 的 `tailSway`，MOTION §2）。
 *
 * 判据两条：① 画出来的像素一个都不许漏（`leak === 0`）② 死区 ≤ 窗口 0.5%
 * （SCOPE §5 M6 在那片像素上反过来成立：点它应该点到桌面）。
 * 描边半宽与连接方式从 `heicat.css` 现读、不写死常数——CSS 一改这条用例就红，而不是让模型悄悄失真。
 */
test("M6·⑦ 全窗口双向判据：画出来的全部命中、死区 ≤ 0.5%（含 ±8° 甩尾两端）", () => {
  const css = readText("src/character/heicat.css");
  const BODY_RIM = strokeWidthOf(css, ".hei-torso") / 2;
  const LEG_RIM = strokeWidthOf(css, ".hei-leg") / 2;
  assert.equal(BODY_RIM, 2, "躯干/尾/耳/头 的 stroke-width 必须是 4（一半 = 2 设计 px）");
  assert.match(
    css,
    /stroke-linejoin:\s*round/,
    '命中区域按「圆角连接 ⇒ 描边带 = 到边界距离 ≤ 半宽」建模，CSS 必须仍是 round',
  );

  const head = CAT_GEOMETRY.head;
  const pivot = at(CAT_GEOMETRY.tail.rootX, CAT_GEOMETRY.tail.rootY);
  const source: { name: string; ring: Point[]; rim: number }[] = [
    ...CAT_GEOMETRY.ears.map((e) => ({ name: "ear", ring: parsePoly(e.pathD), rim: BODY_RIM })),
    { name: "torso", ring: parsePoly(CAT_GEOMETRY.torso.pathD), rim: BODY_RIM },
    // 腿也在"画出来的"里：它被躯干盖住（漏判由躯干兜底），但口径上不假装它不存在
    ...CAT_GEOMETRY.legs.map((l) => ({ name: "leg", ring: parsePoly(l.pathD, 8), rim: LEG_RIM })),
  ];
  const baseTail = parsePoly(CAT_GEOMETRY.tail.outlineD);
  const boxOf = (ring: Point[], rim: number) => ({
    x0: Math.min(...ring.map((p) => p.x)) - rim,
    y0: Math.min(...ring.map((p) => p.y)) - rim,
    x1: Math.max(...ring.map((p) => p.x)) + rim,
    y1: Math.max(...ring.map((p) => p.y)) + rim,
  });

  const measure = (deg: number, step: number) => {
    const parts = [
      ...source,
      { name: "tail", ring: baseTail.map((p) => rotateAbout(p, pivot, deg)), rim: BODY_RIM },
    ];
    const boxes = parts.map((part) => boxOf(part.ring, part.rim));
    const bounds = characterBounds(deg);
    const painted = (X: number, Y: number): boolean => {
      // 头：椭圆 + 描边。用 rx+半宽 的椭圆近似真实平行曲线，实测最大偏差 ≈0.002 设计 px
      // （两条曲线在长/短轴处相切，45° 处支撑函数只差 0.0017），对 1 设计 px 的网格无影响。
      const nx = (X - head.cx) / (head.rx + BODY_RIM);
      const ny = (Y - head.cy) / (head.ry + BODY_RIM);
      if (nx * nx + ny * ny <= 1) return true;
      for (let i = 0; i < parts.length; i++) {
        const box = boxes[i];
        if (X < box.x0 || X > box.x1 || Y < box.y0 || Y > box.y1) continue; // 包围盒先挡掉绝大多数点
        const p = at(X, Y);
        if (insideRing(parts[i].ring, p) || distToRing(parts[i].ring, p) <= parts[i].rim) return true;
      }
      return false;
    };
    const all = parts.flatMap((part) => part.ring);
    const x0 = Math.min(...all.map((p) => p.x), head.cx - head.rx) - BODY_RIM;
    const x1 = Math.max(...all.map((p) => p.x), head.cx + head.rx) + BODY_RIM;
    const y0 = Math.min(...all.map((p) => p.y), head.cy - head.ry) - BODY_RIM;
    const y1 = Math.max(...all.map((p) => p.y), head.cy + head.ry) + BODY_RIM;
    let leak = 0;
    let dead = 0;
    let paintedCount = 0;
    for (let X = x0; X <= x1; X += step) {
      for (let Y = y0; Y <= y1; Y += step) {
        const on = painted(X, Y);
        const hit = isOverCharacter(at(X * DESIGN_TO_CSS, Y * DESIGN_TO_CSS), bounds);
        if (on) paintedCount++;
        if (on && !hit) leak++;
        if (!on && hit) dead++;
      }
    }
    const cell = (step * DESIGN_TO_CSS) ** 2;
    return { deg, step, leak, paintedCount, deadPx: dead * cell };
  };

  // 静态姿态用 1 设计 px 网格（主要声明就落在这里）；±8° 两端用 2 px 网格——0.5% 的预算在 2 px 网格下
  // 仍有 148 格，判得动；1 px 网格会让这条用例从 ~0.3 s 涨到 ~2 s（TESTPLAN §0 的"自动化 <5 s"）。
  const windowArea = 260 * 300;
  for (const [deg, step] of [
    [0, 1],
    [8, 2],
    [-8, 2],
  ] as const) {
    const r = measure(deg, step);
    const pct = (r.deadPx * 100) / windowArea;
    console.log(
      `M6·⑦ 相位 ${deg > 0 ? "+" : ""}${deg}°（网格 ${r.step} 设计 px）：绘制 ${r.paintedCount} 点｜漏盖 ${r.leak} 点｜` +
        `死区 ${r.deadPx.toFixed(0)} CSS px² = 窗口 ${pct.toFixed(3)}%（要求 0 漏盖 / ≤0.500%）`,
    );
    assert.equal(r.leak, 0, `相位 ${deg}°：${r.leak} 个画出来的像素不在命中形状里——那片猫身点不到也拖不动`);
    assert.ok(
      r.deadPx / windowArea <= 0.005,
      `相位 ${deg}°：死区占窗口 ${pct.toFixed(3)}% > 0.5%——那些像素既点不到桌面也拖不动猫`,
    );
  }

  const stat = characterBounds(0);
  // 定点回归一：首轮 R-01 点名的四个透明像素（头顶上方与椭圆四角）必须仍然 false
  for (const p of [at(130, 25), at(130, 21), at(57, 49), at(203, 49)]) {
    assert.equal(isOverCharacter(p, stat), false, `视口 (${p.x}, ${p.y}) 是头顶上方/椭圆四角的透明像素（R-01）`);
  }
  // 定点回归二：4-2 第 2 轮用**真渲染**量出来的 6 个死区像素（headless Edge 截图 + 父页洋红底；
  // 这 6 点在旧实现里全是 (255,0,255) 却被判成"在猫身上"）——修复后必须全部 false
  for (const p of [at(241, 262), at(249, 68), at(254, 230), at(203, 244), at(224, 210), at(229, 110)]) {
    assert.equal(isOverCharacter(p, stat), false, `视口 (${p.x}, ${p.y}) 是实测的透明像素（R-12 的死区）`);
  }
  // 反向定点：椭圆描边那一圈（椭圆外 1 设计 px）落在描边里、是画出来的，必须仍然命中
  const rimProbe = at(head.cx * DESIGN_TO_CSS, (head.cy - head.ry - 1) * DESIGN_TO_CSS);
  assert.ok(isOverCharacter(rimProbe, stat), "椭圆外 1 设计 px 在描边里，必须命中：它是画出来的");
});

/**
 * M6·⑧ 是 **R-13** 的靶子：命中形状不能是一张"静态照片"。
 * `.hei-tail` 在 `prefers-reduced-motion: no-preference`（默认用户）下**永远**绕尾根摆 ±8°
 * （`heicat.css` 的 `tailSway`，周期 2.4s）——静态模型在两端各有 1.48%~3.30% 的窗口面积反着判：
 * 看得见的尾巴点不动，看不见的位置反而吃掉点击。
 *
 * 证据来自 4-2 第 2 轮的真渲染实测：CSS 像素 (230,200) 在 **0° 是纯洋红**（尾巴弯里的透明区）、
 * 在 **−8° 是尾巴的像素 (15,15,22)**、在 **+8° 又空出来**。所以这个点同时钉住三件事：
 * 静态姿态不误判、相位真的进了判定、方向没搞反。
 */
test("M6·⑧ 尾巴的摆动相位进了命中判定（R-13 的靶子）", () => {
  const probe = at(230, 200);
  const stat = isOverCharacter(probe, characterBounds(0));
  const minus = isOverCharacter(probe, characterBounds(-8));
  const plus = isOverCharacter(probe, characterBounds(8));
  console.log(`M6·⑧ (230,200) 三个相位：0°→${stat} ｜ −8°→${minus} ｜ +8°→${plus}`);
  assert.equal(stat, false, "静态姿态下这里是尾巴弯里的透明区（真渲染实测为纯洋红）");
  assert.equal(minus, true, "甩到 −8° 时尾巴画到了这块像素，必须命中——否则看得见的尾巴点不动、拖不动");
  assert.equal(plus, false, "+8° 时尾巴离开了这块像素，必须不命中——否则透明区吃掉点击");
  // 相位是纯入参：非法角度按静态姿态算，绝不产出 NaN 几何（与 hitTest 的守卫同一口径）
  assert.deepEqual(characterBounds(Number.NaN), characterBounds(0), "非有限相位按静态姿态算");
  assert.deepEqual(characterBounds(0), characterBounds(-0), "−0 与 0 是同一个姿态");
});

/**
 * M6·⑨ 是 R-13 的**相位来源**：命中环靠 `tailSwayAngleAt(动画时钟)` 得到角度，而这张映射表的
 * 取值不许自成一套——本用例直接解析 `heicat.css` 的 `tailSway`，把周期 / 停点 / 角度 / 缓动
 * 逐项与 `geometry.ts` 的常量对齐。CSS 改了而代码没跟上 → 这里立刻红（D12：同一事实只写一处，
 * 另一处必须是**被绑住的镜像**，不是自由的第二份真相）。
 */
test("M6·⑨ 甩尾相位：映射表的常量逐项绑到 heicat.css 的 tailSway（R-13）", () => {
  const css = readText("src/character/heicat.css");
  const duration = /animation:\s*tailSway\s+([\d.]+)ms\s+cubic-bezier\(([^)]+)\)/.exec(css);
  assert.ok(duration !== null, "heicat.css 里找不到 `animation: tailSway …ms cubic-bezier(…)`");
  assert.equal(Number(duration[1]), TAIL_SWAY_MS, "周期必须与 CSS 同值");
  assert.deepEqual(
    duration[2].split(",").map((v) => Number(v.trim())),
    [...TAIL_SWAY_EASING],
    "缓动必须与 CSS 同值：映射表里逐段解的就是它",
  );

  const body = /@keyframes\s+tailSway\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
  const stops = [...body.matchAll(/([\d.]+)%\s*\{\s*transform:\s*rotate\((-?[\d.]+)deg\)/g)].map((m) => [
    Number(m[1]) / 100,
    Number(m[2]),
  ]);
  assert.deepEqual(
    stops,
    [
      [0, 0],
      [0.25, -TAIL_SWAY_DEG],
      [0.75, TAIL_SWAY_DEG],
      [1, 0],
    ],
    `关键帧停点/角度必须与映射表同值，CSS 实测 ${JSON.stringify(stops)}`,
  );

  // 停点上的取值：25% 与 75% 恰好是两端（±8°），首末回中性（`reduce` 播完不跳变）
  assert.equal(tailSwayAngleAt(0), 0, "0% 回中性");
  assert.equal(tailSwayAngleAt(TAIL_SWAY_MS * 0.25), -TAIL_SWAY_DEG, "25% 是 −8°");
  assert.equal(tailSwayAngleAt(TAIL_SWAY_MS * 0.75), TAIL_SWAY_DEG, "75% 是 +8°");
  assert.equal(tailSwayAngleAt(TAIL_SWAY_MS), 0, "一整圈之后回到中性（无限循环的取模）");
  // 缓动是**逐段**解的：段中点（12.5%）不是线性的一半，而是被 ease-out 推到 −7.0° 附近。
  // 这条是"缓动写没写"的判别式：把 bezierAt 换成线性，它会变成恰好 −4 而红。
  const mid = tailSwayAngleAt(TAIL_SWAY_MS * 0.125);
  console.log(
    `M6·⑨ 相位 → 角度：0% → ${tailSwayAngleAt(0)}°｜12.5% → ${mid.toFixed(3)}°（线性会是 −4）｜` +
      `25% → ${tailSwayAngleAt(TAIL_SWAY_MS * 0.25)}°｜75% → ${tailSwayAngleAt(TAIL_SWAY_MS * 0.75)}°`,
  );
  assert.ok(mid < -6 && mid > -TAIL_SWAY_DEG, `12.5% 应为 ${mid.toFixed(3)}°，落在 (−8, −6)：缓动没生效就是 −4`);
  // 全程有界且不产 NaN（U3：禁 NaN 几何）
  for (let t = -3 * TAIL_SWAY_MS; t <= 3 * TAIL_SWAY_MS; t += 37) {
    const angle = tailSwayAngleAt(t);
    assert.ok(Number.isFinite(angle) && Math.abs(angle) <= TAIL_SWAY_DEG + 1e-9, `t=${t}ms → ${angle}° 越界`);
  }
  assert.equal(tailSwayAngleAt(Number.NaN), 0, "非有限时间按静态姿态算");
  assert.equal(tailSwayAngleAt(Number.POSITIVE_INFINITY), 0, "无穷时间按静态姿态算");
});
