import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "path"
import { minify } from "terser"
import { defineConfig } from "vite"
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js"

export default defineConfig((config) => {
    return {
        plugins: [
            tailwindcss(),
            react({
                babel: {
                    minified: false,
                },
            }),
            cssInjectedByJsPlugin(),
            (config.mode === "production" && minifyDeps()) as any,
            prepend(`
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
