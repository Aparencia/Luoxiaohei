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
 * 命中形状（单位 CSS px）——**既不是一个矩形，也不只是填充**。
 *
 * 两类：头是椭圆（半径各加描边半宽）；其余部件是**渲染用的那条真实轮廓**（`polygon.points`）
 * 加上描边带（`polygon.rim` = 描边半宽）。为什么"填充内部 ∪ 描边带"就是画出来的那些像素：
 * `heicat.css` 给尾巴 / 耳 / 躯干 / 头统一 `stroke-width: 4` + `stroke-linejoin: round`，
 * 圆角连接下描边区域恰好 = 到轮廓边界距离 ≤ 2 设计 px 的那一圈。
 *
 * 两轮教训都是实测：4-2 的 R-01 —— 「头含耳一个大矩形」死区 7740 CSS px² = 窗口 9.9%；
 * 4-2 第 2 轮的 R-12 —— 只换头耳、躯干与尾段仍是外接矩形，死区只降到 7.12%（真渲染口径）。
 * 矩形是外接框，框里没画到的像素会被吃住，所以这一版**不留任何矩形**。判定住在 `hitTest.ts`。
 */
export type Bounds =
  | { shape: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { shape: "polygon"; points: Point[]; rim: number };
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

// ── 轮廓小工具（设计坐标系；§4 的"单一事实源"靠它们落地）──────────────────────────────────
type Cubic = readonly [Point, Point, Point, Point];
/** 轮廓的一段（绝对坐标）：直线 / 二次贝塞尔 / 三次贝塞尔。 */
type Seg =
  | { kind: "L"; to: Point }
  | { kind: "Q"; c: Point; to: Point }
  | { kind: "C"; c1: Point; c2: Point; to: Point };

const pointAt = ([p0, p1, p2, p3]: Cubic, t: number): Point => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};

const pointOnQuad = (p0: Point, c: Point, p1: Point, t: number): Point => {
  const u = 1 - t;
  return at(u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, u * u * p0.y + 2 * u * t * c.y + t * t * p1.y);
};

/** 段序列 → 环（不含闭合点，`Z` 由使用方补）；每条曲线采 `per` 个点，段间接点只留一份。 */
const sampleSegs = (start: Point, segs: readonly Seg[], per: number): Point[] => {
  const pts: Point[] = [start];
  let cur = start;
  for (const seg of segs) {
    if (seg.kind === "L") {
      pts.push(seg.to);
      cur = seg.to;
      continue;
    }
    for (let k = 1; k <= per; k++) {
      const t = k / per;
      pts.push(
        seg.kind === "Q" ? pointOnQuad(cur, seg.c, seg.to, t) : pointAt([cur, seg.c1, seg.c2, seg.to], t),
      );
    }
    cur = seg.to;
  }
  return pts;
};

/**
 * 环上的点按 1 位小数**定死**——`pathD` 写下的与命中环用的是同一批数字。
 * 不这样做的后果是可量化的：渲染按 `fmt` 取整、命中按全精度算，两边界能差 0.05 设计 px，
 * 于是"画出来的像素必须命中"这条断言会在边界上随机红（4-2 第 2 轮的 R-14 就是这么暴露的）。
 */
const roundRing = (pts: Point[]): Point[] => pts.map((p) => at(round1(p.x), round1(p.y)));

