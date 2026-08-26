import { USERSCRIPT_CONFIG } from "@/lib/db/userscriptConfig"
import { runUserscriptTasks } from "@/lib/db/userscriptTasks"
// @ts-ignore
import "@/lib/ui/global.css"
import { ScrollText } from "lucide-react"
import { CustomMap, normalizeUrlParts } from "myutils"
import { useEffect, useMemo } from "react"
import { IS_LOCAL, IS_REMOTE } from "../../constants"
import { LOG_SOURCE } from "../../db/logSource"
import { Cog6Icon } from "../icons/tailwind"
import { Sidebar, SidebarItem } from "../sidebar"
import { ConfigPage } from "./configPage"
import { EquipPage } from "./equipsPage"
import { LogList } from "./logList/logList"
import { MonsterPage } from "./monsterPage"
import { RouteDef, ROUTER, Router } from "./router"
import { LogDetailsPage } from "./logDetailsPage"

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
                component: <LogDetailsPage id={parts[1]} />,
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
