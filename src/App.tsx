// 应用根组件 · 摆件装配点（批次 2 接上 <HeiCat/>，批次 3 接上 M5 的 60Hz 跟随，批次 4 接上 M6+M7）
//
// 为什么这里只有五行：本组件的全部内容就是"把角色与三个交互 hook 拼起来"，接线本身不该长逻辑——
// 角度与幅度由 `interaction/gaze.ts` 的纯函数算，取样由 `interaction/useCursorFollow.ts`（唯一 60Hz
// 定时器）做，位移由 `character/geometry.ts` 换算成设计坐标，命中由 `interaction/hitTest.ts` 判定，
// 这里只负责把值传下去。**同一次采样喂给两个消费者**：`cursorScreen` 一边算瞳孔、一边判穿透——
// 穿透层因此不需要自己采样（ARCHITECTURE §5 第 2 行：只允许一个 60Hz 定时器）。
import "./App.css";
import HeiCat from "./character/HeiCat.tsx";
import { useCursorFollow } from "./interaction/useCursorFollow.ts";
import { useDragExit } from "./interaction/useDragExit.ts";
import { usePointerPassthrough } from "./interaction/usePointerPassthrough.ts";

function App() {
  const { gazeDeg, gazeTravel, cursorScreen, windowOrigin, scaleFactor } = useCursorFollow(true);
  usePointerPassthrough(cursorScreen, windowOrigin, scaleFactor);
  const { onMouseDown, onContextMenu } = useDragExit();
  return (
    <HeiCat
      gazeDeg={gazeDeg}
      gazeTravel={gazeTravel}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
    />
  );
}

export default App;
