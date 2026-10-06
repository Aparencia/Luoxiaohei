// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 2 ｜ 载体：SCOPE §5 M3 的验收命令（TESTPLAN KP-04 的六条）
//
// 为什么路径采样器写在测试里、不 import 生产代码的那一份：M3 的判据原文是"尾长（`tail.pathD`
// **采样出的弧长**）"——采样器住在测试里，断言的才是 `pathD` 这个字符串本身；用生产侧的采样器
// 等于让被测物给自己打分（同义反复，TESTPLAN §7 点名的反模式）。
// 采样器只认绝对 M / L / C / Z（生产侧只产出这四种）；见到别的命令直接抛——防"悄悄少算一段"。
//
// 白色断言为什么按**字面量**数（`fill="#FFFFFF"` 恰好 2 处）而不是按渲染后的元素：
// 口径写死在 `docs/DESIGN_TOKENS.md` §1 的 50 档（"按元素计数不按像素区域计数"，TESTPLAN KP-04）。
// 因此眼白是**唯一**把色值写在 TSX 里的地方，本文件据此要求 TSX 里除这 2 处外零色彩字面量。
/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CAT_GEOMETRY, VIEW_BOX, characterBounds } from "./geometry.ts";

const root = new URL("../../", import.meta.url);
const readText = (rel: string) => readFileSync(new URL(rel, root), "utf8");
const HICAT = "src/character/HeiCat.tsx";
const HEICAT_CSS = "src/character/heicat.css";
const WINDOW = (
  JSON.parse(readText("src-tauri/tauri.conf.json")) as {
    app: { windows: Array<{ width: number; height: number }> };
  }
).app.windows[0];

type Pt = { x: number; y: number };

function samplePath(d: string, perSegment = 400): Pt[] {
  const tokens = d.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g) ?? [];
  const pts: Pt[] = [];
  let cur: Pt = { x: 0, y: 0 };
  let i = 0;
  const num = (): number => Number(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "M" || cmd === "L") {
      cur = { x: num(), y: num() };
      pts.push(cur);
      continue;
    }
    if (cmd === "Z") continue;
    if (cmd !== "C") throw new Error(`采样器只认绝对 M/L/C/Z，收到 "${cmd}"`);
    const p0 = cur;
    const p1 = { x: num(), y: num() };
    const p2 = { x: num(), y: num() };
    const p3 = { x: num(), y: num() };
    for (let k = 1; k <= perSegment; k++) {
      const t = k / perSegment;
      const u = 1 - t;
      pts.push({
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      });
    }
    cur = p3;
  }
  return pts;
}

const polylineLength = (pts: Pt[]): number =>
  pts.reduce((sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)), 0);

const box = (pts: Pt[]) => ({
  x0: Math.min(...pts.map((p) => p.x)),
  y0: Math.min(...pts.map((p) => p.y)),
  x1: Math.max(...pts.map((p) => p.x)),
  y1: Math.max(...pts.map((p) => p.y)),
});

// WCAG 相对亮度（与 docs/DESIGN_TOKENS.md §4 的门禁同一条公式），用来判"这是不是黑色系"
const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

test("M3·① 两眼外接矩形合并宽 / 头宽 ≥ 0.60（KP-04）", () => {
  const [left, right] = CAT_GEOMETRY.eyeWhites;
  const merged =
    Math.max(left.cx + left.rx, right.cx + right.rx) - Math.min(left.cx - left.rx, right.cx - right.rx);
  const headWidth = CAT_GEOMETRY.head.rx * 2;
  const ratio = merged / headWidth;
  console.log(`M3·① 眼白外接合并宽 ${merged} / 头宽 ${headWidth} = ${ratio.toFixed(2)}（≥0.60）`);
  assert.ok(ratio >= 0.6, `眼白合计仅占头宽 ${ratio.toFixed(2)}，"眼白占全脸 2/3"这条造型基准不成立`);
  // 眼皮的垂直行程 = 眼白全高：两个取值不许各写各的（眼皮盖住整只眼才算"眨眼"）
  assert.equal(
    CAT_GEOMETRY.eyelidTravelPx,
    CAT_GEOMETRY.eyeWhites[0].ry * 2,
    "eyelidTravelPx 必须等于眼白全高（2×ry），否则眨眼盖不住眼睛",
  );
});

