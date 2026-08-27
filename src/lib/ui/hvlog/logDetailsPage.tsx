import { deleteLogs, LOG_DB_CACHE, LogDb } from "@/lib/db/db"
import { DbN } from "@/lib/db/dbN"
import { USERSCRIPT_CONFIG } from "@/lib/db/userscriptConfig"
import { HvDataN } from "@/lib/hvdataN"
import { humanizeFightingStyle } from "@/lib/stats/combatStats"
import { IndexMap } from "@/lib/stats/indexMap"
import { humanizeBattleType } from "@/lib/stats/metaStats"
import { DetailsSummary } from "@/lib/stats/summary"
import { CloudUploadIcon, Link, Trash2Icon } from "lucide-react"
import {
    cn,
    Css,
    css,
    sleep,
    truncateString,
    useAsync,
    useAsync2,
} from "myutils"
import { useMemo, useState } from "react"
import { HVDATA_URL, IS_REMOTE } from "../../constants"
import { LOG_SOURCE } from "../../db/logSource"
import { IconButton } from "../iconButton"
import { Loader } from "../loader"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../shadcn/tabs"
import { TOASTER } from "../toaster"
import { CombatInfo } from "./combat/combatInfo"
import { DropInfo } from "./drop/dropInfo"
import { RawLogViewer } from "./rawLogViewer"
import { RouteLink, ROUTER, useUrlParams } from "./router"

export function LogDetailsPage(props: { id: DbN.LogId }) {
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
    const { data: meta } = useAsync(async () => {
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
        return logSource.fetchMeta(props.id)
    }, null)

    let title
    if (meta && details) {
        const d = new Date(meta.startedAt)
        const m = details.meta
        const zfill = (x: number, n = 2) => x.toString().padStart(n, "0")

        title = [
            humanizeBattleType(m.battleType, m.round?.end ?? null, true),
            IS_REMOTE ? (meta.user_name ?? "(anonymous)") : "",
            humanizeFightingStyle(details.combat.style),
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
        let backHref = "/" + [...prefix, "logs"].join("/")
        if (history.length >= 2) {
            const u = history[history.length - 2].url
            backHref = u.pathname + u.search + u.hash
        }
        return backHref
    }, [])

    return (
        <div className="details-pane-root w-full h-full flex flex-col overflow-auto gap-4 p-4 pb-8">
            <div className="flex justify-between items-center gap-4 max-w-240 mx-auto w-full">
                <RouteLink
                    href={backHref}
                    ignorePrefix={true}
                    className="max-w-1/4"
                >
                    Back
                </RouteLink>

                <h1 className="font-bold">{title}</h1>

                <div
                    className={cn("actions flex items-center", {
                        invisible: !details || !meta || !pricesData,
                    })}
                >
                    <DeleteButton id={props.id} backHref={backHref} />
                    <UploadButton id={props.id} />
                </div>
            </div>

            <div className="w-full h-full mx-auto">
                {pricesData && meta && (
                    <Inner
                        id={props.id}
                        prices={pricesData[meta.world]}
                        details={details}
                        indexMap={indexMap}
                    />
                )}
            </div>
        </div>
    )
}

function Inner(props: {
    id: DbN.LogId
    prices: DbN.Prices
    details: DetailsSummary | null
    indexMap: IndexMap
}) {
    const [params, setParams] = useUrlParams({
        schema: {
            m: {
                type: "number",
                init: () => (IS_REMOTE ? 1 : (0 as number)),
            },
        },
    })

    return (
        <div
            className="w-full h-full"
            style={{
                containerType: "inline-size",
            }}
        >
            <Css css={CSS} />

            <Tabs
                value={String(params.m.v)}
                className="details-pane h-full w-full"
                onValueChange={(x) => {
                    setParams({
                        m: parseInt(x[0]),
                    })
                }}
            >
                <TabsList className="w-full mb-2 flex max-w-240 mx-auto">
                    <TabsTrigger value="0" className="font-bold py-1">
                        Drops
                    </TabsTrigger>

                    <TabsTrigger value="1" className="font-bold py-1">
                        Combat
                    </TabsTrigger>

                    <TabsTrigger value="2" className="font-bold py-1">
                        Log
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="0">
                    {props.details ? (
                        <DropInfo
                            prices={props.prices}
                            stats={props.details}
                            indexMap={props.indexMap}
                        />
                    ) : (
                        ""
                    )}
                </TabsContent>

                <TabsContent value="1">
                    {props.details ? (
                        <CombatInfo
                            details={props.details}
                            indexMap={props.indexMap}
                        />
                    ) : (
                        ""
                    )}
                </TabsContent>

                <TabsContent value="2">
                    <RawLogViewer id={props.id} />
                </TabsContent>
            </Tabs>
        </div>
    )
}

