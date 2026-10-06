// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 1 ｜ 载体：SCOPE §5 M1 / M2 / M8 的验收命令
//
// 为什么读文件而不是 import：被测物就是那两个 JSON 本身（它们是配置的唯一事实源），
// import 会掺进"构建期怎么解析"这一层，判据就不再只盯配置内容。
//
// 反同义反复（TESTPLAN §7 点名的两处高危之一）：`window-config OK 6/6` 是常量比对，
// 按 TESTPLAN 的要求必须配一条**行为断言**——本文件里由「授权 ↔ 调用方」用例承担（见文件末），
// 它问的是"改哪一行生产代码会让它变红"：删掉某个 hook 里的一次调用 → 该用例红。
//
// 为什么是三斜线引用而不是改 `tsconfig.json` 的 `types`：本项目 tsconfig 根本没有 `types` 字段，
// 而 **TypeScript 6.0 不再自动纳入 `node_modules/@types/*`**（实测 `tsc --listFiles` 只列出
// `@types/react` 与 `@types/react-dom`——它们是被 `import "react"` 解析进来的，不是自动纳入的），
// 于是报 TS2591。修法有两条：① 动 tsconfig 的 types 白名单 ② 在**需要 node 类型的文件**上逐文件
// 显式引用。选 ②：SCOPE §5 的已知风险原文要求"**不**去改 tsconfig 的 types 白名单"，
// 且逐文件引用把 node 的 `setTimeout`（`Timeout`）与 DOM 的 `setTimeout`（`number`）的签名冲突
// 限制在测试文件内——生产代码那一份仍是 DOM 语义，不需要 `ReturnType<typeof setTimeout>` 兜。
/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const readText = (rel: string): string => readFileSync(new URL(rel, root), "utf8");
const readJson = <T>(rel: string): T => JSON.parse(readText(rel)) as T;

type WinConf = {
  label?: string;
  width: number;
  height: number;
  transparent?: boolean;
  decorations?: boolean;
  alwaysOnTop?: boolean;
  skipTaskbar?: boolean;
  shadow?: boolean;
  resizable?: boolean;
  maximizable?: boolean;
  minimizable?: boolean;
};

const tauriConf = readJson<{ app: { windows: WinConf[] } }>("src-tauri/tauri.conf.json");
const caps = readJson<{ windows: string[]; permissions: string[] }>(
  "src-tauri/capabilities/default.json",
);
const win = tauriConf.app.windows[0];

test("M1 · 透明置顶小窗六键（SCOPE §5 M1 / DESIGN §3.4）", () => {
  const items: Array<[string, boolean]> = [
    ["宽高 260x300", win.width === 260 && win.height === 300],
    ["transparent:true", win.transparent === true],
    ["decorations:false", win.decorations === false],
    ["alwaysOnTop:true", win.alwaysOnTop === true],
    ["skipTaskbar:true", win.skipTaskbar === true],
    ["shadow:false（不写会产生 1px 白边）", win.shadow === false],
  ];
  const ok = items.filter(([, pass]) => pass).length;
  console.log(`window-config OK ${ok}/6`);
  assert.deepEqual(
    items.filter(([, pass]) => !pass).map(([name]) => name),
    [],
    "M1 的六键必须全部成立",
  );
});

test("窗口尺寸锁两键（3-4 卡追加：不加则窗口可被改尺寸，破 M6 命中与 M3 比例）", () => {
  const items: Array<[string, boolean]> = [
    ["resizable:false", win.resizable === false],
    ["maximizable:false", win.maximizable === false],
  ];
  const ok = items.filter(([, pass]) => pass).length;
  console.log(`window-lock OK ${ok}/2`);
  assert.deepEqual(items.filter(([, pass]) => !pass).map(([name]) => name), [], "尺寸锁两键必须成立");
  // minimizable 必须是 true：NFR A3 的验证动作是"最小化 → 还原"，关掉它那一行就没法验。
  assert.notEqual(win.minimizable, false, "minimizable 必须保持可用（NFR A3 要最小化→还原）");
});

