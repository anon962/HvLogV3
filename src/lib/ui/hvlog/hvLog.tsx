import { humanizeBattleType } from "@/lib/stats/metaStats"
// @ts-ignore
import "@/lib/ui/global.css"
import { useAsync } from "@/lib/utils/miscUtils"
import {
    normalizeUrlParts,
    readUrl,
    RootComponent,
} from "@/lib/utils/userscriptUtils"
import { CustomMap, sleep, strip } from "myutils"
import { ComponentProps, PropsWithChildren, StrictMode } from "react"
import { LogDetailsPane } from "./logDetailsPane"
import { LogList } from "./logList/logList"
import { LOG_SOURCE } from "../../db/logSource"
import { RouteDef, ROUTER, Router } from "./router"
import { humanizeFightingType } from "@/lib/stats/combatStats"
import { RouteLink } from "../routeLink"
import { IndexMap } from "@/lib/stats/indexMap"
import { Sidebar, SidebarItem } from "../sidebar"
import * as lucide from "lucide-react"
import { MonsterPage } from "./monsterPage"

// @fixme: count imported from file
// @fixme: faster local search
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
            "/mobs": () => ({
                component: <MonsterPage />,
            }),
        } satisfies Record<string, RouteDef>).map((kv) => [
            normalizeUrlParts(kv[0].split("/")),
            kv[1],
        ]),
    })

    const sidebarItems: Array<SidebarItem> = [
        {
            icon: <lucide.ScrollText />,
            path: "/logs/",
            isActive: (url) => url.pathname.startsWith("/logs"),
            isDisabled: (url) => strip(url.pathname, "/") === "logs",
        },
        {
            icon: "ML",
            path: "/mobs",
        },
    ]

    return (
        <StrictMode>
            <ROUTER.Provider>
                <LOG_SOURCE.Provider>
                    <Router
                        prefix={props.prefix}
                        routes={routes}
                        defaultSidebar={({ children }) => (
                            <Sidebar items={sidebarItems}>{children}</Sidebar>
                        )}
                    />
                </LOG_SOURCE.Provider>
            </ROUTER.Provider>
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
