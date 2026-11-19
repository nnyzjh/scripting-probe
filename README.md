# Scripting 边界探测

一次测完 Scripting 到底能干什么、不能干什么。每一项都是 PASS/FAIL，FAIL 也是答案。

## v1.1 结果（真机实测 11/12）

通过：环境指纹、eval、new Function、fetch 远程 JS、eval 远程代码（在 module.exports 上找到 JSZip）、JSZip 压缩再解压、动态 import 本地模块、require 本地 CJS 模块、fetch GitHub raw JSON、Uint8Array + Data、TextEncoder。

唯一失败：动态 import 远程 ESM（Module "https://..." not found，加载器只认本地文件）。

## v1.2 结果（真机实测 22/23）

唯一失败仍是动态 import 远程 ESM。运行时真相：engine JavaScriptCore，platform ios，nodeCompatibilityBaseline 20.0.0，process.version v20.0.0，versions.scripting "node-compat-2"——JSC 之上仿 Node 20 的兼容层。platform=ios，arch=arm64，title=browser，browser=true；argv=[]；cwd()=/；process.binding 是函数；hrtime/nextTick 都能用。scripting 模块导出 219 个，globalThis 键名 326 个。

## v1.9 新增（打开就自动复制）

- **打开就自动复制全文**：不用点任何按钮，跑完直接去聊天里粘贴；复制和网页加载各一行状态，哪步行哪步不行第一屏就看得见
- 按钮仍在中间留着备用

## v1.8 新增（按钮放中间）

- **状态行 + 三个按钮放中间**（标题和网页框下面、结果清单上面），不要最上也不要最下；网页框缩到 300 高，打开第一屏就能看到按钮
- “复制完整清单”改名“一键复制全文”

## v1.7 新增（按钮移到最底下）

- **状态行 + 三个按钮移到页面最底下**（结果清单之后）：顶上的按钮可能够不着，翻到底就能点到
- 网页框高度 500 → 400，少占点地方

## v1.6 新增（交互诊断：状态行 + 点按计数）

- **点按计数器**：顶上一个“点我测试”按钮，点一下数字就变——证明按钮本身能不能收到点击
- **状态行**：复制/加载每一步的结果直接写在屏幕上（“正在写剪贴板…”/“已复制”/“复制失败：…”），不再靠 Dialog 弹窗报信
- **已确认的事实**：WebViewController、Pasteboard、Dialog 三个全局都存在，但按钮仍无反应——问题不在它们存不存在

## v1.5 新增（内嵌网页全文 + 查按钮失灵原因）

- **全文改成内嵌 WebView**：直接嵌在页面里，不再弹全屏新窗口（v1.4 的 present 点着没反应）；打开自动加载，可以滑动、长按全选复制
- **新增两项探测**：WebViewController、Pasteboard、Dialog 到底存不存在——按钮没反应的原因要在界面上看得见，不再靠日志猜
- **URL import 红字根治**：URL 放变量里再 import，编辑器不再报“找不到模块”（v1.4 的 `// @ts-ignore` 放错了行，只管下一行，不管 import 那行）

## v1.4 新增（网页全文 + 消红字）

- **打开全文按钮**：结果以网页形式全屏打开，可以滑动、长按全选复制，不靠剪贴板按钮也不靠日志
- **编辑器红字已消**：`window`/`self`/`module` 加了 `declare` 声明（只影响编辑器显示，编译后不存在）；远程 ESM 那行加了 `// @ts-ignore`。注意：这些红字本来就是编辑器的类型检查报错，不是运行错误——运行时这些全局都存在，v1.2 实测已通过

## v1.3 新增（展开完整清单）

- **scriptingCapabilities 按 key 拆行**：每个顶层 key 一行，不再截断
- **导出全清单**：219 个导出名，12 个一组分行显示
- **全局全清单**：326 个 globalThis 键名，12 个一组分行显示
- **env 全清单**：环境变量键名（只列键名，不碰值），12 个一组分行显示
- **复制完整清单按钮**：点一下把全部结果拷进剪贴板，不用一张张截图

## 测什么（index.tsx，v1.0/v1.1 共 12 项）

1. **环境指纹**：eval / Function / globalThis / window / process / require / Blob / TextEncoder / FileManager / Keychain / fetch 都在不在，外加 process 的键名
2. **eval('1+1')**：运行时能不能执行代码字符串
3. **new Function**：动态构造函数的路通不通
4. **fetch 远程 JS 文本**：从 jsDelivr 拉 JSZip 当文本
5. **eval 远程代码**：把拉下来的 JSZip 现场 eval，先找 globalThis.JSZip，再找 module.exports
6. **JSZip 压缩再解压**：内存里打包 hello.txt 再解出来，闭环就说明纯 JS 库能跑
7. **动态 import 本地模块**：`import("./hello.js")`，通了就说明多文件项目 + 本地 ESM 模块能用
8. **require 本地 CJS 模块**：`require("./hello-cjs.js")`，通了就说明 CommonJS 风格的本地模块也能用
9. **动态 import 远程 ESM**：`import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm")`，通了就说明远程 ESM 能直接 import
10. **fetch GitHub raw JSON**：拉 cloudflare-scripting 仓库的 script.json
11. **Uint8Array + Data**：二进制数据能不能过 Data.fromArrayBuffer
12. **TextEncoder 往返**：中文编解码正不正常

## Python 入口（probe.py）

新建项目，在高级设置里把入口改成 probe.py，再运行，看日志：

- Python 版本、zipfile 解压/压缩、urllib 联网、写文件再读回、import requests

## 怎么跑

公开仓库，手机上新建空项目，远程资源粘仓库地址，开自动更新，点立即更新，运行 index.tsx。

## 怎么汇报

结果截图发回来就行，重点是哪些 ❌，我再帮你判断哪条路能走。
