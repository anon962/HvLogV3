import React from "react"
import { createRoot } from "react-dom/client"

export interface MountReactOptions {
    targetEl?: HTMLElement
}

export async function mountReact<T extends React.JSXElementConstructor<any>>(
    component: T,
    props: React.ComponentProps<T>,
    { targetEl }: MountReactOptions = {},
) {
    if (!targetEl) {
        document.body.innerHTML = `
            <div id="root" className="h-full w-full">

            </div>
        `
        targetEl = document.querySelector<HTMLDivElement>("#root")!
        document.body.classList.add("dark")
        document.title = "HvLog"
    }

    const rootComponent = React.createElement(component, props)
    const reactEl = createRoot(targetEl)
    reactEl.render(rootComponent)

    targetEl.addEventListener("unmountme", () => {
        reactEl.unmount()
        targetEl.remove()
    })

    return reactEl
}

export function readUrl(override?: string) {
    const url = new URL(window.location.href)

    const parts = (override ?? window.location.pathname)
        .split("/")
        .map((part) => part.trim())
        .filter((part) => !!part.length)
        .map((part) => part.toLowerCase())

    return {
        parts,
        url,
    }
}

export type RootComponent<T = {}> = React.FC<{} & T>

export function isChrome() {
    return !!(window as any).chrome
}

const URL_CHANGE_FLAG = Symbol("URL_CHANGE_FLAG")
export function patchUrlChange() {
    const w = window as any
    if (w[URL_CHANGE_FLAG]) {
        return
    }

    w[URL_CHANGE_FLAG] = true

    for (const k of ["pushState", "replaceState"] as const) {
        const fn = window.history[k].bind(window.history)
        window.history[k] = (...args: any[]) => {
            // @ts-ignore
            const result = fn(...args)
            window.dispatchEvent(new Event("hvlog:urlchange"))
            return result
        }
    }
}
