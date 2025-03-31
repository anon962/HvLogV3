import React from "react"
import { createRoot } from "react-dom/client"
import { App } from "./lib/app/app"
import { registerClearCache } from "./lib/app/registerClearCache.ts"
import { registerViewLogs } from "./lib/app/registerViewLogs"
import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"

// @todo: menu - export / import logs
// @todo: menu - clear localstorage
// @todo: combat - heal breakdown (hp mp sp)
// @todo: combat - heal breakdown (active, passive)
// @todo: combat - usage chart (attacks, debuffs, heals, other)
// @todo: menu - config (monaco)
// @todo: isekai
// @todo: compression

// @todo: sort
// @todo: filter
// @todo: live stats
// @todo: debug flag - disable localstorage reads
// @todo: debug console
// @todo: self-hosted ui
// @todo: heal %maxhp

async function main() {
    const app = await App.ainit()
    window.HV_LOG = app

    registerViewLogs(app)
    registerClearCache(app)

    switch (window.location.pathname) {
        case "/hvlog/logs":
            return await routeUi(app)
        default:
            await app.runLogger()
    }
}

declare global {
    interface Window {
        HV_LOG: App
    }
}

async function routeUi(app: App) {
    const rootEl = document.createElement("div")
    document.body.innerHTML = rootEl.outerHTML

    const rootComponent = React.createElement(HvLog)
    createRoot(document.querySelector("body > div")!).render(
        rootComponent
    )

    document.body.classList.add("dark")
    document.title = "HvLog"
}

main()
