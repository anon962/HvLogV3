// @ts-ignore
import uiBundle from "../dist/ui/src/pages/logViewer/main.html?raw"

import { App } from "./lib/app/app"
import { registerLiveStatsToggle } from "./lib/app/registerLiveStatsToggle"
import { registerViewLogs } from "./lib/app/registerViewLogs"

// @todo: compression
// @todo: live stats
// @todo: config (monaco)
// @todo: turn usage (attacks, debuffs, heals, other)
// @todo: profits

async function main() {
    switch (window.location.pathname) {
        case "/hvlog/logs":
            return await routeLogViewer()
        default:
            return await routeMain()
    }
}

async function routeMain() {
    const app = await App.ainit()

    ;(window as any).HV_LOG = app

    registerLiveStatsToggle(app)
    registerViewLogs(app)
}

async function routeLogViewer() {
    document.write(uiBundle)

    for (const scriptEl of document.querySelectorAll("script")) {
        eval(scriptEl.textContent!)
    }
}

main()
