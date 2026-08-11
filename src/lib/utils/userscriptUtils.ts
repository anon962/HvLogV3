import React from "react"
import { createRoot } from "react-dom/client"
// @ts-ignore
import cssRoot from "@/lib/ui/global.css?inline"
import { strip, Unsub } from "myutils"

export interface MountReactOptions {
    target?: {
        hostEl: Element
        styleEl?: HTMLStyleElement
    }
    isDialog?: boolean
    skipStyles?: boolean
}
export async function mountReact<T extends React.JSXElementConstructor<any>>(
    component: T,
    props: React.ComponentProps<T>,
    opts: MountReactOptions = {},
) {
    const sink: Unsub[] = []

    let targetEl: Element
    let styleEl: HTMLStyleElement
    if (opts.target) {
        targetEl = opts.target.hostEl

        if (!opts.skipStyles) {
            let styleEl
            if (!opts.target.styleEl) {
                const el = document.createElement("style")
                styleEl = el
                document.head.appendChild(styleEl)
                sink.push(() => el.remove())
            } else {
                const el = opts.target.styleEl
                const prevStyles = el.innerHTML
                styleEl = el
                sink.push(() => (el.innerHTML = prevStyles))
            }

            styleEl.innerHTML = cssRoot
        }
    } else {
        const hostEl = document.createElement("div")
        hostEl.classList.add("hvlog-shadow")
        const shadowRoot = hostEl.attachShadow({
            mode: "open",
            delegatesFocus: true,
        })
        document.body.appendChild(hostEl)

        shadowRoot.innerHTML = `
            <div class="hvlog-container dialog-container dark">
                <style>
                    :host {
                        all: initial;
                    }

                    ${!opts.skipStyles ? cssRoot : ""}
                </style>
                <div class="hvlog-host h-full w-full">
                </div>
            </div>
        `

        targetEl = shadowRoot.querySelector(".hvlog-host")!
    }

    const rootComponent = React.createElement(component, props)
    const reactEl = createRoot(targetEl)
    reactEl.render(rootComponent)
    sink.push(() => reactEl.unmount())

    targetEl.addEventListener("hvlog:unmount", () => {
        for (const unsub of sink) {
            unsub()
        }
    })

    return reactEl
}

export function readUrl(override?: string) {
    const url = new URL(window.location.href)

    const parts = normalizeUrlParts(
        (override ?? window.location.pathname).split("/"),
    )

    return {
        parts,
        url,
    }
}

export function normalizeUrlParts(parts: string[]) {
    return parts
        .map((part) => strip(part, " /"))
        .filter((part) => part.length > 0)
        .map((part) => part.toLowerCase())
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
