import { unsafeWindow } from "vite-plugin-monkey/dist/client"

import { App } from "./lib/app/app"
import { registerLiveStatsToggle } from "./lib/app/registerLiveStatsToggle"
import { registerViewLogs } from "./lib/app/registerViewLogs"

// @ts-ignore
import uiBundle from "../dist/ui/src/pages/logViewer/main.html?raw"

// @todo: compression
// @todo: live stats
// @todo: config (monaco)
// @todo: turn usage (attacks, debuffs, heals, other)
// @todo: profits

async function main() {
    const app = await App.ainit()
    unsafeWindow.HV_LOG = app

    registerLiveStatsToggle(app)
    registerViewLogs(app)

    switch (window.location.pathname) {
        case "/hvlog/logs":
            return await routeLogViewer()
    }
}

declare global {
    interface Window {
        HV_LOG: App
    }
}

async function routeLogViewer() {
    document.write(uiBundle)

    // <script>s don't auto run for some reason
    for (const scriptEl of document.querySelectorAll("script")) {
        eval(scriptEl.textContent!)
    }
}

main()