/** 闭合折线 → `d`（全绝对 `L`）：渲染出来的就是这条折线本身，不再有第二份曲线真值。 */
const ringToPathD = (ring: Point[]): string =>
  `M${ring.map((p, i) => `${i === 0 ? "" : "L"}${fmt(p.x)} ${fmt(p.y)}`).join(" ")}Z`;

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
 * 躯干轮廓（结构化段 → 现算 `pathD` 与命中环，§4 的"单一事实源"）。
 *
 * 为什么不再是一条手写 `d` 字符串（4-2 第 2 轮的 R-12）：命中要求"命中的就是画出来的"，
 * 而"画出来的"只能有一份真值。从前 `pathD` 是字符串、命中盒是另算的矩形，两者必然漂移——
 * 矩形死区实测占窗口 7.12%（真渲染口径）。现在曲线先按 `TORSO_SAMPLES` **折线化**，
 * 折线化的结果既是渲染的 `d`、也是命中环，逐点同一。
 * 16 点/曲线的弦长约 9 设计 px、矢高 ≈0.05 设计 px（= 0.04 CSS px）：肉眼与渲染都看不出来。
 *
 * 顶边 y=150 藏在头部椭圆里（M3·⑥ 的"无颈"判据 = 两个顶角都满足椭圆方程 < 1），
 * 段序列的终点 (210,150) 与起点 (110,150) 之间的闭合线就是那条顶边。
 * 头身比的抓手：躯干高 = 352 − 150 = 202，头高 = 2×92 = 184 → 202 ÷ 184 = 1.098 ≈ 1:1.1。
 */
const TORSO_START = at(110, 150);
const TORSO_SAMPLES = 16;
const TORSO_SEGS: readonly Seg[] = [
  // 底角用二次贝塞尔收圆：起点切线竖直、终点切线水平 → 与侧边、底边都平滑相接
  { kind: "C", c1: at(96, 200), c2: at(86, 268), to: at(86, 336) },
  { kind: "Q", c: at(86, 352), to: at(100, 352) },
  { kind: "L", to: at(220, 352) },
  { kind: "Q", c: at(234, 352), to: at(234, 336) },
  { kind: "C", c1: at(234, 268), c2: at(224, 200), to: at(210, 150) },
];
const TORSO_RING = roundRing(sampleSegs(TORSO_START, TORSO_SEGS, TORSO_SAMPLES));
const TORSO: TorsoShape = {
  topY: TORSO_START.y,
  topHalfWidth: 50,
  bottomY: 352,
  bottomHalfWidth: 74,
  pathD: ringToPathD(TORSO_RING),
};
const LEGS: [{ pathD: string }, { pathD: string }] = [
  // 脚底 = 330 + 0.75×18 = 343.5（§10 写"y→344"）：普通三次贝塞尔在 t=0.5 处只走到控制点高度的 3/4
  { pathD: "M116 262 L154 262 L154 330 C154 348 116 348 116 330 Z" },
  { pathD: "M166 262 L204 262 L204 330 C204 348 166 348 166 330 Z" },
];

// ── 尾巴（§10：根部宽 30 → 尖端宽 10、自身体右下向右上兜回、目标弧长 408）────────────────────
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
const taperedRing = (center: readonly Point[], rootHalf: number, tipHalf: number): Point[] => {
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
  return left.concat(right.reverse());
};

const TAIL_CENTER = sampleCubics(TAIL_CURVE, TAIL_OUTLINE_SAMPLES);
/** 环上的点与 `outlineD` 写下的是同一批数字（`roundRing`）→ 渲染的轮廓就是命中环（R-12）。 */
const TAIL_RING = roundRing(taperedRing(TAIL_CENTER, TAIL_ROOT_HALF, TAIL_TIP_HALF));
const TAIL: TailShape = {
  rootX: TAIL_CURVE[0][0].x,
  rootY: TAIL_CURVE[0][0].y,
  lengthPx: 408,
  pathD: pathDFrom(TAIL_CURVE),
  outlineD: ringToPathD(TAIL_RING),
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

/** 尾根（设计坐标）：尾巴绕它摆 ±8°（`heicat.css` 的 `tailSway` + `HeiCat.tsx` 内联的 `transform-origin`）。 */
const TAIL_PIVOT = at(TAIL.rootX, TAIL.rootY);

/** 甩尾的周期与幅度 —— 取值由 `hitTest.test.ts` 的 M6·⑨ 逐项绑到 `heicat.css` 的 `tailSway` 上。 */
export const TAIL_SWAY_MS = 2400;
export const TAIL_SWAY_DEG = 8;
/** `animation` 的时序函数（`cubic-bezier(0.2, 0, 0, 1)`）：CSS 动画把它作用在**每一段**关键帧上。 */
export const TAIL_SWAY_EASING: readonly [number, number, number, number] = [0.2, 0, 0, 1];
/** 关键帧停点：[周期占比, 角度]。0% → 0°、25% → −8°、75% → +8°、100% → 0°（首末中性，`reduce` 播完不跳变）。 */
const SWAY_STOPS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.25, -TAIL_SWAY_DEG],
  [0.75, TAIL_SWAY_DEG],
  [1, 0],
];

