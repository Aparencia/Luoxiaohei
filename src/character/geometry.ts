// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 2 ｜ M3 造型的几何单一事实源（纯数据 + 纯查询，零副作用）
//
// 为什么几何住在这里而不是 `HeiCat.tsx`：DESIGN §12 G1 的原文——"几何常量必须住在**非 JSX 文件**里
// （D14① 纯逻辑与副作用分文件）"，且批次 4 的 `src/interaction/hitTest.ts` 要拿同一批数字做命中粗筛。
//
// 与 DESIGN §3.5 契约的逐条对账（多出来的字段是本批的加法，已写进 STATE.md 的未决问题留痕）：
//   `VIEW_BOX` / `head` / `eyeWhites` / `pupils` / `eyelidTravelPx` / `tail` / `torsoOriginY` = 契约原文；
//   `ears` / `torso` / `legs` / `eyelids` = 契约漏登、但 M3 判不了的东西（KP-04 要耳距、要体高，M3·⑥ 要无颈），
//   取值全部出自 `docs/DESIGN_TOKENS.md` §10 的造型表，本文件只决定它们**住在哪**，没有新增设计决策；
//   `tail.outlineD` = 单一事实源的必然结果：§10 要求尾巴是"沿贝塞尔中心线生成的锥形实体"，
//   于是轮廓在模块加载时由**同一组控制点**算出——手抄第二份坐标迟早漂移（D12 信息阶梯）；
//   `pupils` 的类型是 `Ellipse` 而不是契约写的 `Circle`：3-5 卡给的取值是 rx 32 / ry 41（不是正圆），
//   `Circle` 承载不了；SCOPE §7 元素表的 `<circle>` 是元素语义（"黑眼珠"），取值以 4-1 的画图依据为准。
//
// 数字的两条来源（不许第三种）：`DESIGN_TOKENS.md` §10 的造型表；或由表里的数字**推导**（推导式写在注释里）。

export type Point = { x: number; y: number };
export type Ellipse = { cx: number; cy: number; rx: number; ry: number };
/**
 * 命中形状（单位 CSS px）——**不是一个矩形**。4-2 的 R-01 实测「头含耳一个大矩形」的死区达
 * 窗口面积的 9.9%，所以头用椭圆、耳用三角形（两者本来就是精确几何体），只有形状方正的
 * 躯干与尾段仍用矩形。判定住在 `src/interaction/hitTest.ts` 的 `isOverCharacter()`。
 */
