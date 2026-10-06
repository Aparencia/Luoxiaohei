// 应用根组件 · 摆件装配点（4-1 批次 2 接上 <HeiCat/>）
//
// 为什么现在只有一只猫、没有交互：这个组件的全部内容就是"把角色与三个交互 hook 拼起来"，
// 而那些模块按 `DESIGN.md` §10 的批次表分别在批次 3（`interaction/useCursorFollow`）与
// 批次 4（`interaction/usePointerPassthrough` 与 `interaction/useDragExit`）落地。
// 批次 2 先把造型接上 —— 窗口里第一次有东西可看，M3 的目视判据（SCOPE §10 Q2：判"像不像"的是用户）
// 从这一批起才有对象；此时拖拽、右键退出、瞳孔跟随都还没有（那是批次 3/4）。
// ceiling: 猫是静态的 —— 形态、比例、配色到位，但不会呼吸/眨眼/甩尾，瞳孔不跟随，透明区不穿透
// upgrade: 批次 3 接 useCursorFollow 并把 gazeDeg 传给瞳孔；批次 4 接 usePointerPassthrough 与 useDragExit 的鼠标事件
import "./App.css";
import HeiCat from "./character/HeiCat.tsx";

function App() {
  return <HeiCat />;
}

export default App;
