// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 3 ｜ 载体：SCOPE §5 M5 的验收命令（TESTPLAN KP-07 / KP-08 / KP-12 的常量侧）
//
// 为什么这里有一条"扫生产源码数定时器"的用例：M5 的验收命令逐字要求"断言常量 `SAMPLE_HZ === 60`"，
// 而 TESTPLAN §1 把这条点名为**同义反复高危**（"改哪一行生产代码能让它红？"——只改常量自己）。
// 补强的行为断言就是它：60Hz 在本项目里不只是个数字，它是**结构事实**——全项目只有一处 60Hz 定时器
// （ARCHITECTURE §5 第 2 行；两个定时器 = 120 次/秒 IPC，顶 NFR perf P1）。谁再起一个定时器，本用例红。
//
// 为什么角度用纯函数直接调、不打桩：`gaze.ts` 无副作用、无 import、无隐藏状态（D14⑤），
// 打桩等于把被测物换掉（TESTPLAN §7 的接缝约定：gazeAngle 不替换）。
/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { FAR_RESET_PX, NEAR_FULL_PX, SAMPLE_HZ, gazeAngle, gazeTravel } from "./gaze.ts";

const SRC = new URL("../../src/", import.meta.url);
const readSrc = (rel: string): string => readFileSync(new URL(rel, SRC), "utf8");

/** 生产源码清单（排除测试文件自己：`.test.ts` 里会出现被扫的词，那是代码不是实现）。 */
const productionSources = (): string[] =>
  (readdirSync(SRC, { recursive: true }) as string[])
    .map((p) => p.replace(/\\/g, "/"))
    .filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith(".test.ts"));

test("M5·① gazeAngle(1,0) = 0°（正右方，SCOPE §5 M5 逐字判据）", () => {
  const deg = gazeAngle(1, 0);
  console.log(`M5·① gazeAngle(1,0) = ${deg}°`);
  assert.equal(deg, 0);
});

test("M5·② gazeAngle(0,1) = 90°（正下方；屏幕坐标 y 向下）", () => {
  const deg = gazeAngle(0, 1);
  console.log(`M5·② gazeAngle(0,1) = ${deg}°`);
  assert.equal(deg, 90);
});

test("M5·③ gazeAngle(-1,0) = 180°（正左方——这条同时钉死用的是 atan2 而不是 atan）", () => {
  const deg = gazeAngle(-1, 0);
  console.log(`M5·③ gazeAngle(-1,0) = ${deg}°（线段正左，象限信息不能丢）`);
  assert.equal(deg, 180);
});

test("M5·④ gazeAngle(0,-1) = -90°（正上方，负角不是 270）", () => {
  const deg = gazeAngle(0, -1);
  console.log(`M5·④ gazeAngle(0,-1) = ${deg}°`);
  assert.equal(deg, -90);
});

test("M5·⑤ gazeAngle(0,0) = 0°（光标正在窗口中心：方向未定义 → 回正，不许抛、不许 NaN）", () => {
  const deg = gazeAngle(0, 0);
  console.log(`M5·⑤ gazeAngle(0,0) = ${deg}°；单轴同向也归零？gazeAngle(37,0) = ${gazeAngle(37, 0)}°`);
  assert.equal(deg, 0);
  // 单轴同向是"0°"而不是"没有方向"：只有 (0,0) 是未定义，贴着轴不算
  assert.equal(gazeAngle(37, 0), 0);
  assert.equal(gazeAngle(0, 37), 90);
});

test("M5·⑥ 距窗口中心 > FAR_RESET_PX 时归 0（含 1500 边界的两侧）", () => {
  const diag = FAR_RESET_PX / Math.SQRT2; // 45° 方向上让距离恰好 = FAR_RESET_PX
  const far = { dx: 1200, dy: 1200 }; // 距离 1697.06 > 1500
  const near = { dx: 800, dy: 800 }; // 距离 1131.37 < 1500
  console.log(
    `M5·⑥ 距离 ${Math.hypot(far.dx, far.dy).toFixed(2)} → ${gazeAngle(far.dx, far.dy)}°；` +
      `距离 ${Math.hypot(near.dx, near.dy).toFixed(2)} → ${gazeAngle(near.dx, near.dy)}°；` +
      `边界 1500 → ${gazeAngle(diag, diag)}°、1500.7 → ${gazeAngle(diag + 0.5, diag + 0.5)}°`,
  );
  assert.equal(gazeAngle(far.dx, far.dy), 0, "> 1500px 必须回正（SCOPE §5 M5 原文）");
  assert.equal(gazeAngle(near.dx, near.dy), 45, "1500px 以内仍要跟随：判据是 > 1500，不是 >= 1500");
  // 边界：距离恰好 1500 时判据原文（"> 1500"）不成立 → 角度照算；超过一点点就归零
  assert.equal(gazeAngle(diag, diag), 45, "恰好 1500px 时不该提前归零");
  assert.equal(gazeAngle(diag + 0.5, diag + 0.5), 0, "超过 1500px 立刻归零");
  // 幅度侧：远端归零必须是"幅度也归零"，否则瞳孔停在边缘（看着像瞪着远处）
  assert.equal(gazeTravel(far.dx, far.dy), 0);
  assert.equal(gazeTravel(NEAR_FULL_PX, 0), 1, "满偏半径处幅度必须到 1——否则瞳孔永远走不到 SCOPE §7 的 45% 上限");
  assert.equal(gazeTravel(0, 0), 0, "光标压在窗口中心时幅度为 0：方向在那里最抖，幅度不清零就会看见跳变（SCOPE M5 禁）");

  // ⚠️ 上面四条边界断言都是**用实现自己的常量**构造的（`FAR_RESET_PX / Math.SQRT2`）——
  // 把 FAR_RESET_PX 改成约 1132~1697 之间任意值，它们**全绿**（4-2 的 R-03）。
  // 所以 SCOPE §5 M5 逐字写死的 1500 必须另有一条常量断言 pin 住，写法与 M5·⑨ 钉 `SAMPLE_HZ === 60` 一致。
  assert.equal(FAR_RESET_PX, 1500, "SCOPE §5 M5 原文写死「> 1500px 时归 0」：回正半径不许漂移");
  assert.equal(NEAR_FULL_PX, 400, "满偏半径是设计加法（DESIGN §3.5 的取值，非 SCOPE 硬数字）：改它必须同批改文档");
});

