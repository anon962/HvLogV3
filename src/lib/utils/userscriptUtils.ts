import React from "react"
import { createRoot } from "react-dom/client"
import { unsafeWindow } from "vite-plugin-monkey/dist/client"
import { App } from "../app/app"
import { LogDb } from "../logDb/logDb"

export async function mountReact(
    component: RootComponent,
    app: App,
    targetEl?: HTMLElement
) {
    window.HV_LOG_INIT_STYLES()

    const persistentDb = await LogDb.ainit("persistent")
    const isekaiDb = await LogDb.ainit("isekai")

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
        persistentDb,
        isekaiDb,
    })
    const reactEl = createRoot(targetEl)
    reactEl.render(rootComponent)

    targetEl.addEventListener("unmountme", () => {
        reactEl.unmount()
        targetEl.remove()
    })

    return reactEl
}

export function readUrl(override?: string) {
    const parts = (override ?? window.location.pathname)
        .split("/")
        .filter((part) => !!part.length)
        .map((part) => part.toLowerCase())

    let isIsekai = false
    if (parts[0] === "isekai") {
        isIsekai = true
        parts.shift()
    }

    const url = new URL(window.location.href)

    return {
        isIsekai,
        parts,
        params: url.searchParams,
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

export type RootComponent = React.FC<{
    app: App
    persistentDb: LogDb
    isekaiDb: LogDb
}>
