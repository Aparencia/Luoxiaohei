// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 3 ｜ 载体：SCOPE §5 M4 的验收命令（TESTPLAN KP-05 / KP-06）
//
// 为什么解析 `heicat.css` 的**文本**而不是 `getComputedStyle`：判据原文就是"解析 `heicat.css` 文本断言"，
// 而且 Node 里没有布局引擎——这份样式的唯一事实源就是文本本身（TESTPLAN §7 的接缝约定：
// `heicat.css` 不替换、也不许在测试里内联一份"期望副本"，内联副本 = 改坏真文件测试照样绿）。
//
// 四类断言各自"改哪一行生产代码会让它红"：周期 ← `animation` 简写里的时长；幅度 ← `@keyframes` 里的
// `scaleY/rotate` 取值；不同步 ← 三处时长互不相同；合成层 ← 关键帧里出现的属性名。
//
// 为什么解析前先去掉注释：注释不是 CSS——被注释掉的声明本来就不生效，所以"去掉注释再解析"比"带着注释解析"
// **更**贴近判据。反过来做会踩同一个坑：`heicat.css` 的注释里提到了 `#body` 与 `@keyframes blink`
// 这两个名字，带注释解析时它们会把结构解析带偏（4-1 批次 3 实测：`#body` 的 animation 声明解析不出来、
// `blink` 的关键帧被算成 0 帧）。风险摘要 ㊶/㊸ 记的是**字面量计数**类判据（那里必须改措辞，因为判据
// 就是"这个词出现几次"）；本条是**结构解析**类，正确处理是让解析器忽略注释，而不是让注释回避关键词。
/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CSS = readFileSync(new URL("./heicat.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ");
const HICAT = readFileSync(new URL("./HeiCat.tsx", import.meta.url), "utf8");

/** 花括号配平：从 `from` 之后第一个 `{` 开始，返回块体（不含最外层括号）。 */
function braced(text: string, from: number): string {
  const open = text.indexOf("{", from);
  assert.ok(open >= 0, "找不到块起始 `{`");
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error("heicat.css 的花括号不配平");
}

function mediaBlock(query: string): string {
  const at = CSS.indexOf(`@media (${query})`);
  assert.ok(at >= 0, `heicat.css 里没有 @media (${query})`);
  return braced(CSS, at);
}

/** 某个选择器的全部声明（同一个选择器可能分散在多条规则里，全部并起来）。 */
function declarations(selector: string): string {
  const out: string[] = [];
  for (const rule of CSS.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    if (rule[1].split(",").map((s) => s.trim()).includes(selector)) out.push(rule[2]);
  }
  return out.join("\n");
}

type Animation = { name: string; ms: number; easing: string; iteration: string };

/** 解析 `animation` 简写四段（名字 时长 缓动 次数）——顺序即 MOTION §2 给出的写法。 */
function animationOf(selector: string): Animation {
  const decl = /animation:\s*([A-Za-z]+)\s+(\d+(?:\.\d+)?)ms\s+(cubic-bezier\([^)]*\))\s+([A-Za-z]+)/.exec(
    declarations(selector),
  );
  assert.ok(decl, `${selector} 上没有可解析的四段 animation 简写`);
  return { name: decl[1], ms: Number(decl[2]), easing: decl[3], iteration: decl[4] };
}

type Frame = { pct: number; body: string };

function keyframes(name: string): Frame[] {
  const at = CSS.indexOf(`@keyframes ${name}`);
  assert.ok(at >= 0, `heicat.css 里没有 @keyframes ${name}`);
  const frames = [...braced(CSS, at).matchAll(/([\d.]+)%\s*\{([^}]*)\}/g)].map((m) => ({
    pct: Number(m[1]),
    body: m[2],
  }));
  assert.ok(frames.length >= 3, `@keyframes ${name} 只有 ${frames.length} 帧（呼吸/眨眼/甩尾都是往返，至少 3 帧）`);
  return frames;
}

const frameAt = (frames: Frame[], pct: number): Frame => {
  const hit = frames.find((f) => f.pct === pct);
  assert.ok(hit, `@keyframes 缺 ${pct}% 帧`);
  return hit;
};

const scaleY = (frame: Frame): number => {
  const m = /scaleY\(([-\d.]+)\)/.exec(frame.body);
  assert.ok(m, `${frame.pct}% 帧上没有 scaleY`);
  return Number(m[1]);
};

const rotate = (frame: Frame): number => {
  const m = /rotate\(([-\d.]+)deg\)/.exec(frame.body);
  assert.ok(m, `${frame.pct}% 帧上没有 rotate`);
  return Number(m[1]);
};