test("M5·⑦ 全方向夹取：任意方向的输出都落在 −180°~180° 且有限（KP-08 前半）", () => {
  const radii = [1, 100, NEAR_FULL_PX, FAR_RESET_PX];
  let count = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < 720; i++) {
    const rad = (i * Math.PI) / 360;
    for (const r of radii) {
      const deg = gazeAngle(Math.cos(rad) * r, Math.sin(rad) * r);
      assert.ok(Number.isFinite(deg), `方向 ${i}（半径 ${r}）产出非有限角度 ${deg}`);
      assert.ok(deg >= -180 && deg <= 180, `方向 ${i}（半径 ${r}）产出 ${deg}°，越出 −180~180`);
      min = Math.min(min, deg);
      max = Math.max(max, deg);
      count++;
    }
  }
  console.log(`M5·⑦ ${count} 组方向 × 半径全部落在 [${min}°, ${max}°]（夹取区间 −180~180）`);
  assert.ok(min <= -179.5 && max >= 179.5, "取样没覆盖到两侧极值，这条断言会空转");
});

test("M5·⑧ NaN / Infinity 输入一律回 0，绝不产出 NaN（SCOPE §5 M5「无 NaN」= U3）", () => {
  const cases: Array<[number, number]> = [
    [Number.NaN, 0],
    [0, Number.NaN],
    [Number.NaN, Number.NaN],
    [Number.POSITIVE_INFINITY, 0],
    [Number.NEGATIVE_INFINITY, 5],
    [0, Number.NEGATIVE_INFINITY],
    [Number.MAX_VALUE, Number.MAX_VALUE], // hypot 会溢出成 Infinity
  ];
  const lines: string[] = [];
  for (const [dx, dy] of cases) {
    const deg = gazeAngle(dx, dy);
    const travel = gazeTravel(dx, dy);
    lines.push(`(${dx},${dy})→${deg}°/${travel}`);
    assert.ok(Object.is(deg, 0), `gazeAngle(${dx},${dy}) = ${deg}：非法输入必须回 0（否则 SVG 会写出 rotate(NaN)）`);
    assert.ok(Object.is(travel, 0), `gazeTravel(${dx},${dy}) = ${travel}：非法输入必须回 0`);
  }
  console.log(`M5·⑧ ${cases.length} 组非法输入全部回 0：${lines.join(" ｜ ")}`);
  // ⚠️ 唯一挡住 NaN 的是 gazeAngle/gazeTravel 里那句"距离必须有限"的守卫（Math.hypot(NaN,0) = NaN，
  // 而 Math.min/max 是**传播** NaN 的、夹取拦不住它）。TESTPLAN §7 的 MUT-2 原文写的是"去掉 −180~180 夹取"——
  // 实测那句话删掉不会让任何用例变红（atan2 的值域本来就是 (−180,180]，夹取不可达），
  // 真正会红的是删掉这句有限性守卫。口径已同批修进 TESTPLAN §7。
});

test("M5·⑨ SAMPLE_HZ = 60（NFR perf P3）且全项目只有一处 60Hz 定时器（ARCHITECTURE §5）", () => {
  assert.equal(SAMPLE_HZ, 60, "NFR P3 逐字要求 60Hz（用户 2026-10-06 的原话）");
  const intervalMs = 1000 / SAMPLE_HZ;
  const files = productionSources();
  const timerHolders = files.filter((f) => readSrc(f).includes("setInterval("));
  const rafUsers = files.filter((f) => readSrc(f).includes("requestAnimationFrame("));
  console.log(
    `M5·⑨ SAMPLE_HZ=${SAMPLE_HZ}（采样间隔 ${intervalMs.toFixed(4)}ms，NFR P3 带 16.7±0.8ms）｜` +
      `生产源码 ${files.length} 个文件｜定时器持有者 ${timerHolders.length} 个：${timerHolders.join(", ")}`,
  );
  assert.ok(
    Math.abs(intervalMs - 16.7) <= 0.8,
    `采样间隔 ${intervalMs.toFixed(4)}ms 落在 NFR P3 的 16.7±0.8ms 之外`,
  );
  assert.deepEqual(
    timerHolders,
    ["interaction/useCursorFollow.ts"],
    "60Hz 定时器必须恰好一处（ARCHITECTURE §5：瞳孔跟随只允许一个定时器；两个 = 120 次/秒 IPC）",
  );
  assert.deepEqual(rafUsers, [], "禁 requestAnimationFrame 全帧重绘（ARCHITECTURE §5）");
  assert.ok(
    readSrc("interaction/useCursorFollow.ts").includes("1000 / SAMPLE_HZ"),
    "定时器间隔必须由 SAMPLE_HZ 推出：写死 16 会让这条常量断言与真实采样率脱钩",
  );
});
