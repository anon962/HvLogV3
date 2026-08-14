import { USERSCRIPT_CONFIG } from "@/lib/db/userscriptConfig"
import { humanizeFightingType } from "@/lib/stats/combatStats"
import { IndexMap } from "@/lib/stats/indexMap"
import { humanizeBattleType } from "@/lib/stats/metaStats"
// @ts-ignore
import "@/lib/ui/global.css"
import * as lucide from "lucide-react"
import { CustomMap, normalizeUrlParts, sleep, useAsync } from "myutils"
import { StrictMode, useMemo } from "react"
import { LOG_SOURCE } from "../../db/logSource"
import { IS_REMOTE } from "../constants"
import { Sidebar, SidebarItem } from "../sidebar"
import { LogDetailsPane } from "./logDetailsPane"
import { LogList } from "./logList/logList"
import { MonsterPage } from "./monsterPage"
import { RouteDef, RouteLink, ROUTER, Router } from "./router"

// @fixme: count imported from file
// @fixme: profit history
// @fixme: equip search

// @fixme: item world
// @fixme: equip drop search
// @fixme: off by one charts
// @fixme: event log pagination
// @fixme: back button url should retain query params

// @todo: log source cache eviction
// @todo: per round / avgs (config?)
// @todo: effect blame
// @todo: chart utils
// @todo: consistent chart colors
// @todo: rotate web cli log
// @todo: select with version filter
// @todo: monster cast rate
// @todo: faster local parse

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
        <Router
            prefix={props.prefix}
            routes={routes}
            defaultSidebar={({ children }) => (
                <Sidebar items={sidebarItems}>{children}</Sidebar>
            )}
        />
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
        const d = new Date(meta.start)
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

    return (
        <div className="w-full h-full flex flex-col overflow-hidden gap-4 p-4 pb-8">
            <div className="flex justify-between gap-4">
                <RouteLink href="/logs/" className="max-w-1/4">
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