test("M3·② 耳距（两耳根中心距）/ 头宽 ≥ 0.55（KP-04）", () => {
  const [left, right] = CAT_GEOMETRY.ears;
  const gap = Math.abs(right.rootX - left.rootX);
  const ratio = gap / (CAT_GEOMETRY.head.rx * 2);
  console.log(`M3·② 耳距 ${gap} / 头宽 ${CAT_GEOMETRY.head.rx * 2} = ${ratio.toFixed(2)}（≥0.55）`);
  assert.ok(ratio >= 0.55, `耳距 ${gap} 相对头宽只有 ${ratio.toFixed(2)}：耳朵并得太拢，认不出罗小黑的圆头圆脑`);
  assert.ok(left.rootX < CAT_GEOMETRY.head.cx && right.rootX > CAT_GEOMETRY.head.cx, "两耳必须分居头心两侧");
});

test("M3·③ 尾长（`tail.pathD` 采样出的弧长）/ 体高 ≥ 1.20（KP-04）", () => {
  const arc = polylineLength(samplePath(CAT_GEOMETRY.tail.pathD));
  const earTipY = Math.min(...CAT_GEOMETRY.ears.map((e) => e.tipY));
  const bodyHeight = CAT_GEOMETRY.torso.bottomY - earTipY;
  const ratio = arc / bodyHeight;
  console.log(`M3·③ 尾弧长 ${arc.toFixed(1)} / 体高 ${bodyHeight} = ${ratio.toFixed(3)}（≥1.20）`);
  assert.ok(
    ratio >= 1.2,
    `尾巴弧长 ${arc.toFixed(1)} 相对体高 ${bodyHeight} 只有 ${ratio.toFixed(3)}：\`pathD\` 的曲线不够长（改 lengthPx 常量不算数）`,
  );
  // 声明的 lengthPx 必须是这条曲线的真实弧长，不能是一个对不上的愿望值
  const drift = Math.abs(arc - CAT_GEOMETRY.tail.lengthPx) / CAT_GEOMETRY.tail.lengthPx;
  assert.ok(
    drift <= 0.02,
    `tail.lengthPx 声明 ${CAT_GEOMETRY.tail.lengthPx}，而 pathD 实测 ${arc.toFixed(1)}（差 ${(drift * 100).toFixed(1)}%）——声明值成了谎言`,
  );
  // 尾巴是唯一可能越出画布的部件（它贴着右边缘走）：轮廓 bbox 必须留在 VIEW_BOX 内
  const [, , vbWidth, vbHeight] = VIEW_BOX.split(" ").map(Number);
  const outline = box(samplePath(CAT_GEOMETRY.tail.outlineD));
  console.log(
    `M3·③ 尾部轮廓 bbox ${outline.x0.toFixed(1)},${outline.y0.toFixed(1)} → ${outline.x1.toFixed(1)},${outline.y1.toFixed(1)}（画布 ${vbWidth}×${vbHeight}）`,
  );
  assert.ok(
    outline.x0 >= 0 && outline.y0 >= 0 && outline.x1 <= vbWidth && outline.y1 <= vbHeight,
    "尾部轮廓越出 viewBox：会被裁掉一段（SCOPE §7 要求底部留 8px 余量）",
  );
});