test("M4·① 呼吸周期 3.2s ± 0.2，幅度 1.00 → 1.03 → 1.00（KP-05）", () => {
  const anim = animationOf("#body");
  const frames = keyframes("breathe");
  const values = frames.map((f) => scaleY(f));
  console.log(
    `M4·① #body：${anim.name} ${anim.ms}ms ${anim.easing} ${anim.iteration}｜倍率 ${frames.map((f, i) => `${f.pct}%:${values[i]}`).join(" → ")}`,
  );
  assert.equal(anim.name, "breathe");
  assert.equal(anim.iteration, "infinite", "三条 idle 动画都是常驻循环（MOTION §10 的豁免裁决）");
  assert.equal(anim.easing, "cubic-bezier(0.2, 0, 0, 1)", "缓动只许用 MOTION §3 的标准曲线");
  assert.ok(Math.abs(anim.ms - 3200) <= 200, `呼吸周期 ${anim.ms}ms 偏离 3.2s ± 0.2`);
  assert.deepEqual(frames.map((f) => f.pct), [0, 50, 100], "呼吸的关键帧是 0% / 50% / 100%");
  assert.deepEqual(values, [1, 1.03, 1], "幅度必须是 1.00 → 1.03 → 1.00");
  // 首末帧 = 静态姿态：reduce 分支用 iteration-count:1 播一次就落回基础样式，首末不中性会跳变（MOTION §2 注）
  assert.equal(values[2], values[0], "末帧必须回到首帧");
  // 缩放基准在腹部底端（SCOPE §7）：取值来自 geometry.ts，不许在 TSX 里另写一个数
  assert.ok(
    HICAT.includes("${g.torsoOriginY}px"),
    "呼吸的 transform-origin 必须绑在 geometry 的 torsoOriginY 上，否则躯干会整体飘",
  );
});

