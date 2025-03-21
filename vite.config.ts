import path from "path"
import { defineConfig } from "vite"
import monkey from "vite-plugin-monkey"

export default defineConfig((config) => {
    return {
        plugins: [
            monkey({
                entry: "src/index.ts",
                userscript: {
                    name: "HvLog",
                    match: [
                        "https://hentaiverse.org/*",
                        "http://alt.hentaiverse.org/*",
                    ],
                    grant: [],
                },
            }),
        ],
        test: {
            testTimeout: 30_000,
        },
        build: {
            outDir: "dist/userscript/",
        },
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
    }
})
