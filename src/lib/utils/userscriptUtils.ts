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

    targetEl.addEventListener("unmountme", () => {
        reactEl.unmount()
        targetEl.remove()
    })

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

// Monsterbation clears timers on new round which causes sleep() to never return
// This fixes that by patching clearInterval() to check for any ids that we're using
export const ACTIVE_TIMERS = new Set<number>()
export function patchClearInterval() {
    const clearInterval = unsafeWindow.clearInterval
    unsafeWindow.clearInterval = (id: any) => {
        if (ACTIVE_TIMERS.has(id)) {
            return
        }

        clearInterval(id)
    }
}
export async function sleepWithRegistration(
    t: number
): Promise<void> {
    return new Promise((resolve) => {
        const cb = () => {
            ACTIVE_TIMERS.delete(id)
            resolve()
        }
        let id: any = setTimeout(cb, t)
        ACTIVE_TIMERS.add(id)
    })
}
