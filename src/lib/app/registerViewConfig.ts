import {
    GM_registerMenuCommand,
    unsafeWindow,
} from "vite-plugin-monkey/dist/client"
import { App } from "./app"

export function registerViewConfig(app: App) {
    GM_registerMenuCommand(
        "Settings",
        () => {
            const w = (unsafeWindow ?? window).open(
                "/hvlog/config",
                "_blank"
            )
            if (!w) {
                alert(
                    "Unable to open new tab for HvLog. Please enable pop-ups for this site."
                )
                return
            }
        },
        {
            id: "view_settings",
        }
    )
}
