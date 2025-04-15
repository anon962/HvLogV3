import {
    GM_registerMenuCommand,
    unsafeWindow,
} from "vite-plugin-monkey/dist/client"
import { App } from "./app"

export function registerClearCache(app: App) {
    GM_registerMenuCommand(
        "Clear cache",
        () => {
            const localStorageKeys = [
                "hvlog_stats",
                "hvlog_charts",
                "hvlog_selected_log",
                "hvlog_stats_finance",
                "hvlog_summary_view",
                "hvlog_equip_log_filter",
                "react-resizable-panels:hvlog_detail_split",
            ]

            for (const key of localStorageKeys) {
                window.localStorage.removeItem(key)
            }

            unsafeWindow.location.href = window.location.href
        },
        {
            id: "clear_cache",
            title: "Does NOT clear logs / config. Only clears localstorage entries used for tables, graphs, etc. Page will be refreshed.",
        }
    )
}
