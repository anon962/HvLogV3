import { USERSCRIPT_CONFIG } from "@/lib/db/userscriptConfig"
import { humanizeFightingType } from "@/lib/stats/combatStats"
import { IndexMap } from "@/lib/stats/indexMap"
import { humanizeBattleType } from "@/lib/stats/metaStats"
// @ts-ignore
import "@/lib/ui/global.css"
import { runUserscriptTasks } from "@/lib/db/userscriptTasks"
import { ScrollText } from "lucide-react"
import { CustomMap, normalizeUrlParts, sleep, useAsync } from "myutils"
import { useEffect, useMemo } from "react"
import { IS_LOCAL, IS_REMOTE } from "../../constants"
import { LOG_SOURCE } from "../../db/logSource"
import { Sidebar, SidebarItem } from "../sidebar"
import { EquipPage } from "./equipsPage"
import { LogDetailsPane } from "./logDetailsPane"
import { LogList } from "./logList/logList"
import { MonsterPage } from "./monsterPage"
import { RouteDef, RouteLink, ROUTER, Router } from "./router"
import { DbN } from "@/lib/db/dbN"
import { ConfigPage } from "./configPage"
import { Cog6Icon } from "../icons/tailwind"

// @fixme: profit history (bar graph, day month)
// @fixme: avg drops per battle type (including equips)

// @fixme: isekai
// @fixme: uploads / deletes
// @fixme: item world
// @fixme: clear cache command

// @todo: per round / avgs (config?)
// @todo: effect blame
// @todo: chart utils
// @todo: consistent chart colors
// @todo: rotate web cli log
// @todo: monster cast rate
// @todo: faster local parse
// @todo: deletion option
// @todo: off by one charts
// @todo: cast chains

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
            "/config": IS_LOCAL
                ? () => ({
                      component: <ConfigPage />,
                  })
                : null,
        } satisfies Record<string, RouteDef | null>).flatMap((kv) =>
            kv[1] ? [[normalizeUrlParts(kv[0].split("/")), kv[1]]] : [],
        ),
    })

    const sidebarItems = (
        [
            IS_LOCAL
                ? {
                      icon: <Cog6Icon />,
                      path: "/config",
                      tooltip: "Settings",
                  }
                : null,
            {
                icon: <ScrollText />,
                path: "/logs/",
                isActive: (parts) => parts[0] === "logs",
                tooltip: "Battle Logs",
            },
            IS_REMOTE
                ? {
                      icon: "ML",
                      path: "/mobs",
                      tooltip: "Monster Stats",
                  }
                : null,
            IS_LOCAL
                ? {
                      icon: "EQ",
                      path: "/equips",
                      tooltip: "Equip Log",
                  }
                : null,
        ] satisfies Array<SidebarItem | null>
    ).filter((x) => x !== null)

    const providers = useMemo(
        () =>
            IS_REMOTE
                ? ([
                      [USERSCRIPT_CONFIG.Provider, null],
                      [ROUTER.Provider, props.prefix ?? []],
                      [LOG_SOURCE.Provider, null],
                  ] as const)
                : ([
                      [USERSCRIPT_CONFIG.Provider, null],
                      [ROUTER.Provider, props.prefix ?? []],
                      [LOG_SOURCE.Provider, null],
                  ] as const),
        [],
    )

    const inner = (
        <>
            <Router
                routes={routes}
                defaultSidebar={({ children }) => (
                    <Sidebar items={sidebarItems}>{children}</Sidebar>
                )}
            />

            {IS_LOCAL && <UserscriptTaskRunner />}
        </>
    )

    return (
        <>
            {/* <StrictMode> */}
            {providers.reduceRight(
                (el, [Provider, arg]) => (
                    <Provider arg={arg as any}>{el}</Provider>
                ),
                inner,
            )}
            {/* </StrictMode> */}
        </>
    )
}

function UserscriptTaskRunner(props: {}) {
    const { config, setConfig, ready } = USERSCRIPT_CONFIG.useContext()

    const logSource = LOG_SOURCE.useContext()

    useEffect(() => {
        if (!ready) {
            return
        }

        return runUserscriptTasks({
            logSource,
            config: config,
            setConfig: (update) =>
                setConfig((curr) => ({
                    ...curr,
                    ...update,
                })),
        })
    }, [config, ready, setConfig])

    return <></>
}

function LogDetailsRoute(props: { id: DbN.LogId }) {
    const logSource = LOG_SOURCE.useContext()

    const { data: pricesData } = useAsync(async () => {
        const [pricesP, pricesI] = await Promise.all([
            logSource.fetchPrices("persistent"),
            logSource.fetchPrices("isekai"),
        ])
        return { persistent: pricesP, isekai: pricesI }
    }, null)
    const { data: details } = useAsync(
        async () => await logSource.fetchDetails(props.id),
        null,
    )
    const { data: metaEntries } = useAsync(async () => {
        let st = performance.now()
        while (true) {
            const elapsed = performance.now() - st
            if (!pricesData && !details && elapsed < 500) {
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
            IS_REMOTE ? (meta.user_name ?? "(anonymous)") : "",
            humanizeFightingType(details.combat.style),
            `${d.getFullYear()}-${zfill(d.getMonth() + 1)}-${zfill(d.getDate())} ${zfill(d.getHours())}:${zfill(d.getMinutes())}`,
        ]
            .filter((x) => x.length > 0)
            .join(" - ")
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

    const { history, prefix } = ROUTER.useContext()
    const backHref = useMemo(() => {
        let backHref = [...prefix, "logs"].join("/")
        if (history.length >= 2) {
            const u = history[history.length - 2].url
            backHref = u.pathname + u.search + u.hash
        }
        return backHref
    }, [])

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
                {pricesData && meta && (
                    <LogDetailsPane
                        id={props.id}
                        entries={entries}
                        prices={pricesData[meta.world]}
                        details={details}
                        indexMap={indexMap}
                    />
                )}
            </div>
        </div>
    )
}
