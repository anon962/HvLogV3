import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vite"
import monkey from "vite-plugin-monkey"

export default defineConfig((config) => {
    return {
        plugins: [
            tailwindcss(),
            react({
                babel: {
                    minified: false,
                },
            }),
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
                build: {
                    cssSideEffects: () => {
                        return (styles) => {
                            function initCss(styles: string) {
                                console.debug(
                                    "Loading HvLog CSS",
                                    styles
                                )

                                if (
                                    // @ts-ignore
                                    typeof GM_addStyle == "function"
                                ) {
                                    // @ts-ignore
                                    GM_addStyle(styles)
                                    return
                                } else {
                                    const o =
                                        document.createElement(
                                            "style"
                                        )
                                    o.textContent = styles
                                    document.head.append(o)
                                }
                            }

                            // @ts-ignore
                            window.HV_LOG_INIT_STYLES = () =>
                                initCss(styles)
                        }
                    },
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
    }
})