test("M2 · acl OK 4/4（SCOPE §5 M2 / TESTPLAN KP-02）", () => {
  // 口径写死（DESIGN §3.2）：4/4 = 除 core:default 之外的 4 条**具名**授权；
  // permissions 的总数是 5 条（NFR security S2 的上限），不是 4 条。
  const named = [
    "core:window:allow-close",
    "core:window:allow-start-dragging",
    "core:window:allow-set-ignore-cursor-events",
    "core:menu:default",
  ];
  const hit = named.filter((p) => caps.permissions.includes(p));
  console.log(`acl OK ${hit.length}/4`);
  assert.deepEqual(
    named.filter((p) => !caps.permissions.includes(p)),
    [],
    "M2 的四条具名授权必须齐全（缺任一条 → 对应命令在运行时被 ACL 静默拒绝）",
  );
  assert.ok(caps.permissions.includes("core:default"), "core:default 必须保留（它含 28 条读查询）");
  assert.ok(
    !caps.permissions.includes("opener:default"),
    "opener:default 必须已删除：前端零引用（DESIGN §4.3 退役清单）",
  );
});

test("KP-03 · 授权总数上限（NFR security S2：≤5，且不留未被调用的授权）", () => {
  assert.ok(
    caps.permissions.length <= 5,
    `permissions 共 ${caps.permissions.length} 条 > 上限 5（NFR S2）——新增授权必须先删一条或改静态配置`,
  );
  assert.equal(new Set(caps.permissions).size, caps.permissions.length, "permissions 不得有重复项");
  assert.deepEqual(caps.windows, ["main"], "capability 必须只作用于 main 窗口（多窗口才需要放开）");
});

test("M8 · 门禁命令形态（check.ps1 的 $STEPS 依赖这两条 script）", () => {
  const pkg = readJson<{ scripts: Record<string, string> }>("package.json");
  assert.equal(pkg.scripts.typecheck, "tsc --noEmit", "typecheck 必须逐字为 tsc --noEmit");
  assert.ok(pkg.scripts.test, "package.json 必须有 test script");
  // 形态判据不是形式主义：`node --test <目录>` 在 Node v24.21.0 上退出码 1（假红），
  // 见 docs/lessons/2026-10-06_node-test传目录假红.md。给目录 = 门禁恒红。
  assert.match(pkg.scripts.test, /[*?[{]/, "test 必须用 glob 模式，不能把目录交给 node --test");
  assert.ok(
    !/(^|\s)--test\s+"?src\/?"?\s*$/.test(pkg.scripts.test),
    "test 的最后一个参数不能是裸目录 src",
  );
});

// ── 反同义反复的行为断言：每条授权都能找到调用方（TESTPLAN KP-03 的另一半）──────────────
// 判据一句话：改哪一行**生产代码**会让它变红？——删掉某个 hook 里那一次 invoke → 本用例红。
const CALLERS: Array<{ perm: string; file: string; token: string }> = [
  { perm: "core:window:allow-close", file: "src/interaction/useDragExit.ts", token: "close" },
  {
    perm: "core:window:allow-start-dragging",
    file: "src/interaction/useDragExit.ts",
    token: "startDragging",
  },
  {
    perm: "core:window:allow-set-ignore-cursor-events",
    file: "src/interaction/usePointerPassthrough.ts",
    token: "setIgnoreCursorEvents",
  },
  { perm: "core:menu:default", file: "src/interaction/useDragExit.ts", token: "Menu" },
];

// ceiling: 批次 1 时 src/interaction/ 还不存在，"授权 ↔ 调用方"只能对已落盘的模块生效（现在 0/4 条被真正核对，本用例只打印进度不判红）
// upgrade: 4-1 批次 4 落地后（四个 interaction 模块存在），本用例自动变为 4/4 全量核对；届时某条授权仍找不到调用方 = 红（NFR S2 禁保留未被调用的授权，DESIGN §3.2）
test("KP-03 · 每条授权都能找到调用方（未落盘的模块跳过并计数）", () => {
  const checked: string[] = [];
  const skipped: string[] = [];
  for (const c of CALLERS) {
    if (!existsSync(new URL(c.file, root))) {
      skipped.push(c.perm);
      continue;
    }
    assert.ok(
      readText(c.file).includes(c.token),
      `${c.file} 里找不到 ${c.token} —— ${c.perm} 成了"未被调用的授权"（NFR S2）`,
    );
    checked.push(c.perm);
  }
  console.log(`acl-callers OK ${checked.length}/4（未落盘跳过 ${skipped.length} 条）`);
  assert.ok(checked.length + skipped.length === CALLERS.length, "调用方清单必须逐条有结论");
});
