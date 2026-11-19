# Scripting 边界探测

一次测完 Scripting 到底能干什么、不能干什么。每一项都是 PASS/FAIL，FAIL 也是答案。

## v1.1 结果（真机实测 11/12）

通过：环境指纹、eval、new Function、fetch 远程 JS、eval 远程代码（在 module.exports 上找到 JSZip）、JSZip 压缩再解压、动态 import 本地模块、require 本地 CJS 模块、fetch GitHub raw JSON、Uint8Array + Data、TextEncoder。

唯一失败：动态 import 远程 ESM（Module "https://..." not found，加载器只认本地文件）。

## v1.2 新增（深挖运行时，共 23 项）

13. **scriptingCapabilities**：全文打出来，看官方到底开放了哪些能力
14. **process.version**：版本 + versions 表，看引擎是什么版本
15. **platform/arch/title**：平台、架构、标题、browser 字段的值
16. **process.env 键名**：只列键名，不碰值
17. **process.argv**：启动参数
18. **process.cwd()**：当前工作目录
19. **process.binding**：只看类型，不调用
20. **scripting 模块导出**：`import("scripting")` 的全部导出清单，看 API 全貌
21. **globalThis 键名**：全局上都挂了什么
22. **process.hrtime()**：高精度时间能不能调
23. **process.nextTick 执行**：回调跑不跑

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
