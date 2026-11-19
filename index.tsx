// Scripting 能力边界探测 v1.6（index.tsx）
// v1.5 已确认：moduleLoader 是 "CommonJS with AST ESM lowering"——这就是远程 ESM
// import 永远失败的原因；WebViewController、Pasteboard、Dialog 三个全局都存在，
// 但按钮点下去还是“无交互”。
// v1.6 不再猜：加一个点按计数器按钮（点一下数字就变，证明按钮本身能收到点击），
// 再加一行状态文字——复制/加载每一步的结果都直接写在屏幕上，不靠 Dialog 弹窗，
// 这样下次截图就能看出来到底是哪一步没反应。

import { Navigation, NavigationStack, VStack, Spacer, Text, Button, Script, WebView, useMemo, useEffect, useState } from "scripting"

// 编辑器的类型检查器不认识这几个全局，但运行时它们都存在（v1.2 实测通过），
// 只是类型声明里没有。declare 只影响编辑器显示，编译后不存在，不影响运行。
declare const window: any
declare const self: any
declare const module: any
declare const WebViewController: any
declare const Pasteboard: any
declare const Dialog: any

type Result = { name: string; pass: boolean; detail: string }

const JSZIP_URL = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"
const RAW_JSON_URL = "https://raw.githubusercontent.com/nnyzjh/cloudflare-scripting/main/script.json"

let JSZipCtor: any = null

function cap(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…（截断）" : s
}

function jdump(v: any, n = 1200): string {
  try {
    return cap(JSON.stringify(v), n)
  } catch (e) {
    return "无法序列化：" + String(e)
  }
}

