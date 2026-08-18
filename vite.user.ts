import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import * as esbuild from "esbuild"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import path from "path"
import { minify } from "terser"
import { defineConfig, Plugin, ResolvedConfig } from "vite"

// #region config
export default defineConfig((config) => {
    return {
        plugins: [
            inlineWorkerFunction(),
            tailwindcss(),
            inlineZstdWasm(),
            react({}),
            (config.mode === "production" && minifyDeps()) as any,
            prepend(`
if (typeof unsafeWindow === 'undefined') {
    console.warn('unsafeWindow not defined')
    window.unsafeWindow = {};
} else {
    window.unsafeWindow = unsafeWindow;
}
window.HV_LOG = {};
window.unsafeWindow.HV_LOG = window.HV_LOG;

var process = {
    env: {
        NODE_ENV: ${JSON.stringify(
            config.mode === "development" ? "development" : "production",
        )},
    },
};
            `),
            prepend(
                `
// ==UserScript==
// @name         HvLog
// @version      3.0.0
// @downloadURL  https://github.com/anon962/HvLogV3/releases/download/latest/hvlog.user.js
// @updateURL    https://github.com/anon962/HvLogV3/releases/download/latest/hvlog.user.js
// @match        https://hentaiverse.org/*
// @match        https://alt.hentaiverse.org/*
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// ==/UserScript==    
                `,
            ),
        ],
        worker: {
            format: "es",
            plugins: () => [inlineZstdWasm()],
        },
        test: {
            testTimeout: 30_000,
        },
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        build: {
            minify: false,
            cssMinify: false,
            cssCodeSplit: false,
            emptyOutDir: false,
            lib: {
                entry: path.resolve(__dirname, "src", "userscript.ts"),
                formats: ["iife"],
                name: "hvlog",
                fileName: () => "hvlog.user.js",
            },
            assetsInlineLimit: (filePath) => {
                if (filePath.endsWith(".wasm")) {
                    return true
                }
            },
        },
        optimizeDeps: {
            exclude: ["@bokuweb/zstd-wasm"],
        },
    }
})
// #endregion

// #region minifyDeps
function minifyDeps() {
    const cache: any = {}

    return {
        name: "minify-deps",
        async transform(code: any, id: any) {
            if (!id.includes("node_modules")) {
                return null
            }

            const cacheKey = createHash("sha1").update(code).digest("base64")
            if (!(cacheKey in cache)) {
                const result = await minify(code, {
                    compress: true,
                    mangle: true,
                    format: { beautify: false },
                })
                cache[cacheKey] = result.code || null
            }

            return { code: cache[cacheKey], map: null }
        },
    }
}
// #endregion

// #region prepend
function prepend(x: string) {
    return {
        name: "inject-banner",
        enforce: "post",
        generateBundle(options: any, bundle: any) {
            for (const file of Object.values(bundle) as any[]) {
                if (file.type === "chunk" && file.fileName.endsWith(".js")) {
                    file.code = x.trim() + "\n" + file.code
                }
            }
        },
    }
}
// #endregion

// #region inlineZstdWasm
function inlineZstdWasm(): Plugin {
    let cached: Promise<string> | null = null
    const ID = "virtual:zstd-inline"

    return {
        name: "zstd-inline",
        resolveId: (id) => {
            if (id === ID) {
                return "\0" + ID
            }
        },
        async load(id) {
            if (id !== "\0" + ID) {
                return
            }

            cached ??= esbuild
                .build({
                    entryPoints: [
                        fileURLToPath(
                            new URL(
                                "./node_modules/@bokuweb/zstd-wasm/dist/esm/index.web.js",
                                import.meta.url,
                            ),
                        ),
                    ],
                    bundle: true,
                    format: "iife",
                    globalName: "zstdWasm",
                    write: false,
                    target: "es2020",
                    define: {
                        "import.meta.url": '"https://blah.blah/"',
                    },
                })
                .then((r) => r.outputFiles[0].text)

            return `export default ${JSON.stringify(await cached)};`
        },
    }
}
// #endregion