/** 解 `cubic-bezier(x1,y1,x2,y2)`：给定 x∈[0,1] 二分求参数 t 再取 y。20 次二分误差 <1e-6。 */
const bezierAt = (x: number, [x1, y1, x2, y2]: readonly [number, number, number, number]): number => {
  // 端点短路：二分只能收敛到 2.7e-13 这种量级，而关键帧**停点上的取值必须是精确的**
  // （M6·⑨ 要断言 25% 恰好 = −8°）。两端本来就是精确值 y(0)=0 / y(1)=1。
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const curveX = (t: number): number => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const curveY = (t: number): number => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (curveX(mid) < x) lo = mid;
    else hi = mid;
  }
  return curveY((lo + hi) / 2);
};

/**
 * 尾巴在**动画时间轴**上的相位 → 摆动角（度）。纯函数，入参是 `.hei-tail` 那条 CSS 动画自己的
 * `currentTime`（毫秒），不是 `performance.now()`——用动画的时钟才不会与屏幕上的猫错开。
 *
 * 为什么是"读动画时钟 + 自己映射"而不是直接读渲染值（4-2 第 2 轮实测，探针在 `%TEMP%\r3-pixels`）：
 * 在这套 Chromium 上，**合成器动画**的当前值读不出来——`getComputedStyle(el).transform` 恒为
 * `none`、Typed OM 同样、`getBoundingClientRect()` 不随动画变；只有 Web Animations API 的
 * `currentTime` 在走（实测 200.026 → 400.018 → 600.01 → 800.002）。所以相位只能"取时间、自己映射"。
 *
 * 为什么这张映射表不算第二份真相（D12）：它没有独立取值——`hitTest.test.ts` 的 M6·⑨ 直接解析
 * `heicat.css` 的 `tailSway`，把周期 / 四个停点 / 角度 / 缓动逐项与本文件的常量对齐；
 * CSS 改了而这里没跟上，那条用例立刻红。
 */
export function tailSwayAngleAt(currentTimeMs: number): number {
  if (!Number.isFinite(currentTimeMs)) return 0;
  const phase = (((currentTimeMs % TAIL_SWAY_MS) + TAIL_SWAY_MS) % TAIL_SWAY_MS) / TAIL_SWAY_MS;
  for (let i = 1; i < SWAY_STOPS.length; i++) {
    const [endOffset, endAngle] = SWAY_STOPS[i];
    if (phase > endOffset) continue;
    const [startOffset, startAngle] = SWAY_STOPS[i - 1];
    const span = endOffset - startOffset;
    const local = span === 0 ? 1 : (phase - startOffset) / span;
    const angle = startAngle + (endAngle - startAngle) * bezierAt(local, TAIL_SWAY_EASING);
    // `0 × (−8)` 会得到 **−0**：它 `=== 0` 成立，却让 `assert.strictEqual(…, 0)`（SameValue）红。
    // 归一掉，免得调用方多出一种"等于 0 但不等于 0"的取值。
    return angle === 0 ? 0 : angle;
  }
  return 0;
}

/** 绕枢轴旋转（设计坐标）。非有限角度按 0 算——U3 的"禁 NaN 几何"在命中层同样成立。 */
const rotateAbout = (p: Point, pivot: Point, deg: number): Point => {
  if (!Number.isFinite(deg) || deg === 0) return p;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return at(pivot.x + dx * cos - dy * sin, pivot.y + dx * sin + dy * cos);
};

/** 尾巴上离尾根最远的距离（CSS px，含描边）——旋转保距，所以它同时也是**任意摆角**下的上界。 */
const TAIL_REACH_PX = css(
  Math.max(...TAIL_RING.map((p) => Math.hypot(p.x - TAIL_PIVOT.x, p.y - TAIL_PIVOT.y))) + RIM_HALF,
);

