import { App } from "./lib/app/app"
import { registerViewLogs } from "./lib/app/registerViewLogs"

// @ts-ignore
import entryHtml from "../dist/ui/src/pages/logViewer/main.html?raw"
// @ts-ignore
import entryJs from "../dist/ui/ui.js?raw"

// @todo: compression
// @todo: live stats
// @todo: config (monaco)
// @todo: turn usage (attacks, debuffs, heals, other)
// @todo: profits
// @todo: export / import logs
// @todo: prefix alert() errors with HvLog
// @todo: test turn split

async function main() {
    const app = await App.ainit()
    window.HV_LOG = app

    // registerLiveStatsToggle(app)
    registerViewLogs(app)

    switch (window.location.pathname) {
        case "/hvlog/logs":
            return await routeLogViewer(app)
    }
}

declare global {
    interface Window {
        HV_LOG: App
    }
}

async function routeLogViewer(app: App) {
    document.write(entryHtml)
    eval(entryJs)
}

main()
