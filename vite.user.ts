import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { build } from "esbuild"
import { fileURLToPath } from "node:url"
import path from "path"
import { minify } from "terser"
import { defineConfig, Plugin } from "vite"

export default defineConfig((config) => {
    return {
        plugins: [
            tailwindcss(),
            inlineZstdWasm(),
            react({
                babel: {
                    minified: false,
                },
            }),
            // cssInjectedByJsPlugin(),
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

function minifyDeps() {
    return {
        name: "minify-deps",
        async transform(code: any, id: any) {
            if (!id.includes("node_modules")) {
                return null
            }

            const result = await minify(code, {
                compress: true,
                mangle: true,
                format: { beautify: false },
            })
            if (!result.code) {
                return null
            }

            return { code: result.code, map: null }
        },
    }
}

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

            cached ??= build({
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
            }).then((r) => r.outputFiles[0].text)

            return `export default ${JSON.stringify(await cached)};`
        },
    }
}
