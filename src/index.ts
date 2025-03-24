import { App } from "./lib/app/app"
import { registerViewLogs } from "./lib/app/registerViewLogs"

// @ts-ignore
import entryHtml from "../dist/ui/src/lib/ui/hvlog/main.html?raw"
// @ts-ignore
import entryJs from "../dist/ui/ui.js?raw"

// @todo: detail view - graphs
// @todo: detail view - turn usage (attacks, debuffs, heals, other)
// @todo: menu - export / import logs
// @todo: menu - clear localstorage
// @todo: menu - config (monaco)
// @todo: profits
// @todo: sort
// @todo: filter
// @todo: prefix alert() errors with HvLog
// @todo: compression
// @todo: live stats
// @todo: debug flag - disable localstorage reads

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
