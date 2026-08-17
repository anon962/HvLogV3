import { USERSCRIPT_CONFIG } from "@/lib/db/userscriptConfig"
import { humanizeFightingType } from "@/lib/stats/combatStats"
import { IndexMap } from "@/lib/stats/indexMap"
import { humanizeBattleType } from "@/lib/stats/metaStats"
// @ts-ignore
import "@/lib/ui/global.css"
import * as lucide from "lucide-react"
import { CustomMap, normalizeUrlParts, sleep, useAsync } from "myutils"
import { StrictMode, useEffect, useMemo } from "react"
import { IS_LOCAL, IS_REMOTE } from "../../constants"
import { LOG_SOURCE } from "../../db/logSource"
import { Sidebar, SidebarItem } from "../sidebar"
import { LogDetailsPane } from "./logDetailsPane"
import { LogList } from "./logList/logList"
import { MonsterPage } from "./monsterPage"
import { RouteDef, RouteLink, ROUTER, Router } from "./router"
import { EquipPage } from "./equipsPage"
import { runUserscriptTasks } from "@/lib/db/userscriptTasks"

// @fixme: profit history (bar graph, day month)
// @fixme: avg drops per battle type (including equips)
// @fixme: equip search
// @fixme: log import / export / delete old / delete imports
// @fixme: event log pagination (filters, default to player actions)

// @fixme: count imported from file
// @fixme: isekai
// @fixme: uploads / deletes
// @fixme: item world
// @fixme: useAppCache
// @fixme: local log cols (duration)
// @fixme: clear cache command
// @fixme: invalidate secondary caches

// @todo: per round / avgs (config?)
// @todo: effect blame
// @todo: chart utils
// @todo: consistent chart colors
// @todo: rotate web cli log
// @todo: monster cast rate
// @todo: faster local parse
// @todo: deletion option
// @todo: off by one charts

export const HvLog = (props: { prefix?: string[] }) => {
    const routes = new CustomMap({
        toRaw: (parts) => parts.join("/"),
        fromRaw: (raw) => normalizeUrlParts(raw.split("/")),
        initValue: Object.entries({
            "": () => ({
                redirect: ["logs"],
            }),
            "/logs/*": (parts) => ({
                component: <LogDetailsRoute id={parts[1]} />,
            }),
            "/logs": () => ({
                component: <LogList />,
            }),
            "/mobs": IS_REMOTE
                ? () => ({
                      component: <MonsterPage />,
                  })
                : null,
            "/equips": IS_LOCAL
                ? () => ({
                      component: <EquipPage />,
                  })
                : null,
        } satisfies Record<string, RouteDef | null>).flatMap((kv) =>
            kv[1] ? [[normalizeUrlParts(kv[0].split("/")), kv[1]]] : [],
        ),
    })

    const sidebarItems = (
        [
            {
                icon: <lucide.ScrollText />,
                path: "/logs/",
                isActive: (parts) => parts[0] === "logs",
                isDisabled: (parts) =>
                    parts[0] === "logs" && parts.length === 1,
            },
            IS_REMOTE
                ? {
                      icon: "ML",
                      path: "/mobs",
                  }
                : null,
            IS_LOCAL
                ? {
                      icon: "EQ",
                      path: "/equips",
                  }
                : null,
        ] satisfies Array<SidebarItem | null>
    ).filter((x) => x !== null)

    const providers = useMemo(
        () =>
            IS_REMOTE
                ? ([ROUTER.Provider, LOG_SOURCE.Provider] as const)
                : ([
                      USERSCRIPT_CONFIG.Provider,
                      ROUTER.Provider,
                      LOG_SOURCE.Provider,
                  ] as const),
        [],
    )

    const inner = (
        <>
            <Router
                prefix={props.prefix}
                routes={routes}
                defaultSidebar={({ children }) => (
                    <Sidebar items={sidebarItems}>{children}</Sidebar>
                )}
            />

            {IS_LOCAL && <UserscriptTaskRunner />}
        </>
    )

    return (
        <StrictMode>
            {providers.reduceRight(
                (el, Provider) => (
                    <Provider>{el}</Provider>
                ),
                inner,
            )}
        </StrictMode>
    )
}

function UserscriptTaskRunner(props: {}) {
    const {
        fns: { setConfigRaw },
    } = USERSCRIPT_CONFIG
    const configCtx = USERSCRIPT_CONFIG.useContext()

    const logSource = LOG_SOURCE.useContext()

    useEffect(() => {
        return runUserscriptTasks({
            logSource,
            config: configCtx.config,
            setConfig: (update) =>
                setConfigRaw((curr) => ({
                    ...curr,
                    config: {
                        ...curr.config,
                        ...update,
                    },
                })),
        })
    }, [configCtx])

    return <></>
}

function LogDetailsRoute(props: { id: string }) {
    const logSource = LOG_SOURCE.useContext()

    const { data: prices } = useAsync(
        async () => await logSource.fetchPrices(),
        null,
    )
    const { data: details } = useAsync(
        async () => await logSource.fetchDetails(props.id),
        null,
    )
    const { data: metaEntries } = useAsync(async () => {
        let st = performance.now()
        while (true) {
            const elapsed = performance.now() - st
            if (!prices && !details && elapsed < 500) {
                await sleep(100)
                continue
            } else {
                break
            }
        }
        return Promise.all([
            logSource.fetchMeta(props.id),
            logSource.fetchEntries(props.id),
        ] as const)
    }, null)
    const [meta, entries] = metaEntries ?? [null, null]

    let title
    if (meta && details) {
        const d = new Date(meta.startedAt)
        const m = details.meta
        const zfill = (x: number, n = 2) => x.toString().padStart(n, "0")

        title = [
            humanizeBattleType(m.battleType, m.round?.end ?? null),
            meta.user_name ?? "(anonymous)",
            humanizeFightingType(details.combat.style),
            `${d.getFullYear()}-${zfill(d.getMonth())}-${zfill(d.getDate())} ${zfill(d.getHours())}:${zfill(d.getMinutes())}`,
        ].join(" - ")
    } else {
        title = "-"
    }

    let indexMap = new IndexMap([], {}, 0)
    if (details) {
        indexMap = new IndexMap(
            details.meta.turnIndices,
            details.meta.roundIndices,
            details.meta.eventCount,
        )
    }

    const { history } = ROUTER.useContext()
    let backHref = "/logs/"
    if (history.length >= 2) {
        const u = history[history.length - 2].url
        backHref = u.pathname + u.search + u.hash
    }

    return (
        <div className="w-full h-full flex flex-col overflow-hidden gap-4 p-4 pb-8">
            <div className="flex justify-between gap-4">
                <RouteLink
                    href={backHref}
                    ignorePrefix={true}
                    // action="popState"
                    className="max-w-1/4"
                >
                    Back
                </RouteLink>

                <span className="font-bold">{title}</span>

                <span></span>
            </div>

            <div className="w-full max-w-[60rem] h-full mx-auto">
                {prices && (
                    <LogDetailsPane
                        entries={entries}
                        prices={prices}
                        details={details}
                        indexMap={indexMap}
                    />
                )}
            </div>
        </div>
    )
}
