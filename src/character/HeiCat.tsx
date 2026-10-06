// 产物寿命：持久（进仓库）｜ 卡：4-1 批次 2（造型）+ 批次 3（M4 枢轴 + M5 瞳孔位移）｜ M3 + M4 + M5
//
// 这份 TSX 里为什么几乎没有数字：几何全部来自 `geometry.ts`（单一事实源），这里只决定**画的顺序**。
// 绘制顺序（后画的盖住先画的 —— DESIGN_TOKENS §10 的"只留最外一圈"）：
//   尾巴 → 耳朵 → 身体（含两条腿）→ 头 → 眼白 → 瞳孔 → 眼睑
// 尾根与耳根都刻意埋进身体/头里，露出来的只有该露的那一段（见 `geometry.ts` 的对应注释）。
//
// 两处 `transform-origin` 为什么写在这里而不是 CSS 里（批次 3）：它们的取值必须来自 `geometry.ts`
// （呼吸的枢轴 = 腹部底端 `torsoOriginY`、甩尾的枢轴 = 尾根 `tail.rootX/rootY`）——
// 写进 CSS 就是在第二处复述坐标，改一处忘一处就是"尾巴绕着画布原点甩出去"这类事故。
// 瞳孔位移同理：只把**变量**写到 `<svg>` 根上，CSS 侧 `.hei-pupil` 消费它（60Hz 下改的是变量、不是几何属性）。
//
// 描边为什么用 `paint-order: stroke fill` 而不是 §10 的"两遍绘制"（先描所有轮廓、再填所有实色）：
//   两遍绘制要把 7 条 `d` 抄两份（D12 信息阶梯：同一事实只写一处，抄两份必然漂移）；
//   `paint-order` 让每个形状自己的描边压在自己的填充之下，视觉结果同为"只留最外一圈"。
//
// 色值为什么几乎全在 `heicat.css` 的 `:root` 里：DESIGN_TOKENS §6 要求裸色值只出现在 `:root`。
// 唯一的例外就是下面两只眼白——M3 的冻结断言按白色 fill 的**字面量**数元素（TESTPLAN KP-04），
// 换成 `var()` 那条判据就变空；因此 `heicat.css` 里刻意**不定义**眼白变量，同一个事实仍然只写一处。
// ⚠️ 本文件（含注释）不许再出现那个白色字面量：判据是 `match(/fill="#…"/g)` 数次数，
// 注释里写一遍就会被自己判红——4-1 批次 2 实测（同一类坑见风险摘要 ㊶）。
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { CAT_GEOMETRY, VIEW_BOX, pupilOffsetFor } from "./geometry.ts";
import "./heicat.css";

type HeiCatProps = {
  /** 瞳孔角度（度，−180 ~ 180）：0 = 回正。M5 的 `useCursorFollow` 给值，缺省 = 静态姿态 */
  gazeDeg?: number;
  /** 归一化幅度（0 ~ 1）：0 = 回正、1 = 满偏。缺省 = 静态姿态 */
  gazeTravel?: number;
  /** M7：左键按住猫身拖窗口。挂在根 `<svg>` 上——`.hei-cat` 是 `pointer-events:none`、形状才是
   *  `visiblePainted`，所以事件只从**画出来的形状**冒泡上来（SCOPE §7 的"仅绘制形状可命中"）。 */
  onMouseDown?: (event: ReactMouseEvent<SVGSVGElement>) => void;
  /** M7：右键弹原生菜单「退出」。同样只在猫身上触发；透明区交给 M6 的穿透。 */
  onContextMenu?: (event: ReactMouseEvent<SVGSVGElement>) => void;
};