/**
 * 点是否**可能**落在尾巴上（CSS px）——用来决定"这一拍要不要去问 DOM 要动画相位"（R-13 的开销闸）。
 * 判据是严格的：落在圈外的点按 0° 处理也不会误判，于是绝大多数帧一次 `getComputedStyle` 都不发
 * ——空闲时每帧读一次动画属性会把合成器动画拉回主线程，正是 NFR P1（空闲 CPU ≤1%）要防的事。
 */
export const mayBeOnTail = (viewport: Point): boolean => {
  const dx = viewport.x - css(TAIL_PIVOT.x);
  const dy = viewport.y - css(TAIL_PIVOT.y);
  return dx * dx + dy * dy <= TAIL_REACH_PX * TAIL_REACH_PX;
};

/**
 * 猫身的命中形状（批次 4 的 `isOverCharacter` 消费；批次 5 按 R-01 换形状，本批按 R-12 去矩形）：
 * 头 1 个椭圆 + 耳 2 个三角形 + 躯干 1 条轮廓 + 尾 1 条轮廓 = **5 个**。
 *
 * 三个"为什么不"（都是量出来的，不是审美）：
 * - **为什么不合并成一个外接矩形**：第一版就是那么写的（`x 48..212 / y 19..189`），实测死区
 *   **7740 CSS px² = 窗口 9.9%**——头顶那条带、两耳之间的空隙、椭圆四角什么都没画却吃住点击。
 * - **为什么躯干/尾段也不能用矩形**：4-2 第 2 轮的 R-12。矩形是外接框，尾巴又是一条贴着右边缘
 *   兜回来的曲线——"弯里那块透明区"整块被吃掉。当时切成 6 段小盒只是把 9.9% 压到 **7.12%**
 *   （真渲染口径 5553 px），因为盒内大多是空的。现在直接用渲染的那条轮廓。
 * - **为什么每个形状都要带 `rim`**：描边有一半画在填充之外（`stroke-width: 4` → 2 设计 px），
 *   不带就是"看得见的边拖不动"（R-14 实测漏盖 256 px²，其中耳缘一圈约 1 CSS px 宽）。
 *
 * `tailRotationDeg` = 尾巴**当前**的摆动角（度，设计坐标下绕尾根）。命中环必须跟着动画转（R-13）：
 * 静态模型的尾巴在 ±8° 两端时，有 1.48%~3.30% 的窗口面积"画出来了却判成透明"（点上去穿到桌面）。
 * 这个入参是**纯入参**——真值由 `usePointerPassthrough` 每拍问 DOM 要（`mayBeOnTail` 先判要不要问），
 * 这里不碰任何全局。
 *
 * 呼吸（`#body` 的 `scaleY(1.03)`）不必建模：躯干顶边 y=150 被抬起 6.06 设计 px 后仍在头部椭圆内
 * （头后画、盖住那段），侧边只沿 y 缩放不改 x ⇒ 画出来的轮廓与静态命中环重合。
 * 三个部件各自成函数是为了守住 D14① 的函数 ≤50 行——改形状时本函数一度涨到 75 行。
 */
export function characterBounds(tailRotationDeg = 0): Bounds[] {
  const rim = css(RIM_HALF);
  const head: Bounds = {
    shape: "ellipse",
    cx: css(HEAD.cx),
    cy: css(HEAD.cy),
    rx: css(HEAD.rx) + rim,
    ry: css(HEAD.ry) + rim,
  };
  /** 设计坐标的环 → CSS px 的多边形（`rim` 一并带走：描边带是命中区域的一半）。 */
  const ring = (design: Point[]): Bounds => ({
    shape: "polygon",
    points: design.map((p) => at(css(p.x), css(p.y))),
    rim,
  });
  const tailRing = TAIL_RING.map((p) => rotateAbout(p, TAIL_PIVOT, tailRotationDeg));
  return [
    head,
    ...EARS.map((e) => ring([e.tip, e.outer, e.inner])),
    ring(TORSO_RING),
    ring(tailRing),
  ];
}
