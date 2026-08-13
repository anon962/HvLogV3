import { newContext } from "@/lib/utils/miscUtils"
import {
    normalizeUrlParts,
    patchUrlChange,
    readUrl,
} from "@/lib/utils/userscriptUtils"
import { AnyFunction, bitmaskToBigint, CustomMap, L, range } from "myutils"
import {
    ComponentPropsWithoutRef,
    FC,
    MouseEvent,
    ReactNode,
    useEffect,
    useMemo,
    useState,
} from "react"

type RouteSelection = { component: ReactNode; hideSidebar?: boolean }
type Sidebar = FC<{ children: ReactNode }>
export type RouteDef = (
    patt: string[],
    url: URL,
) => RouteSelection | { redirect: string[] }

// #region router
export function Router(props: {
    routes: CustomMap<
        string[],
        (patt: string[], url: URL) => RouteSelection | { redirect: string[] },
        string
    >
    prefix?: string[]
    defaultSidebar?: Sidebar
    defaultRoute?: () => RouteSelection
}) {
    let { parts, url } = ROUTER.useContext()
    const prefix = useMemo(
        () => normalizeUrlParts(props.prefix ?? []),
        [props.prefix],
    )
    useEffect(() => {
        ROUTER.setValue((x) => ({ ...x, prefix }))
    }, [prefix])

    const [partsPrefix, partsRem] = useMemo(
        () => [parts.slice(0, prefix.length), parts.slice(prefix.length)],
        [parts, prefix],
    )

    let sel: RouteSelection | null = null
    if (!!isRouteMatch(prefix, partsPrefix)) {
        for (const [patt, factory] of props.routes.entries()) {
            if (!isRouteMatch(patt, partsRem)) {
                continue
            }

            const x = factory(partsRem, url)
            if ("redirect" in x) {
                window.history.replaceState(
                    null,
                    "",
                    "/" + [prefix, ...x.redirect].join("/"),
                )
                return <></>
            } else {
                sel = x
            }
        }
    }

    if (!sel) {
        L.error("Invalid route", parts)
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

export const ROUTER = newContext(() => {
    const [data, setData] = useState({ prefix: [] as string[], ...readUrl() })

    useEffect(() => {
        patchUrlChange()

        const onUrlChange = () => {
            setData((x) => ({ ...x, ...readUrl() }))
        }

        window.addEventListener("popstate", onUrlChange)
        window.addEventListener("hvlog:urlchange", onUrlChange)
        window.addEventListener("hashchange", onUrlChange)

        return () => {
            window.removeEventListener("popstate", onUrlChange)
            window.removeEventListener("hvlog:urlchange", onUrlChange)
            window.removeEventListener("hashchange", onUrlChange)
        }
    }, [])

    return [data, setData]
})
// #endregion

// #region RouteLink
export function RouteLink({
    children,
    onClick,
    href,
    ignorePrefix,
    ...props
}: ComponentPropsWithoutRef<"a"> & {
    ignorePrefix?: boolean
}) {
    const { prefix } = ROUTER.useContext()

    const hrefResolved = useMemo(
        () =>
            "/" +
            normalizeUrlParts([
                ...(ignorePrefix ? [] : prefix),
                href ?? "",
            ]).join("/"),
        [prefix, href],
    )

    return (
        <a onClick={onClickHijack} {...props} href={hrefResolved}>
            {children}
        </a>
    )

    function onClickHijack(ev: MouseEvent<HTMLAnchorElement>) {
        onClick?.(ev)
        if (ev.defaultPrevented) return

        const isModified =
            ev.metaKey ||
            ev.ctrlKey ||
            ev.shiftKey ||
            ev.altKey ||
            ev.button !== 0

        if (!isModified && props.target !== "_blank" && hrefResolved) {
            ev.preventDefault()
            history.pushState(null, "", hrefResolved)
        }
    }
}
// #endregion

// #region UrlParamN
export namespace UrlParamN {
    export type Schema = Record<
        string,
        (
            | {
                  type: "string"
                  skipTrim?: boolean
                  allowEmpty?: boolean
                  deser?: (x: string | null) => any
              }
            | {
                  type: "string[]"
                  skipTrim?: boolean
                  allowEmpty?: boolean
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
        Record<string, string>,
    ] {
        const { url } = ROUTER.useContext()

        const [parsedParams, rawParams] = useMemo(() => {
            const raw = {} as any
            const parsed = {} as any
            for (const [key, s] of Object.entries(opts.schema)) {
                let v = url.searchParams.get(key)
                let v2: any
                if (v !== null) {
                    raw[key] = v

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

                    parsed[key] = v2
                }
            }

            return [parsed, raw]
        }, [url.href])

        const params = useMemo(() => {
            const x = { ...parsedParams }

            for (const [key, s] of Object.entries(opts.schema)) {
                switch (s.type) {
                    case "string":
                    case "number":
                    case "boolean":
                    case "date": {
                        if (key in x && s.deser) {
                            x[key] = s.deser(x[key])
                        } else if (!(key in x)) {
                            x[key] = null
                        }
                        break
                    }
                    case "string[]":
                    case "number[]":
                    case "boolean[]":
                    case "bitmask": {
                        if (!(key in x)) {
                            x[key] = []
                        }
                        if (s.deser) {
                            x[key] = s.deser(x[key])
                        }
                        break
                    }
                }
            }

            return x
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
                            .filter((x) => x.length > 0 || s.allowEmpty)
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

        return [params, setParams, rawParams] as any

        function parseString(
            raw: string,
            s: Schema[string] & { type: "string" | "string[]" },
        ) {
            let x: string | null = raw
            if (!s.skipTrim) {
                x = x.trim()
            }
            return x.length > 0 || s.allowEmpty ? x : null
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
// #endregion
