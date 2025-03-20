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
                    grant: ["unsafeWindow"],
                },
            }),
        ],
        test: {
            testTimeout: 30_000,
        },
    }
})
