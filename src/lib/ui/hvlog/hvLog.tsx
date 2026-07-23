import { humanizeBattleType } from "@/lib/stats/metaStats"
// @ts-ignore
import "@/lib/ui/global.css"
import { useAsync } from "@/lib/utils/miscUtils"
import { RootComponent } from "@/lib/utils/userscriptUtils"
import { CustomMap } from "myutils"
import { StrictMode } from "react"
import { LogDetailsPane } from "./logDetailsPane"
import { LogList } from "./logList"
import { LOG_SOURCE } from "./logSource"
import { Router } from "./router"
import { humanizeFightingType } from "@/lib/stats/combatStats"
import { RouteLink } from "../routeLink"

// @fixme: log list
//    filter
//    pagination
//    search
// @todo: mob leaderboard
//    appearance (per million)
//    survival rate (avg 1.34)
//    damage
//    cast rate
//    attack rate
//    trainer table vs mob table (searchable)
// @fixme: item world
// @fixme: monsters killed
// @fixme: income per round
// @fixme: search endpoint
// @fixme: price endpoint
// @fixme: version
// @fixme: price history
// @fixme: client vs server entry points

// @todo: equip drop search
// @todo: global equip drops
// @todo: local nav
// @todo: per round / avgs (config?)
// @todo: effect blame
// @todo: chart utils
// @todo: consistent chart colors
// @todo: profit history
// @todo: temp search response

export const HvLog: RootComponent = ({}) => {
    const routes = new CustomMap({
        toRaw: (parts) => parts.join("/"),
        fromRaw: (raw) => raw.split("/"),
        initValue: (
            [
                [
                    "logs/*",
                    (parts: string[], url: URL) => (
                        <LogDetailsRoute id={parts[1]} />
                    ),
                ],
                [
                    "logs",
                    (parts: string[], url: URL) => {
                        const id_user = url.searchParams.get("id_user")
                        const key_user = url.searchParams.get("key_user")
                        return <LogList id_user={id_user} key_user={key_user} />
                    },
                ],
            ] as const
        ).map((kv) => [kv[0].split("/"), kv[1]] as const),
    })

    return (
        <StrictMode>
            <LOG_SOURCE.Provider>
                <Router routes={routes} />
            </LOG_SOURCE.Provider>
        </StrictMode>
    )
}

function LogDetailsRoute(props: { id: string }) {
    const logSource = LOG_SOURCE.useContext()
    const srcData = useAsync(async () => {
        const log = await logSource.fetchLog(props.id)
        const details = await logSource.fetchDetails(props.id)
        // const s = v91.summarize(log)
        // const stats = {
        //     ...s,
        //     finances: summarizeFinances(
        //         s.meta,
        //         s.drops,
        //         s.usage,
        //         apiData.prices,
        //     ),
        //     indexMap: new IndexMap(
        //         s.meta.turnIndices,
        //         s.meta.roundIndices,
        //         s.meta.eventCount,
        //     ),
        // }
        return { log, details }
    }, null)

    let title
    if (srcData.data) {
        const d = new Date(srcData.data.log.meta.start)
        const m = srcData.data.details.meta
        const zfill = (x: number, n = 2) => x.toString().padStart(n, "0")

        title = [
            humanizeBattleType(m.battleType, m.round?.end ?? null),
            srcData.data.log.meta.user_name ?? "(anonymous)",
            humanizeFightingType(srcData.data.details.combat.style),
            `${d.getFullYear()}-${zfill(d.getMonth())}-${zfill(d.getDate())} ${zfill(d.getHours())}:${zfill(d.getMinutes())}`,
        ].join(" - ")
    } else {
        title = "-"
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
                <LogDetailsPane
                    log={srcData.data?.log ?? null}
                    prices={window.HV_LOG_PRICES}
                    details={srcData.data?.details ?? null}
                />
            </div>
        </div>
    )
}
