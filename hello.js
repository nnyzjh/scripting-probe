// 动态 import 探测用的本地模块：能被 index.tsx 动态 import 成功，
// 就说明 Scripting 支持多文件项目 + 本地 ESM 模块，纯 JS 库可以打包着用。
export function hello() {
  return "lib-ok"
}
