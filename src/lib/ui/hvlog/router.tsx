import {
    alphabetical,
    AnyFunction,
    bitmaskToBigint,
    CustomMap,
    waitUntilStable,
    L,
    newContext,
    normalizeUrlParts,
    patchUrlChange,
    range,
    readUrl,
    UrlChangeEvent,
    last,
    mapEntries,
} from "myutils"
import {
    ComponentPropsWithoutRef,
    FC,
    MouseEvent,
    ReactNode,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { IS_REMOTE } from "../../constants"

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
    let { url, partsFull, partsPrefix, partsPath } = ROUTER.useContext()
    const prefix = useMemo(
        () => normalizeUrlParts(props.prefix ?? []),
        [props.prefix],
    )
    useEffect(() => {
        ROUTER.setValue((x) => ({
            ...x,
            ...readUrlWithPrefix(prefix),
        }))
    }, [prefix])

    useScrollRestoration()

    let sel: RouteSelection | null = null
    if (!!isRouteMatch(prefix, partsPrefix)) {
        for (const [patt, factory] of props.routes.entries()) {
            if (!isRouteMatch(patt, partsPath)) {
                continue
            }

            const x = factory(partsPath, url)
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
        L.error("Invalid route", partsFull)
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

// #region useScrollState
function useScrollRestoration() {
    const scrollPos = useRef(
        new Map<
            string,
            Map<string, { scrollTop: number; scrollLeft: number }>
        >(),
    )
    const m = scrollPos.current

    let timerId: any = 0
    const cancelTimer = () => {
        clearTimeout(timerId)
    }

    useEffect(() => {
        const trackScrollPos = (ev: Event) => {
            const tgt = ev.target
            if (!(tgt instanceof HTMLElement)) {
                return
            }

            let curr: HTMLElement | null = tgt
            let path = []
            while (curr instanceof HTMLElement) {
                let elHash = curr.tagName
                if (curr.classList.length > 0) {
                    elHash += `[class="${curr.className}"]`
                }

                path.push(elHash)
                curr = curr.parentElement
            }

            const elHash = path.reverse().join(" ")

            const { url } = readUrl()
            const locHash = url.pathname + url.search
            if (!m.has(locHash)) {
                m.set(locHash, new Map())
            }

            cancelTimer()
            timerId = setTimeout(() => {
                m.get(locHash)!.set(elHash, {
                    scrollTop: tgt.scrollTop,
                    scrollLeft: tgt.scrollLeft,
                })
            }, 10)
        }

        document.addEventListener("scroll", trackScrollPos, true)
        document.addEventListener("hvlog:urlchange", cancelTimer)
        return () => {
            document.removeEventListener("scroll", trackScrollPos)
            document.removeEventListener("hvlog:urlchange", cancelTimer)
        }
    }, [])

    useEffect(() => {
        const restoreScrollPos = () => {
            const { url } = readUrl()
            const locHash = url.pathname + url.search

            const tgts = m.get(locHash)
            if (!tgts) {
                return
            }

            for (const [
                selector,
                { scrollTop, scrollLeft },
            ] of tgts.entries()) {
                waitUntilStable<{ el: Element; top: number; left: number }>({
                    parse: async () => {
                        const el = document.querySelector(selector)
                        if (!el) {
                            return null
                        }

                        return {
                            el,
                            top: el.scrollTop,
                            left: el.scrollLeft,
                        }
                    },
                    stable: (prev, curr) => {
                        return (
                            prev.el === curr.el &&
                            prev.top === curr.top &&
                            prev.left === curr.left
                        )
                    },
                    minStableFrames: 2,
                    timeout: 1000,
                }).then((x) =>
                    x.state?.el.scrollTo({ top: scrollTop, left: scrollLeft }),
                )
            }
        }

        window.addEventListener("popstate", restoreScrollPos)
        return () => window.removeEventListener("popstate", restoreScrollPos)
    }, [])
}
// #endregion

// #region ROUTER
export const ROUTER = newContext(() => {
    const [value, setValue] = useState({
        ...readUrlWithPrefix(IS_REMOTE ? [] : ["hvlog"]),
        history: [readUrlWithPrefix(IS_REMOTE ? [] : ["hvlog"])],
    })

    useEffect(() => {
        const onUrlChange = (ev: UrlChangeEvent) => {
            console.log("ev", ev)
            setValue((x) => {
                const entry = readUrlWithPrefix(x.prefix)
                const history = [...x.history]
                switch (ev.detail.source) {
                    case "pushState":
                        history.push(entry)
                        break
                    case "replaceState":
                    case "hashchange":
                        if (history.length > 0) {
                            history[history.length - 1] = entry
                        }
                        break
                    case "popstate":
                        history.pop()
                }

                return {
                    ...x,
                    ...readUrlWithPrefix(x.prefix),
                    history,
                }
            })
        }

        window.addEventListener("hvlog:urlchange", onUrlChange as any)
        return () => {
            window.removeEventListener("hvlog:urlchange", onUrlChange as any)
        }
    }, [])

    return {
        value,
        setValue,
    }
})
// #endregion

function readUrlWithPrefix(prefix: string[]) {
    const { url, parts } = readUrl()
    const [partsPrefix, partsPath] = [
        parts.slice(0, prefix.length),
        parts.slice(prefix.length),
    ]

    return {
        url,
        prefix,
        partsFull: parts,
        partsPath,
        partsPrefix,
    }
}
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
    action?: "pushState" | "replaceState" | "popState"
}) {
    const { prefix } = ROUTER.useContext()

    const hrefResolved = useMemo(() => {
        let prefixResolved
        if (ignorePrefix === undefined) {
            prefixResolved = !href?.startsWith("http") ? prefix : []
        } else {
            prefixResolved = ignorePrefix ? [] : prefix
        }

        return (
            "/" + normalizeUrlParts([...prefixResolved, href ?? ""]).join("/")
        )
    }, [prefix, href])

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

            const action = props.action ?? "pushState"
            switch (action) {
                case "pushState":
                    return history.pushState(null, "", hrefResolved)
                case "replaceState":
                    return history.replaceState(null, "", hrefResolved)
                case "popState":
                    return history.back()
            }
        }
    }
}
// #endregion

