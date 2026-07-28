import { humanizeBattleType } from "@/lib/stats/metaStats"
// @ts-ignore
import "@/lib/ui/global.css"
import { useAsync } from "@/lib/utils/miscUtils"
import { RootComponent } from "@/lib/utils/userscriptUtils"
import { CustomMap, sleep } from "myutils"
import { StrictMode } from "react"
import { LogDetailsPane } from "./logDetailsPane"
import { LogList } from "./logList/logList"
import { LOG_SOURCE } from "./logSource"
import { ROUTER, Router } from "./router"
import { humanizeFightingType } from "@/lib/stats/combatStats"
import { RouteLink } from "../routeLink"
import { IndexMap } from "@/lib/stats/indexMap"
import { Sidebar, SidebarItem } from "../sidebar"
import * as lucide from "lucide-react"

// @fixme: compression

// @fixme: monsters killed

// @fixme: mob leaderboard
//    appearance (per million)
//    survival rate (avg 1.34)
//    damage
//    cast rate
//    attack rate
//    trainer table vs mob table (searchable)
// @fixme: item world
// @fixme: client vs server entry points
// @fixme: equip drop search
// @fixme: off by one charts
// @fixme: event log pagination
// @fixme: back button url should retain query params

// @todo: log source cache eviction
// @todo: per round / avgs (config?)
// @todo: effect blame
// @todo: chart utils
// @todo: consistent chart colors
// @todo: profit history
// @todo: rotate web cli log
// @todo: select with version filter

export const HvLog: RootComponent = ({}) => {
    const routes = new CustomMap({
        toRaw: (parts) => parts.join("/"),
        fromRaw: (raw) => raw.split("/"),
        initValue: (
            [
                [
                    "logs/*",
                    (parts: string[], url: URL) => ({
                        component: <LogDetailsRoute id={parts[1]} />,
                    }),
                ],
                [
                    "logs",
                    (parts: string[], url: URL) => ({
                        component: <LogList />,
                    }),
                ],
            ] as const
        ).map((kv) => [kv[0].split("/"), kv[1]] as const),
    })

    const sidebarItems: Array<SidebarItem> = [
        {
            icon: <lucide.ScrollText />,
            path: "/logs/",
            isActive: (url) => url.pathname.startsWith("/logs"),
            isDisabled: (url) => url.pathname === "/logs/",
        },
        {
            icon: "ML",
            path: "/logs/",
        },
    ]

    return (
        <StrictMode>
            <ROUTER.Provider>
                <LOG_SOURCE.Provider>
                    <Router
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
    const { data: log } = useAsync(async () => {
        await sleep(500)
        return await logSource.fetchLog(props.id)
    }, null)

    let title
    if (log && details) {
        const d = new Date(log.meta.start)
        const m = details.meta
        const zfill = (x: number, n = 2) => x.toString().padStart(n, "0")

        title = [
            humanizeBattleType(m.battleType, m.round?.end ?? null),
            log.meta.user_name ?? "(anonymous)",
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
                        log={log}
                        prices={prices}
                        details={details}
                        indexMap={indexMap}
                    />
                )}
            </div>
        </div>
    )
}
