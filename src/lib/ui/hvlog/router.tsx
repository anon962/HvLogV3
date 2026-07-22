import { readUrl } from "@/lib/utils/userscriptUtils"
import { CustomMap, range } from "myutils"
import { ReactNode, useEffect, useState } from "react"

export function Router(props: {
    routes: CustomMap<string[], (parts: string[]) => ReactNode, string>
    defaultRoute?: () => ReactNode
}) {
    let parts = useUrlParts()

    for (const [patt, factory] of props.routes.entries()) {
        if (!isRouteMatch(patt, parts)) {
            continue
        }

        return factory(parts)
    }

    console.error("Invalid route", parts)
    if (props.defaultRoute) {
        return props.defaultRoute()
    } else {
        return <></>
    }
}

const URL_CHANGE_EVENT = "urlchange"
const URL_CHANGE_FLAG = Symbol("URL_CHANGE_FLAG")
function useUrlParts(): string[] {
    const [parts, setParts] = useState<string[]>(readUrl().parts)

    useEffect(() => {
        patchUrlChange()

        const onUrlChange = () => {
            setParts(readUrl().parts)
        }

        window.addEventListener("popstate", onUrlChange)
        window.addEventListener(URL_CHANGE_EVENT, onUrlChange)
        window.addEventListener("hashchange", onUrlChange)

        return () => {
            window.removeEventListener("popstate", onUrlChange)
            window.removeEventListener(URL_CHANGE_EVENT, onUrlChange)
            window.removeEventListener("hashchange", onUrlChange)
        }
    }, [])

    return parts

    function patchUrlChange() {
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
                window.dispatchEvent(new Event(URL_CHANGE_EVENT))
                return result
            }
        }
    }
}

function isRouteMatch(patt: string[], parts: string[]) {
    if (patt.length !== parts.length) {
        return null
    }

    for (let idx of range(patt.length)) {
        const seg = patt[idx]
        if (seg === "*") continue
        if (seg !== parts[idx]) return null
    }

    return parts
}