// #region UrlParamN
export namespace UrlParamN {
    type SchemaEntry<TypeId extends string, Type, Type2> = {
        type: TypeId
        init?: () => Type | Type2
        deser?: (x: Type | Type2) => any
    }
    export type Schema = Record<
        string,
        (
            | (SchemaEntry<"string", string, null> & {
                  skipTrim?: boolean
                  allowEmpty?: boolean
              })
            | (SchemaEntry<"string[]", string[], never> & {
                  skipTrim?: boolean
                  allowEmpty?: boolean
              })
            | (SchemaEntry<"number", number, null> & {
                  asFloat?: boolean
              })
            | (SchemaEntry<"number[]", number[], never> & {
                  asFloat?: boolean
              })
            | SchemaEntry<"boolean", boolean, null>
            | (SchemaEntry<"boolean[]", boolean[], never> & {
                  asFloat?: boolean
              })
            | (SchemaEntry<"date", Date, null> & {
                  type: "date"
                  ser?: (x: Date) => string
              })
            | SchemaEntry<"bitmask", number[], never>
        ) & {}
    >

    // prettier-ignore
    export type Resolve<T extends Schema> = {
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
          : T extends {
                  init: infer I extends AnyFunction
              }
            ? ReturnType<I>
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

    export function useUrlParams<S extends Schema>(opts: {
        schema: S
    }): [
        {
            [K in keyof S]: {
                raw: string | null
                v: Resolve<S>[K]
                init: S[K] extends { init: infer I extends AnyFunction }
                    ? ReturnType<I>
                    : null
            }
        },
        (update: Partial<UpdateObject<S>>, opts?: UpdateOpts) => void,
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
                } else if (s.init) {
                    parsed[key] = s.init()
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
            update: Partial<UpdateObject<S>>,
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

        const result: any = Object.fromEntries(
            Object.keys(opts.schema).map((k) => [
                k,
                {
                    raw: rawParams[k],
                    v: params[k],
                    init: opts.schema[k].init ? opts.schema[k].init() : null,
                },
            ]),
        )
        return [result, setParams]

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
