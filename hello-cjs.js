// CJS 格式模块：探测 require 能不能加载本地模块。
// 如果 require("./hello-cjs.js") 能拿到 hello()，就说明 Scripting 支持
// CommonJS 风格的本地模块，纯 JS 库可以直接 require 着用，不用 eval。
module.exports = {
  hello: function () { return "cjs-ok" },
}
