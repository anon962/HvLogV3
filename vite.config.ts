import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "path"
import { minify } from "terser"
import { defineConfig } from "vite"

export default defineConfig((config) => {
    return {
        plugins: [
            tailwindcss(),
            react({
                babel: {
                    minified: false,
                },
            }),
            config.mode === "production" && minifyDeps(),
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
                entry: path.resolve(__dirname, "src/index.ts"),
                formats: ["iife"],
                name: "weblog",
                fileName: () => "web-log.js",
                // fileName: () => "tmp.js", // @DEBUG
            },
            rollupOptions: {
                output: {
                    banner: `
                        var process = {
                            env: {
                                NODE_ENV: ${JSON.stringify(
                                    config.mode === "development"
                                        ? "development"
                                        : "production",
                                )},
                            },
                        };
                    `,
                },
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
