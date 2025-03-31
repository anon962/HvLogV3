import React from "react"
import { createRoot } from "react-dom/client"
import { App } from "./lib/app/app"
import { registerViewLogs } from "./lib/app/registerViewLogs"
import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"

// @todo: combat - usage chart (attacks, debuffs, heals, other)
// @todo: combat - resist distribution (debuffs, other)
// @todo: combat - heal breakdown (hp mp sp)
// @todo: combat - heal breakdown (active, passive)
// @todo: combat - melee casts are PLAYER_ITEMs
// @todo: menu - export / import logs
// @todo: menu - clear localstorage
// @todo: menu - config (monaco)
// @todo: sort
// @todo: filter
// @todo: compression
// @todo: live stats
// @todo: debug flag - disable localstorage reads
// @todo: debug console
// @todo: self-hosted ui
// @todo: heal %maxhp

async function main() {
    const app = await App.ainit()
    window.HV_LOG = app

    registerViewLogs(app)
    // @todo: Doesnt work in ui view
    // registerClearCache(app)

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
