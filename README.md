# 罗小黑桌面摆件（Luoxiaohei）

> 一句话：给 Windows 桌面做一个常驻的罗小黑（猫形态）**活摆件**——背景透明、永远置顶，会呼吸/眨眼/甩尾、瞳孔跟随鼠标、可拖拽（立项结论见 [IDEA 决策卡](docs/decisions/IDEA_2026-10-06_罗小黑桌面宠物.md)）

> ⚠️ **同人作品声明**：罗小黑（《罗小黑战记》）为 MTJJ / 寒木春华持有的**在版权 IP**。本项目是**未经授权的同人作品**，公开分发由项目所有者于 2026-10-06 明示承担风险；**不得用于任何商业用途**，如收到权利人主张应立即停止分发。详见 IDEA 决策卡的「前置条件落地记录」。

> 开发流程：**Roadbook V6 母版**——动作照母版流程卡走（英文执行版 `playbook_EN/` 优先，中文判据版 `playbook/` 兜底）；`check/doctor/gate/orphans/security` 五个守护脚本随本项目走。

## 技术栈

Tauri 2 + React 19 + TypeScript + Vite（角色用 SVG + CSS 动画）；选型理由与被否方案见 [STACK 决策卡](docs/decisions/STACK_2026-10-06_桌面摆件技术栈.md)。版本锁在 `.tool-versions`。
**注意**：角色渲染**尚未实现**（`src/App.tsx` 目前还是脚手架自带的演示页），首个功能走 2-1 卡立项。

## 快速启动

```powershell
npm install                                # 安装前端依赖（首次）
powershell -NoProfile -ExecutionPolicy Bypass -File doctor.ps1     # 环境自检：nodejs / rust 逐项输出版本号 = 通过
npm run tauri dev                          # 开发模式启动桌面应用（热重载）
npm run tauri build                        # 打包 Windows 安装包与可执行文件
powershell -NoProfile -ExecutionPolicy Bypass -File security.ps1   # 安全门禁：密钥/危险执行链/依赖与 CI 机检，退出码 0=无红 1=拦下 2=环境错
powershell -NoProfile -ExecutionPolicy Bypass -File check.ps1      # 收工仪式：退出码 0 = 可以说"完成"
```

> `-ExecutionPolicy Bypass` 是本机**必需**参数：本机 `CurrentUser = RemoteSigned` 却会拦下无签名的本地脚本（实测，原因未查明）。该参数只在本次进程内生效，**不改系统执行策略**。详见 `AGENTS.md` §10 已知环境坑。

## 这个项目怎么运作

- `AGENTS.md`——项目宪法：agent 每次会话自动读的规则（范围四禁/停问规则/完成定义）
- `STATE.md`——状态仪表盘：项目现在在哪、下一步做什么、等谁裁决什么
- `docs/`——机制文档：组件注册表/数据字典/接口清单/决策卡/教训卡/归档
- 每个开发动作——照母版流程卡走：开工确认 → 执行 → 证据回执 → 状态回写，四段照做，不必额外读手册

## 给未来（三个月后）的自己

放了两周回来不知从哪开始？发一次母版的 0-1-驱动卡，说"看看状态"或直接说你要做什么。
