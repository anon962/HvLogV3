import { GM_registerMenuCommand } from "vite-plugin-monkey/dist/client"
import { openPath } from "../utils/userscriptUtils"
import { App } from "./app"

export function registerViewLogs(app: App) {
    GM_registerMenuCommand(
        "Persistent Logs",
        () => openPath("/hvlog/logs"),
        {
            id: "persistent_logs",
            title: "/hvlog/logs",
        }
    )

    GM_registerMenuCommand(
        "Isekai Logs",
        () => openPath("/isekai/hvlog/logs"),
        {
            id: "isekai_logs",
            title: "/isekai/hvlog/logs",
        }
    )
}