export type Bounds =
  | { shape: "rect"; x: number; y: number; width: number; height: number }
  | { shape: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { shape: "triangle"; a: Point; b: Point; c: Point };
/**
 * 一只耳 = 一个三角形（耳尖 / 外底角 / 内底角），设计坐标。
 * `pathD` 与命中盒都由这三个点**现算**——手抄第二份坐标迟早漂移（4-2 的 R-01 就是靠这几个点
 * 才可能把耳盒切得贴近三角形；改回"一个外接矩形"死区立刻涨 3 倍）。
 */
export type EarShape = {
  rootX: number;
  rootY: number;
  tip: Point;
  outer: Point;
  inner: Point;
  pathD: string;
};
export type EyeLidShape = Ellipse & { pathD: string };
export type TorsoShape = {
  topY: number;
  topHalfWidth: number;
  bottomY: number;
  bottomHalfWidth: number;
  pathD: string;
};
export type TailShape = {
  rootX: number;
  rootY: number;
  lengthPx: number;
  pathD: string;
  outlineD: string;
};

/**
 * 设计坐标 → CSS px 的缩放。SVG 的 `width:100%` 让它铺满窗口宽 260 CSS px（`tauri.conf.json`
 * 的 `app.windows[0].width`），而 `VIEW_BOX` 宽 320 → 260 ÷ 320 = 0.8125，高相应 360 × 0.8125 = 292.5，
 * 窗口 300 高 − 292.5 = **底部余 7.5px**（SCOPE §7 写"留 8px"是取整表述，3-5 卡已登记）。
 * 导出是 4-2 的 S-12 要求的：窗口宽这个事实写在两处（配置 + 这个常量），导出后测试才能把两者绑住
 * （`geometry.test.ts` M3·⑥ 断言 `DESIGN_TO_CSS === WINDOW.width / 320`）。
 */
export const DESIGN_TO_CSS = 260 / 320;

/** 设计坐标系（DESIGN_TOKENS §10）：`'0 0 320 360'`。3-5 卡勘误原值 `'0 0 260 300'`——照原值身体底沿 y=352 会被裁掉脚。 */
export const VIEW_BOX = "0 0 320 360";

const at = (x: number, y: number): Point => ({ x, y });
const round1 = (n: number): number => Math.round(n * 10) / 10;
const fmt = (n: number): string => String(round1(n));

// ── 头部与耳（DESIGN_TOKENS §10：头部椭圆圆心 (160,140)、rx100/ry92）────────────────────────
const HEAD: Ellipse = { cx: 160, cy: 140, rx: 100, ry: 92 };
/** 耳尖 y = 24：M3·③ 的"体高"= 352 − 24 = 328 就是从这里来的（两个数各自只有一个出处）。 */
const EAR_TIP_Y = 24;
/** 耳根中心的 y 由头部椭圆推出：140 − 92×√(1−(60/100)²) = 66.4 → 取 66（往头里埋 0.4px，防接缝漏光）。 */
const EAR_ROOT_Y = 66;
/**
 * 一只耳 = 一个三角形；`pathD` 由这三个点现算（一只耳只有一份坐标，D12）。
 * 底边两角刻意落在头部椭圆**内部**（(75,95) 与 (125,82) 都在椭圆里）：由后画的头盖住，
 * 露出来的那段边界正好是头的弧线 → 耳朵看起来是"从头里长出来的"，而不是贴上去的三角片。
 */
const ear = (rootX: number, tip: Point, outer: Point, inner: Point): EarShape => ({
  rootX,
  rootY: EAR_ROOT_Y,
  tip,
  outer,
  inner,
  pathD: `M${fmt(outer.x)} ${fmt(outer.y)} L${fmt(tip.x)} ${fmt(tip.y)} L${fmt(inner.x)} ${fmt(inner.y)} Z`,
});
const EARS: [EarShape, EarShape] = [
  ear(100, at(96, EAR_TIP_Y), at(75, 95), at(125, 82)),
  ear(220, at(224, EAR_TIP_Y), at(245, 95), at(195, 82)),
];

// ── 眼睛（同一张表：两眼中心 x=113/207、y=136、rx45/ry52；瞳孔 rx32/ry41、相对眼心 (+2,+4)）──────
const EYE_RX = 45;
const EYE_RY = 52;
const EYE_CY = 136;
const EYE_WHITES: [Ellipse, Ellipse] = [
  { cx: 113, cy: EYE_CY, rx: EYE_RX, ry: EYE_RY },
  { cx: 207, cy: EYE_CY, rx: EYE_RX, ry: EYE_RY },
];
/** 瞳孔偏移 (+2,+4)：往下偏，让**上眼白更宽**——罗小黑的眼白主要露在上半（DESIGN_TOKENS §10）。 */
const PUPIL_DX = 2;
const PUPIL_DY = 4;
const PUPILS: [Ellipse, Ellipse] = [
  { cx: EYE_WHITES[0].cx + PUPIL_DX, cy: EYE_CY + PUPIL_DY, rx: 32, ry: 41 },
  { cx: EYE_WHITES[1].cx + PUPIL_DX, cy: EYE_CY + PUPIL_DY, rx: 32, ry: 41 },
];

/**
 * 瞳孔能走多远（SCOPE §7 元素表原文："距中心最大偏移 = 眼白短半径的 45%"）。
 * 眼白 `rx = 45` / `ry = 52`，**短半径 = `rx` = 45** → 满偏 20.25（设计坐标）；乘上 `gazeTravel`（0~1）
 * 才是实时位移。
 * ⚠️ 4-2 的 R-02：第一版取的是 `ry`（=52，满偏 23.4，多走 15.6%）——注释当时还写着"短半径 = ry"，
 * 把长短读反了；而 `pupilOffsetFor` 当时**零测试引用**，所以这条幅度判据没人守（现已由 M5·⑩ 兜住）。
 * 顺带量到：瞳孔 `ry = 41` + 23.4 = 64.4 > 眼白 `ry = 52` ⇒ 用 ry 时满偏会画出眼白轮廓之外。
 */
export const PUPIL_TRAVEL_RATIO = 0.45;

/**
 * M5：把（角度 0~±180°，幅度 0~1）换算成瞳孔相对**静态姿态**的位移（设计坐标 px）。
 * 为什么静态姿态不进返回值：瞳孔的 `(+2,+4)` 已经烘进 `CAT_GEOMETRY.pupils` 的 cx/cy，
 * 这里只回答"从静态姿态再走多远"——位移 0 就是回正（SCOPE §5 M5 的"瞳孔回到正中"）。
 * 非有限输入一律当 0：SCOPE U3 禁 `rotate(NaN)`，同理这里不许产出 `translate(NaN)`。
 */
export function pupilOffsetFor(gazeDeg: number, gazeTravel: number): Point {
  const deg = Number.isFinite(gazeDeg) ? gazeDeg : 0;
  const travel = Number.isFinite(gazeTravel) ? Math.min(1, Math.max(0, gazeTravel)) : 0;
  const radius = PUPIL_TRAVEL_RATIO * EYE_RX * travel;
  const rad = (deg * Math.PI) / 180;
  return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
}

/** 椭圆写成 `<path>`：SCOPE §7 元素表指定眼睑是 `<path>`（两段 180° 弧，不是 `<ellipse>`）。 */
const ellipsePathD = (e: Ellipse): string =>
  `M${fmt(e.cx - e.rx)} ${fmt(e.cy)} A ${fmt(e.rx)} ${fmt(e.ry)} 0 1 0 ${fmt(e.cx + e.rx)} ${fmt(e.cy)} A ${fmt(e.rx)} ${fmt(e.ry)} 0 1 0 ${fmt(e.cx - e.rx)} ${fmt(e.cy)} Z`;

/**
 * 眼皮（SCOPE §7：默认 `scaleY(0)` 不可见、眨眼时 0 → 1 → 0）。
 * 形状 = 眼白自身：盖满时眼睛变成头部底色，读作"闭眼"；半程时是一枚从上方压下来的梭形。
 */
const EYELIDS: [EyeLidShape, EyeLidShape] = [
  { ...EYE_WHITES[0], pathD: ellipsePathD(EYE_WHITES[0]) },
  { ...EYE_WHITES[1], pathD: ellipsePathD(EYE_WHITES[1]) },
];

// ── 躯干与腿（§10：钟形、底宽 ±74、底沿 y≈352；前腿宽 38、y 262→344、下方半圆收脚）──────────
/**
 * 躯干顶边 y=150 藏在头部椭圆里（M3·⑥ 的"无颈"判据 = 两个顶角都满足椭圆方程 < 1）。
 * 头身比的抓手就是它：躯干高 = 352 − 150 = 202，头高 = 2×92 = 184 → 202 ÷ 184 = 1.098 ≈ 1:1.1。
 */
const TORSO: TorsoShape = {
  topY: 150,
  topHalfWidth: 50,
  bottomY: 352,
  bottomHalfWidth: 74,
  // 底角用二次贝塞尔收圆：起点切线竖直、终点切线水平 → 与侧边、底边都平滑相接
  pathD:
    "M110 150 C96 200 86 268 86 336 Q86 352 100 352 L220 352 Q234 352 234 336 C234 268 224 200 210 150 Z",
};
const LEGS: [{ pathD: string }, { pathD: string }] = [
  // 脚底 = 330 + 0.75×18 = 343.5（§10 写"y→344"）：普通三次贝塞尔在 t=0.5 处只走到控制点高度的 3/4
  { pathD: "M116 262 L154 262 L154 330 C154 348 116 348 116 330 Z" },
  { pathD: "M166 262 L204 262 L204 330 C204 348 166 348 166 330 Z" },
];

// ── 尾巴（§10：根部宽 30 → 尖端宽 10、自身体右下向右上兜回、目标弧长 408）────────────────────
type Cubic = readonly [Point, Point, Point, Point];
/**
 * 两段三次贝塞尔。控制点是**试出来的**，三条判据都在会话内探针里量过（`%TEMP%\geom-probe*.mjs`）：
 * ① 采样弧长 408.0（= 声明的 `lengthPx`，Δ0.00%）；② 锥形轮廓留在画布内（最右 314.9 < 320）；
 * ③ 尾尖 (236,46) 既不落在头部椭圆里、也不压住右耳（否则尾尖会从耳朵里穿出来）。
 */
const TAIL_CURVE: readonly Cubic[] = [
  [at(190, 336), at(294, 364), at(314, 238), at(300, 126)],
  [at(300, 126), at(288, 54), at(264, 26), at(236, 46)],
];
const TAIL_ROOT_HALF = 15;
const TAIL_TIP_HALF = 5;
/** 每段采样数：16 点时弦长约 12.7px、矢高 ≈0.2px（肉眼不可见），再密只是把 `pathD` 撑长。 */
const TAIL_OUTLINE_SAMPLES = 16;

const pointAt = ([p0, p1, p2, p3]: Cubic, t: number): Point => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};

