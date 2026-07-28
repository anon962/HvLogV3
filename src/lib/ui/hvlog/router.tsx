import { newContext } from "@/lib/utils/miscUtils"
import { readUrl } from "@/lib/utils/userscriptUtils"
import { AnyFunction, bitmaskToBigint, CustomMap, range } from "myutils"
import { FC, ReactNode, useEffect, useMemo, useState } from "react"

type RouteSelection = { component: ReactNode; hideSidebar?: boolean }
type Sidebar = FC<{ children: ReactNode }>

export function Router(props: {
    routes: CustomMap<
        string[],
        (patt: string[], url: URL) => RouteSelection,
        string
    >
    defaultSidebar?: Sidebar
    defaultRoute?: () => RouteSelection
}) {
    let { parts, url } = ROUTER.useContext()

    let sel
    for (const [patt, factory] of props.routes.entries()) {
        if (!isRouteMatch(patt, parts)) {
            continue
        }

        sel = factory(parts, url)
    }

    if (!sel) {
        console.error("Invalid route", parts)
        if (props.defaultRoute) {
            sel = props.defaultRoute()
        } else {
            sel = { component: <></> }
        }
    }

    if (sel.hideSidebar || !props.defaultSidebar) {
        return sel.component
    } else {
        return <props.defaultSidebar>{sel.component}</props.defaultSidebar>
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

export namespace UrlParamN {
    export type Schema = Record<
        string,
        (
            | {
                  type: "string"
                  skipTrim?: boolean
                  deser?: (x: string | null) => any
              }
            | {
                  type: "string[]"
                  skipTrim?: boolean
                  deser?: (x: string[]) => any
              }
            | {
                  type: "number"
                  asFloat?: boolean
                  deser?: (x: number | null) => any
              }
            | {
                  type: "number[]"
                  asFloat?: boolean
                  deser?: (x: number[]) => any
              }
            | {
                  type: "boolean"
                  deser?: (x: boolean | null) => any
              }
            | {
                  type: "boolean[]"
                  asFloat?: boolean
                  deser?: (x: boolean[]) => any
              }
            | {
                  type: "date"
                  deser?: (x: Date | null) => any
                  ser?: (x: Date) => string
              }
            | {
                  type: "bitmask"
                  deser?: (x: number[]) => any
              }
        ) & {}
    >

    // prettier-ignore
    export type Object<T extends Schema> = {
        [K in keyof T]:
            T[K]['type'] extends 'string' ? Read<T[K] & { type: "string" }, string> :
            T[K]['type'] extends 'string[]' ? Read<T[K] & { type: "string[]" }, string[]> :
            T[K]['type'] extends 'number' ? Read<T[K] & { type: "number" }, number> :
            T[K]['type'] extends 'number[]' ? Read<T[K] & { type: "number[]" }, number[]> :
            T[K]['type'] extends 'boolean' ? Read<T[K] & { type: "boolean" }, boolean> :
            T[K]['type'] extends 'boolean[]' ? Read<T[K] & { type: "boolean[]" }, boolean[]> :
            T[K]['type'] extends 'date' ? Read<T[K] & { type: "date" }, Date> :
            T[K]['type'] extends 'bitmask' ? Read<T[K] & { type: "bitmask" }, number[]> :
            never
    }
    type Read<TSchema extends Schema[string], TValue> = ReadDeser<
        TSchema,
        TValue
    >
    type ReadDeser<T extends Schema[string], V> = T extends {
        deser: infer F
    }
        ? F extends AnyFunction
            ? ReturnType<F>
            : never
        : V extends Array<any>
          ? V
          : V | null

    // prettier-ignore
    export type UpdateObject<T extends Schema> = {
        [K in keyof T]:
            T[K]['type'] extends 'string' ? string | null :
            T[K]['type'] extends 'string[]' ? string[] | null :
            T[K]['type'] extends 'number' ? number | null :
            T[K]['type'] extends 'number[]' ? number[] | null :
            T[K]['type'] extends 'boolean' ? boolean | null :
            T[K]['type'] extends 'boolean[]' ? boolean[] | null :
            T[K]['type'] extends 'date' ? Date | null :
            T[K]['type'] extends 'bitmask' ? Array<0 | 1> | null :
            never
    }
    export interface UpdateOpts {
        history: "push" | "replace"
    }

    export function useUrlParams<T extends Schema>(opts: {
        schema: T
    }): [
        Object<T>,
        (update: Partial<UpdateObject<T>>, opts?: UpdateOpts) => void,
    ] {
        const { url } = ROUTER.useContext()

        const params = useMemo(() => {
            const params = {} as any
            for (const [key, s] of Object.entries(opts.schema)) {
                let v = url.searchParams.get(key)
                let v2: any
                if (v !== null) {
                    switch (s.type) {
                        case "string":
                            v2 = parseString(v, s)
                            break
                        case "string[]":
                            v2 = v
                                .split(",")
                                .map((x) => parseString(x, s))
                                .filter((x) => x !== null)
                            break
                        case "number":
                            v2 = parseNumber(v, s)
                            break
                        case "number[]":
                            v2 = v
                                .split(",")
                                .map((x) => parseNumber(x, s))
                                .filter((x) => x !== null)
                            break
                        case "boolean":
                            v2 = parseBoolean(v, s)
                            break
                        case "boolean[]":
                            v2 = v
                                .split(",")
                                .map((x) => parseBoolean(x, s))
                                .filter((x) => x !== null)
                            break
                        case "date":
                            v2 = parseDate(v, s)
                            break
                        case "bitmask":
                            v2 = parseBitmask(v, s)
                            break
                    }
                }

                switch (s.type) {
                    case "string":
                    case "number":
                    case "boolean":
                    case "date": {
                        // @ts-ignore
                        const v3 = s.deser ? s.deser(v2) : v2
                        params[key] = v3
                        break
                    }
                    case "string[]":
                    case "number[]":
                    case "boolean[]":
                    case "bitmask": {
                        v2 = v2 ?? []
                        // @ts-ignore
                        const v3 = s.deser ? s.deser(v2) : v2
                        params[key] = v3
                        break
                    }
                }
            }

            return params
        }, [url.href])

        const setParams = (
            update: Partial<UpdateObject<T>>,
            opts2?: UpdateOpts,
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
                    case "string[]": {
                        const v2 = v as string[]
                        const v3 = v2
                            .map((x) => (s.skipTrim ? x : x.trim()))
                            .filter((x) => x.length > 0)
                            .join(",")
                        u.searchParams.set(k, v3)
                        break
                    }
                    case "number": {
                        let v2 = v as number
                        u.searchParams.set(k, String(v2))
                        break
                    }
                    case "number[]": {
                        const v2 = v as number[]
                        u.searchParams.set(
                            k,
                            v2.map((x) => String(x)).join(","),
                        )
                        break
                    }
                    case "boolean": {
                        const v2 = v as boolean
                        u.searchParams.set(k, String(+v2))
                        break
                    }
                    case "boolean[]": {
                        const v2 = v as boolean[]
                        u.searchParams.set(
                            k,
                            v2.map((x) => String(+v2)).join(","),
                        )
                        break
                    }
                    case "date": {
                        const v2 = v as Date
                        const v3 = s.ser
                            ? s.ser(v2)
                            : v2.toISOString().slice(0, 10)
                        u.searchParams.set(k, v3)
                        break
                    }
                    case "bitmask": {
                        const v2 = v as Array<0 | 1>
                        const v3 = bitmaskToBigint(v2)
                        if (v3 > 0) {
                            u.searchParams.set(k, String(v3))
                        } else {
                            u.searchParams.delete(k)
                        }
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

        function parseString(
            raw: string,
            s: Schema[string] & { type: "string" | "string[]" },
        ) {
            let x: string | null = raw
            if (!s.skipTrim) {
                x = x.trim()
            }
            return x.length > 0 ? x : null
        }
        function parseNumber(
            raw: string,
            s: Schema[string] & { type: "number" | "number[]" },
        ) {
            let x: number | null = s.asFloat ? parseFloat(raw) : parseInt(raw)
            if (isNaN(x)) {
                x = null
            }
            return x
        }
        function parseBoolean(
            raw: string,
            s: Schema[string] & { type: "boolean" | "boolean[]" },
        ) {
            let x: number | null = parseInt(raw)
            if (!isNaN(x)) {
                return x === 1
            } else {
                return null
            }
        }
        function parseBitmask(
            raw: string,
            s: Schema[string] & { type: "bitmask" },
        ) {
            let x = parseInt(raw)
            if (isNaN(x)) {
                return null
            }
            return x
                .toString(2)
                .split("")
                .reverse()
                .flatMap((x, idx) => (x === "1" ? [idx] : []))
        }
        function parseDate(raw: string, s: Schema[string] & { type: "date" }) {
            let x = new Date(raw + "T00:00:00.000Z")
            if (isNaN(x.getTime())) {
                return null
            }
            return x
        }
    }
}
export const useUrlParams = UrlParamN.useUrlParams