function UploadButton(props: { id: DbN.LogId }) {
    const cache = LOG_DB_CACHE()
    const db = new LogDb()

    const { config } = USERSCRIPT_CONFIG.useContext()
    const { toast } = TOASTER.useContext()

    const [loading, setLoading] = useState(false)

    const [didUpload, setDidUpload] = useState(false)
    const req = useMemo(() => ({ id: props.id }), [props.id, didUpload])
    const upload = useAsync2(async ({ id }) => {
        return await cache.uploadCache.fetch(id)
    }, req)

    return (
        config.hvdataUploadMode !== "default" &&
        config.hvdataUploadMode !== "disabled" &&
        (upload.data ? (
            <IconButton
                className={cn("p-0", { "pointer-events-none": loading })}
            >
                <a
                    className="flex justify-center items-center"
                    href={`${HVDATA_URL}/logs/${props.id}`}
                    target="_blank"
                >
                    <Link />
                </a>
            </IconButton>
        ) : (
            <IconButton
                className={cn({ "pointer-events-none": loading })}
                onClick={async () => {
                    const logText = await LOG_DB_CACHE().rawCache.fetch(
                        props.id,
                    )

                    try {
                        setLoading(true)
                        const resp = await HvDataN.uploadLog({
                            id: props.id,
                            logText,
                            config,
                        })
                        await db.put("logsHvdata", {
                            id: resp.id,
                            user: config.hvdataUser!,
                        })
                        setDidUpload(true)
                    } catch (e) {
                        toast(
                            `Upload failed: ${truncateString(String(e), 30, "...")}`,
                            { error: true },
                        )
                    }
                    setLoading(false)
                }}
            >
                <div className="relative">
                    <div className="absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center size-full">
                        <Loader show={loading} />
                    </div>
                    <CloudUploadIcon
                        className={cn("size-5", loading ? "invisible" : "")}
                        style={{
                            color: "color-mix(in oklab, var(--color-blue-500), var(--foreground) 50%)",
                        }}
                    />
                </div>
            </IconButton>
        ))
    )
}

function DeleteButton(props: { id: DbN.LogId; backHref: string }) {
    const { config } = USERSCRIPT_CONFIG.useContext()

    return (
        (config.showDelete === "warn" || config.showDelete === "yes") && (
            <IconButton
                onClick={async () => {
                    const db = new LogDb()
                    const cache = LOG_DB_CACHE()

                    const meta = await cache.metaCache.fetch(props.id)

                    if (config.showDelete === "warn") {
                        if (
                            !confirm(
                                `Delete ${props.id ?? "???"} log from ${meta.startedAt}?`,
                            )
                        ) {
                            return
                        }
                    }
                    await deleteLogs(db, [props.id])

                    window.history.pushState(null, "", props.backHref)
                }}
            >
                <Trash2Icon style={{ color: "hsl(0deg 100% 86.64%)" }} />
            </IconButton>
        )
    )
}

const CSS = css`
    .details-pane-root {
        .details-pane {
            [data-slot="card"] {
                margin-bottom: 0;
            }

            [role="tabpanel"] {
                padding-bottom: 2rem;
            }

            [data-slot="tabs-trigger"] {
                font-weight: bold;
                padding-top: 0.25rem;
                padding-bottom: 0.25rem;
            }
        }

        .chart-wrapper {
            width: 100%;
            max-width: 55rem;
            margin: auto;
            font-family: monospace;

            figure {
                width: 100%;
            }
        }

        .chart-wrapper h1 {
            color: color-mix(
                in oklch,
                var(--color-blue-200),
                var(--foreground) 0%
            );
        }

        .icon-button {
            width: 2em;
            height: 2em;

            & > * {
                padding: 0.375em;
            }
        }
    }
`