function chunk(arr: string[], size: number): string[][] {
  const out: string[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function one(name: string, fn: () => any): Promise<Result> {
  try {
    const d = await fn()
    return { name, pass: true, detail: String(d ?? "ok") }
  } catch (e) {
    return { name, pass: false, detail: String(e) }
  }
}

async function runTests(): Promise<Result[]> {
  const out: Result[] = []

  // 1. 环境指纹
  out.push({
    name: "环境指纹",
    pass: true,
    detail:
      "eval:" + typeof eval +
      " Function:" + typeof Function +
      " globalThis:" + typeof globalThis +
      " window:" + typeof window +
      " self:" + typeof self +
      " process:" + typeof process +
      " require:" + typeof require +
      " module:" + typeof module +
      " Blob:" + typeof Blob +
      " TextEncoder:" + typeof TextEncoder +
      " FileManager:" + typeof FileManager +
      " Keychain:" + typeof Keychain +
      " fetch:" + typeof fetch +
      " processKeys:" + (() => { try { return Object.keys(process).join(",") } catch { return "?" } })(),
  })

  // 2. eval
  out.push(await one("eval('1+1')", () => {
    const v = eval("1+1")
    if (v !== 2) throw new Error("结果是 " + v)
    return "1+1 = 2"
  }))

  // 3. new Function
  out.push(await one("new Function", () => {
    const f = new Function("return 7*6")
    const v = f()
    if (v !== 42) throw new Error("结果是 " + v)
    return "7*6 = 42"
  }))

  // 4. fetch 远程 JS 当文本
  let jszipText = ""
  out.push(await one("fetch 远程 JS 文本", async () => {
    const r = await fetch(JSZIP_URL, { timeout: 30 })
    if (!r.ok) throw new Error("HTTP " + r.status)
    jszipText = await r.text()
    if (jszipText.length < 10000) throw new Error("只拿到 " + jszipText.length + " 字节")
    return jszipText.length + " 字节"
  }))

  // 5. eval 远程代码（UMD 在有 module 的环境走 CommonJS 分支，两处都找）
  out.push(await one("eval 远程代码（JSZip）", () => {
    if (!jszipText) throw new Error("前面 fetch 失败，没拿到代码")
    eval(jszipText)
    const fromGlobal = (globalThis as any).JSZip
    let fromModule: any = null
    try { fromModule = (module as any).exports } catch { fromModule = null }
    if (typeof fromGlobal === "function") { JSZipCtor = fromGlobal; return "在 globalThis 上找到" }
    if (typeof fromModule === "function") { JSZipCtor = fromModule; return "在 module.exports 上找到（UMD 走了 CommonJS 分支）" }
    throw new Error("两处都没找到 JSZip")
  }))

  // 6. JSZip 压缩+解压闭环
  out.push(await one("JSZip 压缩再解压", async () => {
    if (typeof JSZipCtor !== "function") throw new Error("JSZip 没加载")
    const zip = new JSZipCtor()
    zip.file("hello.txt", "hi")
    const buf = await zip.generateAsync({ type: "uint8array" })
    const zip2 = await JSZipCtor.loadAsync(buf)
    const txt = await zip2.file("hello.txt").async("string")
    if (txt !== "hi") throw new Error("解出来是 " + txt)
    return "hello.txt 存取一致"
  }))

  // 7. 动态 import 本地模块
  out.push(await one("动态 import 本地模块", async () => {
    const m: any = await import("./hello.js")
    if (typeof m.hello !== "function") throw new Error("hello 不是函数")
    if (m.hello() !== "lib-ok") throw new Error("返回值不对")
    return "hello.js 加载成功"
  }))

  // 8. require 本地 CJS 模块
  out.push(await one("require 本地 CJS 模块", () => {
    const m: any = require("./hello-cjs.js")
    const fn = m.hello || (m.default && m.default.hello)
    if (typeof fn !== "function") throw new Error("hello 不是函数")
    if (fn() !== "cjs-ok") throw new Error("返回值不对")
    return "hello-cjs.js 加载成功"
  }))

  // 9. 动态 import 远程 ESM（URL 放变量里，编辑器就不再报“找不到模块”）
  out.push(await one("动态 import 远程 ESM", async () => {
    const esmUrl = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm"
    const m: any = await import(esmUrl)
    const C = m.default || m.JSZip
    if (typeof C !== "function") throw new Error("拿到的不是 JSZip 构造器")
    return "远程 ESM 直接 import 成功"
  }))

  // 10. fetch GitHub raw JSON
  out.push(await one("fetch GitHub raw JSON", async () => {
    const r = await fetch(RAW_JSON_URL, { timeout: 15 })
    if (!r.ok) throw new Error("HTTP " + r.status)
    const j = await r.json()
    if (!j.name) throw new Error("没有 name 字段")
    return "读到仓库 script.json，name=" + j.name
  }))

  // 11. Uint8Array + Data
  out.push(await one("Uint8Array + Data", () => {
    const u = new Uint8Array([104, 105])
    if (u[0] !== 104 || u[1] !== 105) throw new Error("Uint8Array 不对")
    const d = Data.fromArrayBuffer(u.buffer)
    if (!d) throw new Error("Data.fromArrayBuffer 返回空")
    return "二进制数据可用"
  }))

  // 12. TextEncoder/TextDecoder
  out.push(await one("TextEncoder 往返", () => {
    const enc = new TextEncoder()
    const dec = new TextDecoder()
    const s = dec.decode(enc.encode("你好 Scripting"))
    if (s !== "你好 Scripting") throw new Error("编解码不一致")
    return "中文编解码正常"
  }))

  const P = process as any

  // 13. scriptingCapabilities 全文
  out.push(await one("scriptingCapabilities", () => {
    if (typeof P.scriptingCapabilities === "undefined") throw new Error("没有这个字段")
    return jdump(P.scriptingCapabilities, 1500)
  }))

  // 14. process.version / versions
  out.push(await one("process.version", () => {
    return "version=" + P.version + " versions=" + jdump(P.versions, 600)
  }))

  // 15. platform / arch / title / browser
  out.push(await one("platform/arch/title", () => {
    return "platform=" + P.platform + " arch=" + P.arch + " title=" + P.title + " browser=" + P.browser
  }))

  // 16. env 键名（只列键名，不碰值）
  out.push(await one("process.env 键名", () => {
    const keys = Object.keys(P.env || {})
    return keys.length ? cap(keys.join(","), 800) : "空"
  }))

  // 17. argv
  out.push(await one("process.argv", () => jdump(P.argv, 800)))

  // 18. cwd
  out.push(await one("process.cwd()", () => {
    if (typeof P.cwd !== "function") throw new Error("cwd 不是函数")
    return String(P.cwd())
  }))

  // 19. binding（只看类型，不调用）
  out.push(await one("process.binding", () => {
    const b = P.binding
    return "typeof=" + typeof b + (b && typeof b === "object" ? " keys=" + cap(Object.keys(b).join(","), 400) : "")
  }))

  // 20. scripting 模块导出清单
  out.push(await one("scripting 模块导出", async () => {
    const m: any = await import("scripting")
    const keys = Object.keys(m).sort()
    return keys.length + " 个：" + cap(keys.join(","), 1000)
  }))

  // 21. globalThis 键名
  out.push(await one("globalThis 键名", () => {
    const keys = Object.keys(globalThis)
    return keys.length + " 个：" + cap(keys.join(","), 1000)
  }))

  // 22. hrtime
  out.push(await one("process.hrtime()", () => {
    if (typeof P.hrtime !== "function") throw new Error("不是函数")
    return jdump(P.hrtime(), 200)
  }))

  // 23. nextTick
  out.push(await one("process.nextTick 执行", async () => {
    if (typeof P.nextTick !== "function") throw new Error("不是函数")
    let ran = false
    P.nextTick(() => { ran = true })
    await new Promise<void>((resolve) => setTimeout(resolve, 100))
    if (!ran) throw new Error("回调没跑")
    return "回调跑了"
  }))

  // 24. WebViewController 存在吗（v1.4 的“打开全文”按钮点着没反应，查是不是它不存在）
  out.push(await one("WebViewController 存在", () => {
    if (typeof WebViewController === "undefined") throw new Error("没有这个全局")
    return "typeof=" + typeof WebViewController
  }))

  // 25. Pasteboard / Dialog 存在吗（v1.3 的复制按钮没反应，查是不是它们不存在）
  out.push(await one("Pasteboard/Dialog 存在", () => {
    return "Pasteboard:" + typeof Pasteboard + " Dialog:" + typeof Dialog
  }))

  // ---- v1.3 新增：展开完整清单 ----
  // scriptingCapabilities 按 key 拆行
  try {
    const caps = P.scriptingCapabilities
    if (caps && typeof caps === "object") {
      for (const k of Object.keys(caps)) {
        out.push({ name: "cap." + k, pass: true, detail: jdump((caps as any)[k], 600) })
      }
    } else {
      out.push({ name: "cap.*", pass: false, detail: "不是对象：" + typeof caps })
    }
  } catch (e) {
    out.push({ name: "cap.*", pass: false, detail: String(e) })
  }

  // scripting 导出全清单，12 个一组
  try {
    const m: any = await import("scripting")
    const keys = Object.keys(m).sort()
    const groups = chunk(keys, 12)
    groups.forEach((g, i) => {
      out.push({ name: "导出 " + (i + 1) + "/" + groups.length, pass: true, detail: g.join(", ") })
    })
  } catch (e) {
    out.push({ name: "导出 *", pass: false, detail: String(e) })
  }

  // globalThis 键名全清单，12 个一组
  try {
    const keys = Object.keys(globalThis).sort()
    const groups = chunk(keys, 12)
    groups.forEach((g, i) => {
      out.push({ name: "全局 " + (i + 1) + "/" + groups.length, pass: true, detail: g.join(", ") })
    })
  } catch (e) {
    out.push({ name: "全局 *", pass: false, detail: String(e) })
  }

  // env 键名全清单，12 个一组（只列键名，不碰值）
  try {
    const keys = Object.keys(P.env || {}).sort()
    const groups = chunk(keys, 12)
    groups.forEach((g, i) => {
      out.push({ name: "env " + (i + 1) + "/" + groups.length, pass: true, detail: g.join(", ") })
    })
  } catch (e) {
    out.push({ name: "env *", pass: false, detail: String(e) })
  }

  return out
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function buildFullText(results: Result[]): string {
  return results.map((r) => (r.pass ? "✅ " : "❌ ") + r.name + "\n" + r.detail).join("\n\n")
}

function App({ results }: { results: Result[] }) {
  const pass = results.filter((r) => r.pass).length
  const [taps, setTaps] = useState(0)
  const [status, setStatus] = useState("还没点过按钮")
  const html = useMemo(() => buildFullHtml(results), [results])
  const controller = useMemo(() => {
    if (typeof WebViewController === "undefined") return null
    return new WebViewController()
  }, [])
  useEffect(() => {
    if (!controller) { setStatus("WebViewController 不存在"); return }
    controller.loadHTML(html).then((ok) => setStatus(ok ? "网页已加载" : "网页加载返回 false")).catch((e) => setStatus("网页加载失败：" + String(e)))
  }, [controller, html])
  async function doCopy() {
    setStatus("正在写剪贴板…")
    try {
      await Pasteboard.setString(buildFullText(results))
      setStatus("已复制，去别处粘贴试试")
    } catch (e) {
      setStatus("复制失败：" + String(e))
    }
  }
  async function reloadFullText() {
    setStatus("正在加载网页…")
    try {
      if (!controller) throw new Error("WebViewController 不存在")
      const ok = await controller.loadHTML(html)
      setStatus(ok ? "网页已加载" : "网页加载返回 false")
    } catch (e) {
      setStatus("加载失败：" + String(e))
    }
  }
  return (
    <NavigationStack>
      <VStack>
        <Text font="largeTitle" fontWeight={"bold"}>边界探测</Text>
        <Text font="caption">{pass}/{results.length} 通过。FAIL 也是答案，说明这条路走不通。</Text>
        <Text font="caption">状态：{status}</Text>
        <Button title={"点我测试（已点 " + taps + " 次）"} action={() => setTaps(taps + 1)} />
        <Button title="复制完整清单" action={doCopy} />
        <Button title="重新加载全文" action={reloadFullText} />
        {controller ? (
          <WebView controller={controller} frame={{ height: 500 }} />
        ) : (
          <Text font="caption">WebViewController 不存在，全文网页打不开，往下翻看分行清单。</Text>
        )}
        <Spacer />
        {results.map((r) => (
          <Row r={r} />
        ))}
        <Spacer />
        <Text font="caption">上面的网页可以滑动，长按全选复制发我；复制按钮是备用的。</Text>
      </VStack>
    </NavigationStack>
  )
}

// 全文 HTML（内嵌网页用，不再弹新窗口——v1.4 的全屏 present 点着没反应）
function buildFullHtml(results: Result[]): string {
  return "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><style>body{font-family:monospace;font-size:13px;white-space:pre-wrap;word-break:break-word;padding:12px}</style></head><body>" + escapeHtml(buildFullText(results)) + "</body></html>"
}

function Row({ r }: { r: Result }) {
  return (
    <VStack>
      <Text font="headline">{r.pass ? "✅ " : "❌ "}{r.name}</Text>
      <Text font="caption">{r.detail}</Text>
    </VStack>
  )
}

async function run() {
  const results = await runTests()
  await Navigation.present({ element: <App results={results} />, modalPresentationStyle: "pageSheet" })
  Script.exit()
}

run()
