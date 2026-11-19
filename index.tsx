// Scripting 能力边界探测（index.tsx）
// 在手机上运行，逐项测：eval、动态 import、远程拉代码现跑、JSZip 解压、环境指纹。
// 每一项都是 PASS/FAIL，FAIL 也是答案——说明这条路走不通，不用再试。
// 注意：编辑器里飘红不一定是报错，先看跑出来的结果。

import { Navigation, NavigationStack, VStack, Spacer, Text, Script } from "scripting"

type Result = { name: string; pass: boolean; detail: string }

const JSZIP_URL = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"
const RAW_JSON_URL = "https://raw.githubusercontent.com/nnyzjh/cloudflare-scripting/main/script.json"

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

  // 1. 环境指纹：只看有什么，不判断
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
      " fetch:" + typeof fetch,
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

  // 5. eval 远程拉下来的代码
  out.push(await one("eval 远程代码（JSZip）", () => {
    if (!jszipText) throw new Error("前面 fetch 失败，没拿到代码")
    eval(jszipText)
    const C = (globalThis as any).JSZip
    if (typeof C !== "function") throw new Error("eval 完了但 globalThis.JSZip 不是函数")
    return "JSZip 已挂到 globalThis"
  }))

  // 6. JSZip 压缩+解压闭环
  out.push(await one("JSZip 压缩再解压", async () => {
    const C = (globalThis as any).JSZip
    if (typeof C !== "function") throw new Error("JSZip 没加载")
    const zip = new C()
    zip.file("hello.txt", "hi")
    const buf = await zip.generateAsync({ type: "uint8array" })
    const zip2 = await C.loadAsync(buf)
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

  // 8. fetch GitHub raw JSON
  out.push(await one("fetch GitHub raw JSON", async () => {
    const r = await fetch(RAW_JSON_URL, { timeout: 15 })
    if (!r.ok) throw new Error("HTTP " + r.status)
    const j = await r.json()
    if (!j.name) throw new Error("没有 name 字段")
    return "读到仓库 script.json，name=" + j.name
  }))

  // 9. Uint8Array + Data
  out.push(await one("Uint8Array + Data", () => {
    const u = new Uint8Array([104, 105])
    if (u[0] !== 104 || u[1] !== 105) throw new Error("Uint8Array 不对")
    const d = Data.fromArrayBuffer(u.buffer)
    if (!d) throw new Error("Data.fromArrayBuffer 返回空")
    return "二进制数据可用"
  }))

  // 10. TextEncoder/TextDecoder
  out.push(await one("TextEncoder 往返", () => {
    const enc = new TextEncoder()
    const dec = new TextDecoder()
    const s = dec.decode(enc.encode("你好 Scripting"))
    if (s !== "你好 Scripting") throw new Error("编解码不一致")
    return "中文编解码正常"
  }))

  return out
}

function Row({ r }: { r: Result }) {
  return (
    <VStack>
      <Text font="headline">{r.pass ? "✅ " : "❌ "}{r.name}</Text>
      <Text font="caption">{r.detail}</Text>
    </VStack>
  )
}

function App({ results }: { results: Result[] }) {
  const pass = results.filter((r) => r.pass).length
  return (
    <NavigationStack>
      <VStack>
        <Text font="largeTitle" fontWeight={"bold"}>边界探测</Text>
        <Text font="caption">{pass}/{results.length} 通过。FAIL 也是答案，说明这条路走不通。</Text>
        <Spacer />
        {results.map((r) => (
          <Row r={r} />
        ))}
        <Spacer />
        <Text font="caption">把结果截图发我，我再帮你判断哪条路能走。</Text>
      </VStack>
    </NavigationStack>
  )
}

async function run() {
  const results = await runTests()
  await Navigation.present({ element: <App results={results} />, modalPresentationStyle: "pageSheet" })
  Script.exit()
}

run()
