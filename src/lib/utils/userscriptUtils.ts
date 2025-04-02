import React, { FunctionComponent } from "react"
import { createRoot } from "react-dom/client"
import { unsafeWindow } from "vite-plugin-monkey/dist/client"
import { App } from "../app/app"

export function mountReact(
    component: FunctionComponent<{ app: App }>,
    app: App,
    targetEl?: HTMLElement
) {
    window.HV_LOG_INIT_STYLES()

    if (!targetEl) {
        document.body.innerHTML = `
            <div id="root" className="h-full w-full">

            </div>
        `
        targetEl = document.querySelector<HTMLDivElement>("#root")!
        document.body.classList.add("dark")
        document.title = "HvLog"
    }

    const rootComponent = React.createElement(component, {
        app,
    })
    const reactEl = createRoot(targetEl)
    reactEl.render(rootComponent)

    return reactEl
}

export function readUrlPath() {
    const parts = window.location.pathname
        .split("/")
        .filter((part) => !!part.length)
        .map((part) => part.toLowerCase())

    let isIsekai = false
    if (parts[0] === "isekai") {
        isIsekai = true
        parts.shift()
    }

    return {
        isIsekai,
        parts,
    }
}

export function openPath(path: string) {
    const w = (unsafeWindow ?? window).open(path, "_blank")
    if (!w) {
        alert(
            "Unable to open new tab for HvLog. Please enable pop-ups for this site."
        )
        return
    }
}