export default function HeiCat({
  gazeDeg = 0,
  gazeTravel = 0,
  onMouseDown,
  onContextMenu,
}: HeiCatProps) {
  const g = CAT_GEOMETRY;
  const [leftEye, rightEye] = g.eyeWhites;
  const [leftPupil, rightPupil] = g.pupils;
  const [leftLid, rightLid] = g.eyelids;
  const shift = pupilOffsetFor(gazeDeg, gazeTravel);
  // 变量名与 `heicat.css` 里 `.hei-pupil` 的 `var()` 一一对应；单位 user unit（= 设计坐标 px）
  const gazeVars = {
    "--hei-pupil-dx": `${shift.x}px`,
    "--hei-pupil-dy": `${shift.y}px`,
  } as CSSProperties;

  return (
    <svg
      className="hei-cat"
      viewBox={VIEW_BOX}
      style={gazeVars}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    >
      <defs>
        {/* 头部渐变：500 档（上）→ 700 档（下），给圆头一点体积感（DESIGN_TOKENS §1） */}
        <linearGradient id="hei-head-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="hei-stop-500" />
          <stop offset="1" className="hei-stop-700" />
        </linearGradient>
        {/* 身体与尾巴共用一条渐变：600 档（上）→ 800 档（下） */}
        <linearGradient id="hei-body-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="hei-stop-600" />
          <stop offset="1" className="hei-stop-800" />
        </linearGradient>
      </defs>

      {/* ① 尾巴：画在最底下，根部埋进身体（钝头被身体盖住）。
          枢轴 = 尾根：±8° 的摆动必须绕尾根转，否则整条尾巴会绕画布原点甩出去（M4·④ 会核对这条绑定） */}
      <path
        className="hei-tail"
        d={g.tail.outlineD}
        style={{ transformOrigin: `${g.tail.rootX}px ${g.tail.rootY}px` }}
      />

      {/* ② 耳朵：底边埋在头部椭圆里，由后画的头盖住 */}
      <path className="hei-ear" d={g.ears[0].pathD} />
      <path className="hei-ear" d={g.ears[1].pathD} />

      {/* ③ 躯干组：`id=body` 是 M4 呼吸动画的目标；缩放基准在腹部底端（SCOPE §7） */}
      <g id="body" style={{ transformOrigin: `${g.head.cx}px ${g.torsoOriginY}px` }}>
        <path className="hei-torso" d={g.torso.pathD} />
        <path className="hei-leg" d={g.legs[0].pathD} />
        <path className="hei-leg" d={g.legs[1].pathD} />
      </g>

      {/* ④ 头：盖住脖根与耳根 */}
      <ellipse className="hei-head" cx={g.head.cx} cy={g.head.cy} rx={g.head.rx} ry={g.head.ry} />

      {/* ⑤ 眼白 ×2：造型里唯一的亮色，恰好两处（M3 冻结断言） */}
      <ellipse
        className="hei-eye-white"
        cx={leftEye.cx}
        cy={leftEye.cy}
        rx={leftEye.rx}
        ry={leftEye.ry}
        fill="#FFFFFF"
      />
      <ellipse
        className="hei-eye-white"
        cx={rightEye.cx}
        cy={rightEye.cy}
        rx={rightEye.rx}
        ry={rightEye.ry}
        fill="#FFFFFF"
      />

      {/* ⑥ 瞳孔 ×2：静态居中偏下；M5 起由鼠标角度驱动（批次 3） */}
      <ellipse
        className="hei-pupil"
        cx={leftPupil.cx}
        cy={leftPupil.cy}
        rx={leftPupil.rx}
        ry={leftPupil.ry}
      />
      <ellipse
        className="hei-pupil"
        cx={rightPupil.cx}
        cy={rightPupil.cy}
        rx={rightPupil.rx}
        ry={rightPupil.ry}
      />

      {/* ⑦ 眼睑 ×2：静态时被 `scaleY(0)` 收成一条线（不可见），眨眼由 M4 的 @keyframes 驱动 */}
      <path className="hei-eyelid" d={leftLid.pathD} />
      <path className="hei-eyelid" d={rightLid.pathD} />
    </svg>
  );
}
