# Scripting 边界探测

一次测完 Scripting 到底能干什么、不能干什么。每一项都是 PASS/FAIL，FAIL 也是答案。

## 测什么（index.tsx）

1. **环境指纹**：eval / Function / globalThis / window / process / require / Blob / TextEncoder / FileManager / Keychain / fetch 都在不在
2. **eval('1+1')**：运行时能不能执行代码字符串
3. **new Function**：动态构造函数的路通不通
4. **fetch 远程 JS 文本**：从 jsDelivr 拉 JSZip 当文本
5. **eval 远程代码**：把拉下来的 JSZip 现场 eval，看能不能挂到 globalThis 上
6. **JSZip 压缩再解压**：内存里打包 hello.txt 再解出来，闭环就说明纯 JS 库能跑
7. **动态 import 本地模块**：`import("./hello.js")`，通了就说明多文件项目 + 本地 ESM 模块能用
8. **fetch GitHub raw JSON**：拉 cloudflare-scripting 仓库的 script.json
9. **Uint8Array + Data**：二进制数据能不能过 Data.fromArrayBuffer
10. **TextEncoder 往返**：中文编解码正不正常

## Python 入口（probe.py）

新建项目，在高级设置里把入口改成 probe.py，再运行，看日志：

- Python 版本、zipfile 解压/压缩、urllib 联网、写文件再读回、import requests

## 怎么跑

公开仓库，手机上新建空项目，远程资源粘仓库地址，开自动更新，点立即更新，运行 index.tsx。

## 怎么汇报

结果截图发回来就行，重点是哪些 ❌，我再帮你判断哪条路能走。
