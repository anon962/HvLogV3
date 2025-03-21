import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

export default defineConfig((config) => {
    return {
        plugins: [tailwindcss(), react(), viteSingleFile()],
        build: {
            outDir: "dist/ui",
            rollupOptions: {
                input: {
                    app: "./src/pages/logViewer/main.html",
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
