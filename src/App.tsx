// 应用根组件 · 摆件装配点（4-1 批次 2 接上 <HeiCat/>，批次 3 接上 M5 的 60Hz 跟随）
//
// 为什么这里只有三行：本组件的全部内容就是"把角色与三个交互 hook 拼起来"，接线本身不该长逻辑——
// 角度与幅度由 `interaction/gaze.ts` 的纯函数算，取样由 `interaction/useCursorFollow.ts`（唯一 60Hz 定时器）
// 做，位移由 `character/geometry.ts` 换算成设计坐标，这里只负责把值传下去。
// 批次 4 再接 `interaction/usePointerPassthrough`（消费本批已产出的 `cursorScreen`）与 `interaction/useDragExit`。
// ceiling: 没有拖拽、没有右键退出、透明区也不穿透（批次 4）——本批能演示的是"猫会呼吸/眨眼/甩尾 + 瞳孔跟着鼠标转"
// upgrade: 批次 4 接 usePointerPassthrough(cursorScreen, scaleFactor) 与 useDragExit 的 onMouseDown / onContextMenu
import "./App.css";
import HeiCat from "./character/HeiCat.tsx";
import { useCursorFollow } from "./interaction/useCursorFollow.ts";

function App() {
  const { gazeDeg, gazeTravel } = useCursorFollow(true);
  return <HeiCat gazeDeg={gazeDeg} gazeTravel={gazeTravel} />;
}

export default App;
