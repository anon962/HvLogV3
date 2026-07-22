import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "path"
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
            terserOptions: {
                compress: false,
                mangle: false,
            },
        },
    }
})
