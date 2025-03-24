import {
    GM_registerMenuCommand,
    unsafeWindow,
} from "vite-plugin-monkey/dist/client"
import { App } from "./app"

export function registerClearCache(app: App) {
    GM_registerMenuCommand(
        "Clear cache",
        () => {
            console.log("wtf")
            unsafeWindow.localStorage.removeItem("hvlog_stats")
            unsafeWindow.location.href = window.location.href
        },
        {
            id: "clear_cache",
            title: "Does not clear logs / config. Only clears caches used for log summary, graphs, etc. Page will be refreshed.",
        }
    )
}
