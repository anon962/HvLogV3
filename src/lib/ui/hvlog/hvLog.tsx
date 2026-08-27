import { USERSCRIPT_CONFIG } from "@/lib/db/userscriptConfig"
import { runUserscriptTasks, TASK_DATA } from "@/lib/db/userscriptTasks"
// @ts-ignore
import "@/lib/ui/global.css"
import { ScrollText } from "lucide-react"
import { CustomMap, normalizeUrlParts, range } from "myutils"
import { useEffect, useMemo, useState } from "react"
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
import { Toaster } from "../toaster"
import { DbN } from "@/lib/db/dbN"

// @fixme: profit history (bar graph, day month)
// @fixme: avg drops per battle type (including equips)

// @todo: per round / avgs (config?)
// @todo: effect blame
// @todo: chart utils
// @todo: consistent chart colors
// @todo: rotate web cli log
// @todo: monster cast rate
// @todo: faster local parse
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
                      icon: (
                          <Cog6Icon className="stroke-[1.5] group-[.active]:stroke-2" />
                      ),
                      path: "/config",
                      tooltip: "Settings",
                  }
                : null,
            {
                icon: (
                    <ScrollText className="stroke-[1.5] group-[.active]:stroke-2" />
                ),
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
                    <Toaster>
                        <Sidebar items={sidebarItems}>{children}</Sidebar>
                    </Toaster>
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

    const [taskVersion, setTaskVersion] = useState(0)
    useEffect(() => {
        return DbN.listenIdbEvent((ev) => {
            switch (ev.type) {
                case "hvlog_import":
                    for (const idx of range(TASK_DATA.length)) {
                        TASK_DATA[idx] = { state: null, delay: null }
                    }
                    setTaskVersion((curr) => curr + 1)
            }
        })
    }, [])

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
    }, [config, ready, setConfig, taskVersion])

    return <></>
}
