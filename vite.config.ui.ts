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
        build: {
            outDir: "dist/ui",
            rollupOptions: {
                input: {
                    app: "./src/lib/ui/hvlog/main.html",
                },
                output: {
                    format: "iife",
                    entryFileNames: "ui.js",
                },
            },
            minify: false,
        },
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
    }
})
