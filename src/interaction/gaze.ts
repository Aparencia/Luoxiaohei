// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 3 ｜ M5 的纯函数层（TESTPLAN KP-07 / KP-08 的被测物）
//
// 为什么这个文件零副作用、零 import：DESIGN §3.5 把它钉成纯函数模块——"从坐标算角度"全在这里，
// 60Hz 的取样与 IPC 住在 `useCursorFollow.ts`（全项目唯一的定时器持有者）。纯函数 = 同输入必同输出
// （D14⑤），M5 的九条判据因此可以直接调它，一个桩件都不需要（TESTPLAN §7：gazeAngle 不替换）。
//
// 角度与幅度为什么分成两个函数：SCOPE §5 M5 只钉死**角度**（六个方向 + 远距归 0），
// 而 SCOPE §7 的元素表另钉了**幅度**（"距中心最大偏移 = 眼白短半径的 45%"）。
// 一个 `number` 装不下两件事，硬塞就会在调用方长出第二份真相 → 拆成 `gazeAngle` + `gazeTravel`。

/** 瞳孔跟随的采样率（NFR perf P3：60 Hz ± 5%）。M5 的验收命令逐字断言这个常量。 */
export const SAMPLE_HZ = 60;

/**
 * 满偏半径（逻辑 px）：光标离窗口中心 ≤ 该值 → 幅度到 1（瞳孔走到最大偏移）。
 * 取值依据：窗口只有 260×300，光标落在猫身上或紧贴窗口时距离在 200 px 上下——
 * 取 400 让"鼠标贴着猫走"这一段全程满偏，读数上才看得出眼珠跟着转。
 */
export const NEAR_FULL_PX = 400;

/** 回正半径（逻辑 px）：光标离窗口中心 > 该值 → 瞳孔回正（SCOPE §5 M5 原文的 1500）。 */
export const FAR_RESET_PX = 1500;

/**
 * 方向（度，−180 ~ 180；屏幕坐标系：y 向下，顺时针为正）。
 * 回 0 的三种情形：输入非有限（U3：`cursorPosition()` 取不到值时不许产出 `rotate(NaN)`）、
 * 距离超过 `FAR_RESET_PX`（SCOPE §5 M5：鼠标移到屏幕远端 → 回正）、光标正在窗口中心（方向未定义）。
 */
export function gazeAngle(dx: number, dy: number): number {
  const dist = Math.hypot(dx, dy);
  // ⚠️ 这一句是非有限输入的唯一挡板：`Math.hypot(NaN, 0)` = NaN、`hypot(MAX_VALUE, MAX_VALUE)` = Infinity，
  // 而下面的 Math.min/max 是**传播** NaN 的（`Math.max(-180, NaN)` = NaN），夹取拦不住它。
  if (!Number.isFinite(dist) || dist > FAR_RESET_PX || dist === 0) return 0;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  // 夹取是**写死不变量**用的护栏：atan2 的值域已经是 (−180, 180]，这行今天不可达。
  // 保留它的理由 = 输出契约（KP-08 要求"角度落在 −180~180"）写在返回处，将来换成查表/近似算法时不用回头补；
  // 代价 = 读代码的人可能误以为它在挡 NaN（挡 NaN 的是上面那句）——已在 M5·⑧ 就地写明。
  return Math.min(180, Math.max(-180, deg));
}

/**
 * 幅度（0 ~ 1）：0 = 回正（瞳孔停在静态姿态），1 = 满偏（`PUPIL_TRAVEL_RATIO` × 眼白短半径）。
 * 曲线 = 升（0 → `NEAR_FULL_PX` 线性升到 1）× 降（`FAR_RESET_PX` 处线性降到 0），两条都不可省：
 * - **升**：光标压在窗口中心时方向最抖（dx/dy 同时趋 0），幅度不清零就会看见瞳孔瞬间跳到另一侧——
 *   SCOPE §5 M5 把"全程无抖动、无跳变"写成了判据。
 * - **降**：SCOPE §5 M5 的"鼠标移到屏幕远端 → 瞳孔回到正中"；而且必须在 1500 处**恰好**降到 0，
 *   否则远端会看见一次跳变。
 * 峰值要**归一化到 1**：升段与降段相乘的极值出现在 `NEAR_FULL_PX` 处，但那里已经差了 `NEAR/FAR` 一段
 * （实测 0.7333），不归一化瞳孔就永远走不到 SCOPE §7 的"45% 上限"——这条是 M5·⑥ 跑红才发现的口径缺口。
 */
export function gazeTravel(dx: number, dy: number): number {
  const dist = Math.hypot(dx, dy);
  if (!Number.isFinite(dist) || dist >= FAR_RESET_PX) return 0;
  const rise = Math.min(dist / NEAR_FULL_PX, 1);
  const fall = 1 - dist / FAR_RESET_PX;
  // 归一化因子由这两个常量算出（极值点就在 NEAR_FULL_PX），不引入第三个魔数
  const peak = 1 - NEAR_FULL_PX / FAR_RESET_PX;
  return Math.min(1, Math.max(0, (rise * fall) / peak));
}
