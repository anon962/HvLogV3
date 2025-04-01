import { isEqual } from "radash"
import React, { FunctionComponent } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./lib/app/app"
import { registerClearCache } from "./lib/app/registerClearCache.ts"
import { registerViewLogs } from "./lib/app/registerViewLogs"
import { ConfigEditor } from "./lib/ui/configEditor/configEditor.tsx"
import { HvLog } from "./lib/ui/hvlog/hvLog.tsx"
import { readUrlPath } from "./lib/utils/miscUtils.ts"

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

    registerViewLogs(app)
    registerClearCache(app)

    const path = readUrlPath().parts

    if (isEqual(path, ["hvlog", "logs"])) {
        return await mountReact(HvLog, app)
    } else if (isEqual(path, ["hvlog", "config"])) {
        return await mountReact(ConfigEditor, app)
    } else {
        await app.runLogger()
    }
}

declare global {
    interface Window {
        HV_LOG: App
        HV_LOG_INIT_STYLES: () => void
    }
}

async function mountReact(
    component: FunctionComponent<{ app: App }>,
    app: App
) {
    window.HV_LOG_INIT_STYLES()

    document.body.innerHTML = `
        <div id="root" className="h-full w-full">

        </div>
    `

    const rootComponent = React.createElement(component, {
        app,
    })
    createRoot(document.querySelector("#root")!).render(rootComponent)

    document.body.classList.add("dark")
    document.title = "HvLog"
}

main()
