import { HvLog } from "@/lib/ui/hvlog/hvLog"
import { mountReact } from "@/lib/utils/miscUtils"

export function registerViewLogs() {
    window.GM_registerMenuCommand(
        "View Logs",
        () => {
            const tab = window.open("/hvlog/logs", "_blank")
            if (!tab) {
                alert(
                    "Cannot open tab, probably a popup blocker / permission issue.",
                )
                return
            }

            const d = tab.document
            d.body.className = "hvlog-container dark"
            d.body.innerHTML = `<div class="hvlog-host"></div>`

            mountReact(
                HvLog,
                {},
                {
                    target: {
                        document: d,
                        hostEl: d.querySelector(".hvlog-host")!,
                    },
                },
            )
        },
        {
            id: "view_logs",
        },
    )
}