// #region inlineWorkerFunction
function inlineWorkerFunction(): Plugin {
    const FN_RE = /\?workerfn(?:=([A-Za-z_$][\w$]*))?$/

    let config: ResolvedConfig
    const cache: any = {}

    return {
        name: "inline-worker-function",
        enforce: "pre",

        configResolved(c) {
            config = c
        },

        async resolveId(id, importer) {
            const m = FN_RE.exec(id)
            if (!m) return null

            const r = await this.resolve(id.slice(0, m.index), importer, {
                skipSelf: true,
            })
            return r ? r.id + m[0] : null
        },

        async load(id) {
            const m = FN_RE.exec(id)
            if (!m) return null

            if (id in cache) {
                return cache[id]
            }
            console.log(`Rebuilding worker function ${id}`)

            const entry = id.slice(0, m.index)
            const name = m[1] ?? "default"
            const proxySrc = `export { ${name} as default } from ${JSON.stringify(entry)}`

            try {
                const out = await esbuild.build({
                    stdin: {
                        contents: proxySrc,
                        resolveDir: path.dirname(entry),
                        loader: "js",
                    },
                    bundle: true,
                    write: false,
                    metafile: true,
                    format: "iife",
                    globalName: "__FN__",
                    target: "es2022",
                    tsconfig: "./tsconfig.json",
                    define: {
                        ...config.define,
                        "import.meta.url": "self.location.href",
                    },
                    plugins: [
                        {
                            name: "stub-css",
                            setup(b) {
                                b.onResolve(
                                    { filter: /\.css(\?.*)?$/ },
                                    (args) => ({
                                        path: args.path,
                                        namespace: "css-stub",
                                    }),
                                )
                                b.onLoad(
                                    { filter: /.*/, namespace: "css-stub" },
                                    () => ({
                                        contents: "export default ''",
                                        loader: "js",
                                    }),
                                )
                            },
                        },
                    ],
                })

                const code = out.outputFiles[0].text.replace(
                    /^var\s+__FN__\s*=\s*/,
                    "",
                )
                for (const dep of Object.keys(out.metafile.inputs)) {
                    if (path.isAbsolute(dep)) this.addWatchFile(dep)
                }

                cache[id] =
                    `export default ${JSON.stringify(`(${code}).default`)}\n`
                return cache[id]
            } catch (e) {
                this.error(
                    `failed to inline worker function ${name} from ${entry}: ${e instanceof Error ? e.message : e}`,
                )
            }
        },
    }
}
// #endregion

// function inlineWorkerFunction2(): Plugin {
//     const FN_RE = /\?workerfn(?:=([A-Za-z_$][\w$]*))?$/

//     let config: ResolvedConfig
//     const cache: any = {}

//     return {
//         name: "inline-worker-function",
//         enforce: "pre",

//         configResolved(c) {
//             config = c
//         },

//         async resolveId(id, importer) {
//             const m = FN_RE.exec(id)
//             if (!m) return null

//             const r = await this.resolve(id.slice(0, m.index), importer, {
//                 skipSelf: true,
//             })
//             return r ? r.id + m[0] : null
//         },

//         async load(id) {
//             const m = FN_RE.exec(id)
//             if (!m) return null

//             if (id in cache) {
//                 return cache[id]
//             }

//             const entry = id.slice(0, m.index)
//             const name = m[1] ?? "default"

//             const proxyId = path.join(
//                 path.dirname(entry),
//                 `__workerfn_${name}__.js`,
//             )
//             const proxySrc = `export { ${name} as default } from ${JSON.stringify(entry)}`

//             let result: Awaited<ReturnType<typeof build>>
//             try {
//                 result = (await build({
//                     configFile: false,
//                     logLevel: "warn",
//                     resolve: { alias: config.resolve.alias },
//                     define: {
//                         ...config.define,
//                         "import.meta.url": "self.location.href",
//                     },
//                     plugins: [
//                         {
//                             name: "workerfn-proxy-entry",
//                             resolveId: (i) => (i === proxyId ? proxyId : null),
//                             load: (i) => (i === proxyId ? proxySrc : null),
//                         },
//                     ],
//                     build: {
//                         write: false,
//                         target: "es2022",
//                         minify: config.build.minify,
//                         assetsInlineLimit: config.build.assetsInlineLimit,
//                         lib: {
//                             entry: proxyId,
//                             name: "__FN__",
//                             formats: ["iife"],
//                             fileName: () => "fn.js",
//                         },
//                         rollupOptions: {
//                             output: {
//                                 inlineDynamicImports: true,
//                                 extend: false,
//                                 exports: "default",
//                             },
//                         },
//                     },
//                 })) as Rollup.RollupOutput
//             } catch (e) {
//                 this.error(
//                     `failed to inline worker function ${name} from ${entry}: ${e instanceof Error ? e.message : e}`,
//                 )
//             }

//             const outputs = (
//                 Array.isArray(result!) ? result! : [result!]
//             ) as Rollup.RollupOutput[]

//             const chunk = outputs[0].output.find(
//                 (o): o is Rollup.OutputChunk => o.type === "chunk" && o.isEntry,
//             )
//             if (!chunk) {
//                 this.error(`no entry chunk produced for ${name} from ${entry}`)
//                 return
//             }

//             for (const dep of Object.keys(chunk.modules)) {
//                 if (dep !== proxyId && path.isAbsolute(dep))
//                     this.addWatchFile(dep)
//             }

//             const stripped = chunk.code.replace(/^var\s+[\w$]+\s*=\s*/, "")
//             if (stripped === chunk.code) {
//                 this.error(`invalid iife`)
//             }

//             cache[id] = `export default ${JSON.stringify(stripped)}\n`
//             return cache[id]
//         },
//     }
// }
