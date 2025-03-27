// @ts-ignore
import entryHtml from "../dist/ui/src/lib/ui/hvlog/main.html?raw"
// @ts-ignore
import entryJs from "../dist/ui/ui.js?raw"

import { App } from "./lib/app/app"
import { registerViewLogs } from "./lib/app/registerViewLogs"

// @todo: combat - turn usage (attacks, debuffs, heals, other)
// @todo: combat - resist distribution
// @todo: combat - heal breakdown (hp mp sp)
// @todo: combat - heal breakdown (active, passive)
// @todo: combat - SoL triggers
// @todo: turnIdx to logIdx2turnIdx, logIdx2roundIdx map
// @todo: menu - export / import logs
// @todo: menu - clear localstorage
// @todo: menu - config (monaco)
// @todo: sort
// @todo: filter
// @todo: compression
// @todo: live stats
// @todo: debug flag - disable localstorage reads
// @todo: debug console

async function main() {
    const app = await App.ainit()
    window.HV_LOG = app

    registerViewLogs(app)
    // @todo: Doesnt work in ui view
    // registerClearCache(app)

    switch (window.location.pathname) {
        case "/hvlog/logs":
            return await routeLogViewer(app)
        default:
            await app.runLogger()
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
