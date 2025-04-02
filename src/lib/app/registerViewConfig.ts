import { GM_registerMenuCommand } from "vite-plugin-monkey/dist/client"
import { openPath } from "../utils/userscriptUtils"
import { App } from "./app"

export function registerViewConfig(app: App) {
    GM_registerMenuCommand(
        "Settings",
        () => openPath("/hvlog/config"),
        {
            id: "view_settings",
            title: "/hvlog/config",
        }
    )
}
