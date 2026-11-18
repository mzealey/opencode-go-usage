import { transformSync } from "@babel/core"
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"

const runtime = {
  "solid-js": "opentui:runtime-module:solid-js",
  "@opentui/solid": "opentui:runtime-module:%40opentui%2Fsolid",
  "@opencode/plugin/tui": "opentui:runtime-module:%40opencode%2Fplugin%2Ftui",
}

const source = readFileSync("src/tui.tsx", "utf8")
const compiled = transformSync(source, {
  filename: "src/tui.tsx",
  presets: [
    ["@babel/preset-typescript", { onlyRemoveTypeImports: true }],
    ["babel-preset-solid", { generate: "universal", moduleName: "@opentui/solid" }],
  ],
})
if (!compiled?.code) throw new Error("failed to compile src/tui.tsx")

let code = compiled.code
for (const [specifier, virtual] of Object.entries(runtime)) {
  code = code.replaceAll(`from "${specifier}"`, `from "${virtual}"`)
}

const unresolved = code.match(/^\s*import[^\n]*from\s+"(?!opentui:|\.\/|node:)[^"]+"/gm)
if (unresolved) throw new Error(`unexpected imports in compiled tui:\n${unresolved.join("\n")}`)
if (code.includes("jsx-runtime") || code.includes("jsx-dev-runtime")) {
  throw new Error("compiled tui still imports a JSX runtime")
}

mkdirSync("dist", { recursive: true })
writeFileSync("dist/tui.js", `${code}\n`)
for (const file of ["rpc.ts", "usage.ts"]) copyFileSync(`src/${file}`, `dist/${file}`)
console.log("built dist/tui.js")