test("M3·④ 白色只出现在 2 处眼白（冻结断言，按元素计不按像素区域计）", () => {
  const tsx = readText(HICAT);
  const fills = tsx.match(/fill="#FFFFFF"/g) ?? [];
  const hexes = tsx.match(/#[0-9a-fA-F]{6}/g) ?? [];
  console.log(`M3·④ fill="#FFFFFF" ${fills.length} 处；TSX 内色彩字面量共 ${hexes.length} 个`);
  assert.equal(fills.length, 2, `\`fill="#FFFFFF"\` 必须恰好 2 处（两眼白），实测 ${fills.length} 处`);
  assert.deepEqual(
    hexes.map((h) => h.toUpperCase()).filter((h) => h !== "#FFFFFF"),
    [],
    "TSX 里除了那 2 处眼白不许有别的色彩字面量（其余色值只许住在 heicat.css 的 :root，DESIGN_TOKENS §6）",
  );
});

test("M3·⑤ 通体主色为黑：色板里除眼白外无亮色，且三个已删的旧色不复活", () => {
  const css = readText(HEICAT_CSS);
  const palette = [...new Set((css.match(/#[0-9a-fA-F]{6}/g) ?? []).map((h) => h.toUpperCase()))];
  console.log(`M3·⑤ 色板 ${palette.length} 色：${palette.join(" ")}`);
  assert.ok(palette.length >= 5, `色板只有 ${palette.length} 色，这条断言会空转（造型至少有 7 个灰阶）`);
  assert.ok(!palette.includes("#FFFFFF"), "眼白是插画填充、不是基色：它只许住在 TSX 的那 2 处 fill 上");
  for (const hex of palette) {
    const maxChannel = Math.max(...[1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16)));
    assert.ok(maxChannel <= 0x8f, `${hex} 的最大通道 ${maxChannel} > 0x8F：它不是黑猫身上的颜色`);
    assert.ok(luminance(hex) < 0.3, `${hex} 的相对亮度 ${luminance(hex).toFixed(3)} ≥ 0.3：破"通体漆黑"`);
  }
  // 3-5 卡删掉的三色（奶白眼白 / 淡绿内耳 / 蓝灰鼻）不许复活：SCOPE §8 明文纠正过"奶白是错的"
  for (const dead of ["#F4F0DE", "#A6C48A", "#8FA6C4"]) {
    assert.ok(!palette.includes(dead), `${dead} 是 3-5 卡删掉的取值（来源不支持），不许复活`);
    assert.ok(
      !readText(HICAT).toUpperCase().includes(dead),
      `${dead} 出现在 TSX 里：白色断言会从 2 处变 3 处以上`,
    );
  }
});

test("M3·⑥ 头身比 ≈ 1:1.1（无颈）且整体占位在窗口矩形内", () => {
  const headHeight = CAT_GEOMETRY.head.ry * 2;
  const torsoHeight = CAT_GEOMETRY.torso.bottomY - CAT_GEOMETRY.torso.topY;
  const ratio = torsoHeight / headHeight;
  console.log(`M3·⑥ 躯干高 ${torsoHeight} / 头高 ${headHeight} = 1:${ratio.toFixed(2)}（目标 1:1.1）`);
  assert.ok(
    Math.abs(ratio - 1.1) <= 0.05,
    `头身比 1:${ratio.toFixed(2)} 偏离基准 1:1.1 超过 5%（SCOPE §8 的"圆头圆脑，无颈"）`,
  );
  // "无颈"的机器面 = 躯干顶边的两个角都埋在头部椭圆里（没有露出来的脖子段）
  for (const x of [
    CAT_GEOMETRY.head.cx - CAT_GEOMETRY.torso.topHalfWidth,
    CAT_GEOMETRY.head.cx + CAT_GEOMETRY.torso.topHalfWidth,
  ]) {
    const nx = (x - CAT_GEOMETRY.head.cx) / CAT_GEOMETRY.head.rx;
    const ny = (CAT_GEOMETRY.torso.topY - CAT_GEOMETRY.head.cy) / CAT_GEOMETRY.head.ry;
    assert.ok(nx * nx + ny * ny < 1, `躯干顶角 (${x}, ${CAT_GEOMETRY.torso.topY}) 露在头外 → 出现了脖子`);
  }
  // 占位：characterBounds() 已经把设计坐标换算成 CSS px（×0.8125）——换算丢了这条就红
  const boxes = characterBounds();
  console.log(
    `M3·⑥ 粗筛盒 ${boxes.length} 个，最大右下角 ${Math.max(...boxes.map((b) => b.x + b.width)).toFixed(1)},${Math.max(...boxes.map((b) => b.y + b.height)).toFixed(1)}（窗口 ${WINDOW.width}×${WINDOW.height}）`,
  );
  assert.ok(boxes.length >= 5, "粗筛盒少于 5 个：头/躯干/尾段凑不出来（批次 4 的命中判定会过粗）");
  for (const b of boxes) {
    assert.ok(
      b.x >= 0 && b.y >= 0 && b.x + b.width <= WINDOW.width && b.y + b.height <= WINDOW.height,
      `粗筛盒 ${JSON.stringify(b)} 越出窗口 ${WINDOW.width}×${WINDOW.height}：设计坐标没换算成 CSS px，或角色真的超出了窗口`,
    );
  }
});
