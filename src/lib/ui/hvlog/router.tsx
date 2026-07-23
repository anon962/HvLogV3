import { newContext } from "@/lib/utils/miscUtils"
import { readUrl } from "@/lib/utils/userscriptUtils"
import { AnyFunction, CustomMap, Fn, range } from "myutils"
import { ReactNode, useEffect, useMemo, useState } from "react"

export function Router(props: {
    routes: CustomMap<
        string[],
        (parts: string[], url: URL) => ReactNode,
        string
    >
    defaultRoute?: () => ReactNode
}) {
    let { parts, url } = ROUTER.useContext()

    for (const [patt, factory] of props.routes.entries()) {
        if (!isRouteMatch(patt, parts)) {
            continue
        }

        return factory(parts, url)
    }

    console.error("Invalid route", parts)
    if (props.defaultRoute) {
        return props.defaultRoute()
    } else {
        return <></>
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
}

const URL_CHANGE_EVENT = "urlchange"
const URL_CHANGE_FLAG = Symbol("URL_CHANGE_FLAG")
export const ROUTER = newContext(() => {
    const [data, setData] = useState(readUrl())

    useEffect(() => {
        patchUrlChange()

        const onUrlChange = () => {
            setData(readUrl())
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

    return [data, setData]

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
})

type UrlParamSchema = Record<
    string,
    (
        | {
              type: "string"
              tfm?: (x: string | null) => any
          }
        | {
              type: "number"
              asFloat?: boolean
              tfm?: (x: number | null) => any
          }
        | {
              type: "boolean"
              tfm?: (x: boolean | null) => any
          }
    ) & {
        skipTrim?: boolean
    }
>

// prettier-ignore
type UrlParamObject<T extends UrlParamSchema> = {
    [K in keyof T]:
        T[K]['type'] extends 'string' ? Read<T[K] & { type: "string" }, string> :
        T[K]['type'] extends 'number' ? Read<T[K] & { type: "number" }, number> :
        T[K]['type'] extends 'boolean' ? Read<T[K] & { type: "boolean" }, boolean> :
        never
}
type Read<TSchema extends UrlParamSchema[string], TValue> = ReadTfm<
    TSchema,
    TValue
>
type ReadTfm<T extends UrlParamSchema[string], V> = T extends {
    tfm: infer F
}
    ? F extends AnyFunction
        ? ReturnType<F>
        : never
    : V | null
// prettier-ignore
type UrlParamUpdate<T extends UrlParamSchema> = {
    [K in keyof T]:
        T['type'] extends 'string' ? string | null :
        T['type'] extends 'number' ? number | null :
        T['type'] extends 'boolean' ? boolean | null :
        never
}
interface UrlParamUpdateOpts {
    history: "push" | "replace"
}

export function useUrlParams<T extends UrlParamSchema>(opts: {
    schema: T
}): [
    UrlParamObject<T>,
    (update: Partial<UrlParamObject<T>>, opts?: UrlParamUpdateOpts) => void,
] {
    const { url } = ROUTER.useContext()

    const params = useMemo(() => {
        const params = {} as any
        for (const [key, s] of Object.entries(opts.schema)) {
            let v = url.searchParams.get(key) as any
            if (v !== null) {
                if (!s.skipTrim) {
                    v = v?.trim()
                }

                switch (s.type) {
                    case "string":
                        break
                    case "number": {
                        let v2 = s.asFloat ? parseFloat(v) : parseInt(v)
                        if (!isNaN(v2)) {
                            v = v2
                        } else {
                            v = null
                        }
                        break
                    }
                    case "boolean": {
                        let v2 = parseInt(v)
                        if (!isNaN(v2)) {
                            v = v2 === 1
                        } else {
                            v = null
                        }
                        break
                    }
                }
            }

            if (s.tfm && v !== null) {
                v = s.tfm(v)
            }

            params[key] = v
        }

        return params
    }, [url.href])

    const setParams = (
        update: Partial<UrlParamUpdate<T>>,
        opts2?: UrlParamUpdateOpts,
    ) => {
        const u = new URL(url.href)

        for (let [k, v] of Object.entries(update)) {
            if (v === null) {
                u.searchParams.delete(k)
                continue
            }

            const s = opts.schema[k]

            switch (s.type) {
                case "string": {
                    let v2 = v as string
                    if (!s.skipTrim) {
                        v2 = v2.trim()
                    }
                    u.searchParams.set(k, v2)
                    break
                }
                case "number": {
                    let v2 = v as number
                    u.searchParams.set(k, String(v2))
                    break
                }
                case "boolean": {
                    let v2 = v as boolean
                    u.searchParams.set(k, String(+v2))
                    break
                }
            }
        }

        if (opts2?.history === "replace") {
            window.history.replaceState(null, "", u.href)
        } else {
            window.history.pushState(null, "", u.href)
        }
    }

    return [params, setParams] as any
}
