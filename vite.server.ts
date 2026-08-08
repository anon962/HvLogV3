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
            (config.mode === "production" && minifyDeps()) as any,
            prepend(`
                var process = {
                    env: {
                        NODE_ENV: ${JSON.stringify(
                            config.mode === "development"
                                ? "development"
                                : "production",
                        )},
                    },
                };
            `),
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
                entry: path.resolve(__dirname, "src", "server.ts"),
                formats: ["iife"],
                name: "server",
                fileName: () => "server.js",
                cssFileName: "server",
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
