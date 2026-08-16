import { isSomeEqual } from "myutils"

export function registerViewLogs(init: (w: Window) => Promise<void>) {
    window.GM_registerMenuCommand(
        "View Logs",
        () => {
            let w: Window
            if (
                isSomeEqual(window.HV_LOG.userscriptConfig.samePageLoad, [
                    "default",
                    "always",
                ])
            ) {
                w = window
                w.history.pushState(null, "", "/hvlog/logs")
                init(w)
            } else {
                const tab = window.open("/hvlog/logs", "_blank")
                if (!tab) {
                    alert(
                        "Cannot open tab, probably a popup blocker / permission issue.",
                    )
                    return
                }
                w = tab
            }
        },
        {
            id: "view_logs",
        },
    )
}
