import {
    GM_registerMenuCommand,
    unsafeWindow,
} from "vite-plugin-monkey/dist/client"
import { App } from "./app"

export function registerViewLogs(app: App) {
    GM_registerMenuCommand(
        "View battle logs",
        () => {
            const w = (unsafeWindow ?? window).open(
                "/hvlog/logs",
                "_blank"
            )
            if (!w) {
                alert(
                    "Unable to open new tab. Please enable pop-ups for this site."
                )
                return
            }
        },
        {
            id: "view_logs",
            title: "View",
        }
    )
}