test("M4·② 眨眼：单次 ≤ 100ms、闭合 ≤ 80ms；静态姿态与 reduce 分支都把眼睑钉在 scaleY(0)（KP-05）", () => {
  const anim = animationOf(".hei-eyelid");
  const frames = keyframes("blink");
  const closing = frames.filter((f) => scaleY(f) === 1);
  assert.equal(closing.length, 1, `闭合到位（scaleY(1)）的帧必须恰好一帧，实测 ${closing.length} 帧`);
  const singleMs = (Math.max(...frames.filter((f) => f.pct < 100).map((f) => f.pct)) / 100) * anim.ms;
  const closureMs = (closing[0].pct / 100) * anim.ms;
  console.log(
    `M4·② .hei-eyelid：${anim.name} ${anim.ms}ms｜闭合帧 ${closing[0].pct}% = ${closureMs}ms｜单次（0%→${Math.max(...frames.filter((f) => f.pct < 100).map((f) => f.pct))}%）= ${singleMs}ms｜倍率 ${frames.map((f) => `${f.pct}%:${scaleY(f)}`).join(" → ")}`,
  );
  assert.equal(anim.name, "blink");
  assert.equal(anim.ms, 4000, "眨眼周期 4000ms：100ms 的往返寄生在这 4s 里（MOTION §2 的推导式）");
  assert.ok(singleMs <= 100, `单次眨眼 ${singleMs}ms > 100ms（SCOPE §5 M4 的上界）`);
  assert.ok(closureMs <= 80, `闭合用了 ${closureMs}ms > 80ms（SCOPE §5 M4 的人工判据）`);
  assert.equal(scaleY(frameAt(frames, 0)), 0, "平台段必须是睁眼（scaleY(0)）");
  assert.equal(scaleY(frameAt(frames, 100)), 0, "末帧必须回到睁眼");
  // 静态姿态（不可见）= 关键帧首末帧，两者不一致时 reduce 分支播完会留一只闭着的眼
  assert.match(declarations(".hei-eyelid"), /transform:\s*scaleY\(0\)/, "眼睑的静态姿态必须是 scaleY(0)");
  // reduce 分支：眼睑的静态姿态是 scaleY(0)，**不是 none**。
  // MOTION §8 的卡内模板原文写的是 `.eyelid { transform: none !important }`——照抄到本项目，
  // 眼睑会铺满整只眼 ⇒ 系统"减少动效"下永远看到一只闭着眼的猫（本批实测发现，口径已修进 MOTION §8）。
  const reduce = mediaBlock("prefers-reduced-motion: reduce");
  assert.match(
    reduce,
    /\.hei-eyelid\s*\{\s*transform:\s*scaleY\(0\)\s*!important/,
    "reduce 分支必须把眼睑钉在 scaleY(0)（它的静态姿态），否则 reduce 用户看到的是永久闭眼",
  );
  assert.ok(
    !/#body\s*,\s*\.hei-eyelid[^{]*\{[^}]*none/.test(reduce),
    "reduce 分支不许把眼睑写进 transform:none 那条规则",
  );
});

test("M4·③ 甩尾周期 2.4s ± 0.2（KP-05）", () => {
  const anim = animationOf(".hei-tail");
  const frames = keyframes("tailSway");
  console.log(
    `M4·③ .hei-tail：${anim.name} ${anim.ms}ms ${anim.easing}｜关键帧 ${frames.map((f) => f.pct + "%").join(" → ")}`,
  );
  assert.equal(anim.name, "tailSway");
  assert.ok(Math.abs(anim.ms - 2400) <= 200, `甩尾周期 ${anim.ms}ms 偏离 2.4s ± 0.2`);
  assert.deepEqual(frames.map((f) => f.pct), [0, 25, 75, 100], "甩尾的关键帧是 0% / 25% / 75% / 100%");
});

test("M4·④ 尾摆幅度 ±8° ± 1°、左右对称，且枢轴绑在尾根（KP-05）", () => {
  const frames = keyframes("tailSway");
  const degrees = frames.map((f) => rotate(f));
  const peak = Math.max(...degrees.map(Math.abs));
  console.log(
    `M4·④ 摆幅 ${degrees.map((d, i) => `${frames[i].pct}%:${d}°`).join(" → ")}｜峰值 ${peak}°（±8°±1°）`,
  );
  assert.ok(Math.abs(peak - 8) <= 1, `摆幅峰值 ${peak}° 偏离 ±8° ± 1°`);
  assert.equal(degrees[0], 0, "首帧必须中性 0°");
  assert.equal(degrees[degrees.length - 1], 0, "末帧必须中性 0°（reduce 下播一次要落回静止）");
  assert.ok(Math.min(...degrees) < 0 && Math.max(...degrees) > 0, "必须两边都摆：单侧 = 卷尾，不是甩尾");
  // 旋转的枢轴必须是尾根（geometry.ts 的 tail.rootX / tail.rootY）：
  // 枢轴落在画布原点的话，±8° 会把整条尾巴甩出 320×360 的画布（M3·③ 已冻结轮廓不出画布）
  assert.match(
    HICAT,
    /transformOrigin:\s*`\$\{g\.tail\.rootX\}px \$\{g\.tail\.rootY\}px`/,
    "尾巴的 transform-origin 必须是尾根，且取值只能来自 geometry.ts",
  );
});

test("M4·⑤ 三组周期两两不相等，最小公倍数 = 48.0s（M4 的「不同步」判据）", () => {
  const periods = [animationOf("#body").ms, animationOf(".hei-eyelid").ms, animationOf(".hei-tail").ms];
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const lcm = periods.reduce((acc, p) => (acc / gcd(acc, p)) * p, 1);
  console.log(
    `M4·⑤ 三组周期 ${periods.join(" / ")}ms｜两两不同 ${new Set(periods).size}/3 种｜最小公倍数 ${lcm / 1000}s（回正一次要等这么久，期间三者不同相）`,
  );
  assert.equal(
    new Set(periods).size,
    3,
    "三组周期必须两两不同：相同 = 同相 = 看起来像整体缩放（SCOPE §5 M4 原文）",
  );
  assert.equal(lcm, 48000, "三周期的最小公倍数必须是 48.0s（MOTION §7 的冻结值，改任一时长这条会红）");
});

test("M4·⑥ 三组 @keyframes 只动 transform / opacity，且声明全在 no-preference 里（KP-06 / MOTION §8）", () => {
  const noPreference = mediaBlock("prefers-reduced-motion: no-preference");
  const names = ["breathe", "blink", "tailSway"];
  for (const name of names) {
    assert.ok(
      noPreference.includes(`@keyframes ${name}`),
      `@keyframes ${name} 必须住在 @media (prefers-reduced-motion: no-preference) 里（MOTION §8 的正向前置）`,
    );
    assert.ok(
      noPreference.includes(`animation: ${name} `),
      `${name} 的 animation 声明必须住在 no-preference 里（只写 reduce 分支会漏掉内联样式与第三方动效）`,
    );
  }
  // 布局属性出现在关键帧里 = 每帧重排（NFR perf P1 / 60fps 直接破）
  const layout = /(?:^|[;{\s])(width|height|top|left|right|bottom|margin|padding|font-size|line-height|inset)\s*:/;
  const seen = new Set<string>();
  const census: string[] = [];
  for (const name of names) {
    for (const frame of keyframes(name)) {
      const props = frame.body
        .split(";")
        .map((decl) => decl.split(":")[0].trim())
        .filter(Boolean);
      for (const prop of props) {
        seen.add(prop);
        assert.ok(
          prop === "transform" || prop === "opacity",
          `@keyframes ${name} 的 ${frame.pct}% 帧动了 \`${prop}\`：只有合成层属性（transform / opacity）能上 60fps`,
        );
      }
      assert.ok(!layout.test(frame.body), `@keyframes ${name} 的 ${frame.pct}% 帧出现布局属性：每帧重排`);
      assert.ok(
        /transform\s*:/.test(frame.body),
        `@keyframes ${name} 的 ${frame.pct}% 帧没有 transform：三组动画都是几何变换，缺动画就不动`,
      );
    }
    census.push(`${name}[${keyframes(name).map((f) => f.pct + "%").join(",")}]`);
  }
  console.log(
    `M4·⑥ 三组关键帧 ${census.join(" ")} 只动 ${[...seen].sort().join(" / ")}；三条 animation 声明与三组关键帧都在 no-preference 块内`,
  );
});
