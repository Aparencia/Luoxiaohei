// 应用根组件 · 摆件装配点（4-1 批次 1 整份替换脚手架演示页）
//
// 为什么现在只有空装配：这个组件的全部内容就是"把角色与三个交互 hook 拼起来"，
// 而那些模块按 `DESIGN.md` §10 的批次表分别在批次 2（`character/HeiCat`）、
// 批次 3（`interaction/useCursorFollow`）、批次 4（`interaction/usePointerPassthrough`
// 与 `interaction/useDragExit`）落地。批次 1 若先把 import 写上去，`tsc --noEmit` 必红；
// 若保留脚手架演示页，那条演示命令就永远删不掉（退役判据是 `git grep -n` 该命令名命中 0）。
// 所以批次 1 的形态 = 装配点空着、脚手架清干净，后续批次只做加法。
// ceiling: 批次 1 渲染 null —— 窗口已经是透明置顶小窗（M1 已成立），但里面还没有东西
// upgrade: 批次 2 接 <HeiCat/>；批次 3 接 useCursorFollow 并把 gazeDeg 传给瞳孔；批次 4 接 usePointerPassthrough 与 useDragExit 的鼠标事件
import "./App.css";

function App() {
  return null;
}

export default App;