const sampleCubics = (curve: readonly Cubic[], perSegment: number): Point[] => {
  const pts: Point[] = [];
  for (const segment of curve) {
    for (let k = 0; k <= perSegment; k++) {
      if (k === 0 && pts.length > 0) continue; // 段与段的接点只留一份，否则长度里多算一段零
      pts.push(pointAt(segment, k / perSegment));
    }
  }
  return pts;
};

const pathDFrom = (curve: readonly Cubic[]): string => {
  let d = `M${fmt(curve[0][0].x)} ${fmt(curve[0][0].y)}`;
  for (const segment of curve) {
    // 后续段的起点就是上一段的终点（SVG 的隐式当前点），不重复写
    d += ` C${fmt(segment[1].x)} ${fmt(segment[1].y)} ${fmt(segment[2].x)} ${fmt(segment[2].y)} ${fmt(segment[3].x)} ${fmt(segment[3].y)}`;
  }
  return d;
};

/** 沿中心线的法线把宽度从根到尖线性收掉，得到一个封闭的锥形实体（§10 的"锥形实体"画法）。 */
const taperedOutlineD = (center: readonly Point[], rootHalf: number, tipHalf: number): string => {
  const left: Point[] = [];
  const right: Point[] = [];
  const last = center.length - 1;
  for (let i = 0; i <= last; i++) {
    // 端点用前向/后向差分，中间点用中心差分（端点处 prev === next 会让法线变成零向量）
    const prev = center[Math.max(0, i - 1)];
    const next = center[Math.min(last, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const norm = Math.hypot(dx, dy) || 1;
    const half = rootHalf + (tipHalf - rootHalf) * (i / last);
    left.push(at(center[i].x - (dy / norm) * half, center[i].y + (dx / norm) * half));
    right.push(at(center[i].x + (dy / norm) * half, center[i].y - (dx / norm) * half));
  }
  const ring = left.concat(right.reverse());
  return `M${ring.map((p, i) => `${i === 0 ? "" : "L"}${fmt(p.x)} ${fmt(p.y)}`).join(" ")}Z`;
};

const TAIL_CENTER = sampleCubics(TAIL_CURVE, TAIL_OUTLINE_SAMPLES);
const TAIL: TailShape = {
  rootX: TAIL_CURVE[0][0].x,
  rootY: TAIL_CURVE[0][0].y,
  lengthPx: 408,
  pathD: pathDFrom(TAIL_CURVE),
  outlineD: taperedOutlineD(TAIL_CENTER, TAIL_ROOT_HALF, TAIL_TIP_HALF),
};

// ── 对外契约（DESIGN §3.5 的三个导出名，一个不改）──────────────────────────────────────────
export const CAT_GEOMETRY = {
  head: HEAD,
  ears: EARS,
  eyeWhites: EYE_WHITES,
  pupils: PUPILS,
  eyelids: EYELIDS,
  /** 眼皮从 `scaleY(0)` 到 `scaleY(1)` 覆盖的垂直距离 = 眼白全高（2×ry）——眨眼才盖得住整只眼。 */
  eyelidTravelPx: EYE_RY * 2,
  torso: TORSO,
  legs: LEGS,
  /** 呼吸的 `transform-origin` y = 腹部底端（SCOPE §7：躯干组缩放基准在腹部底端）。 */
  torsoOriginY: TORSO.bottomY,
  tail: TAIL,
};

/** 描边可见半宽（设计坐标）：`stroke-width` 4 有一半被填充盖住，所以只多出 2。 */
const RIM_HALF = 2;

/** 设计坐标 → CSS px（只做比例换算；外扩各形状自己加）。 */
const css = (design: number): number => design * DESIGN_TO_CSS;

/** 顶点沿"顶点 → 重心"方向外扩 `by`（设计坐标）：描边有一半画在填充之外，不扩就漏一条边。 */
const dilateTriangle = (t: EarShape, by: number): { a: Point; b: Point; c: Point } => {
  const v = [t.tip, t.outer, t.inner];
  const centroid = at((v[0].x + v[1].x + v[2].x) / 3, (v[0].y + v[1].y + v[2].y) / 3);
  const out = v.map((p) => {
    const dx = p.x - centroid.x;
    const dy = p.y - centroid.y;
    const len = Math.hypot(dx, dy) || 1;
    return at(p.x + (dx / len) * by, p.y + (dy / len) * by);
  });
  return { a: out[0], b: out[1], c: out[2] };
};

/** 设计坐标的外接矩形 → **向外取整**的 CSS px 矩形盒（躯干与尾段用）。 */
const rectBox = (x0: number, y0: number, x1: number, y1: number): Bounds => {
  const left = Math.floor(x0 * DESIGN_TO_CSS);
  const top = Math.floor(y0 * DESIGN_TO_CSS);
  // 向外取整：只许多盖、不许漏盖（漏一条边 = 猫身上有像素不响应拖拽）
  return {
    shape: "rect",
    x: left,
    y: top,
    width: Math.ceil(x1 * DESIGN_TO_CSS) - left,
    height: Math.ceil(y1 * DESIGN_TO_CSS) - top,
  };
};

/**
 * 尾巴的命中盒：尾巴不是一根直棍（它贴着右边缘兜回来），一个大盒会把"尾巴弯里那块透明区"
 * 整块吃掉 → 沿中心线切成 6 段、每段一个小盒。
 */
const tailBoxes = (): Bounds[] => {
  const out: Bounds[] = [];
  const slices = 6;
  const last = TAIL_CENTER.length - 1;
  for (let i = 0; i < slices; i++) {
    const from = Math.floor((i * last) / slices);
    const to = Math.floor(((i + 1) * last) / slices);
    const slice = TAIL_CENTER.slice(from, to + 1);
    // 用段**起点**的半宽（尾巴越往上越细）→ 取到该段里最宽的那一档，宁可多盖
    const half = TAIL_ROOT_HALF + (TAIL_TIP_HALF - TAIL_ROOT_HALF) * (from / last) + RIM_HALF;
    out.push(
      rectBox(
        Math.min(...slice.map((p) => p.x)) - half,
        Math.min(...slice.map((p) => p.y)) - half,
        Math.max(...slice.map((p) => p.x)) + half,
        Math.max(...slice.map((p) => p.y)) + half,
      ),
    );
  }
  return out;
};

/**
 * 猫身的命中形状（批次 4 的 `isOverCharacter` 消费；批次 5 按 4-2 的 R-01 改成**精确形状**）：
 * 头 1 个椭圆 + 耳 2 个三角形 + 躯干 1 个矩形 + 尾 6 个矩形 = **10 个**。
 *
 * 为什么不是"头含耳一个大矩形"：第一版就是那么写的（`x 48..212 / y 19..189`），实测死区
 * **7740 CSS px² = 窗口面积 9.9%**——头顶上方那条带、两耳之间的空隙、椭圆四角全都什么都没画，
 * 落在它们上面既点不到背后的桌面图标、也拖不动猫（SCOPE §5 M6 的用户故事在那片像素上不成立），
 * 而旧探针的四个取样点全在盒外，拦不住。头与耳**本来就是精确几何体**（一个椭圆 + 两个三角形），
 * 把它们退化成矩形是白丢精度；躯干与尾段仍用矩形——那两块盒内基本是实心的（尾巴那 6 段就是为此切的）。
 * 每个形状都向外扩 `RIM_HALF`：描边有一半画在填充之外，不扩就漏一圈约 1.6 CSS px 的边缘。
 * 三个部件各自成函数是为了守住 D14① 的函数 ≤50 行——改形状时本函数一度涨到 75 行。
 */
export function characterBounds(): Bounds[] {
  const rim = css(RIM_HALF);
  const head: Bounds = {
    shape: "ellipse",
    cx: css(HEAD.cx),
    cy: css(HEAD.cy),
    rx: css(HEAD.rx) + rim,
    ry: css(HEAD.ry) + rim,
  };
  const ears = EARS.map((e): Bounds => {
    const t = dilateTriangle(e, RIM_HALF);
    return {
      shape: "triangle",
      a: at(css(t.a.x), css(t.a.y)),
      b: at(css(t.b.x), css(t.b.y)),
      c: at(css(t.c.x), css(t.c.y)),
    };
  });
  return [
    head,
    ...ears,
    rectBox(
      HEAD.cx - TORSO.bottomHalfWidth,
      TORSO.topY,
      HEAD.cx + TORSO.bottomHalfWidth,
      TORSO.bottomY,
    ),
    ...tailBoxes(),
  ];
}
