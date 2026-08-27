import { deleteLogs, LOG_DB_CACHE, LogDb } from "@/lib/db/db"
import { DbN } from "@/lib/db/dbN"
import { LOG_SOURCE } from "@/lib/db/logSource"
import { LogSourceN } from "@/lib/db/logSourceN"
import { USERSCRIPT_CONFIG } from "@/lib/db/userscriptConfig"
import { HvDataN } from "@/lib/hvdataN"
import {
    humanizeFightingStyle,
    MAGE_STYLES,
    MELEE_STYLES,
} from "@/lib/stats/combatStats"
import { humanizeBattleType } from "@/lib/stats/metaStats"
import { formatNumber } from "@/lib/utils/miscUtils"
import { CloudUploadIcon, Link, Trash2Icon } from "lucide-react"
import {
    cn,
    isEqual,
    newContext,
    range,
    sum,
    truncateString,
    useAsync,
    useAsync2,
} from "myutils"
import { useCallback, useEffect, useMemo, useState } from "react"
import { HVDATA_URL, IS_REMOTE } from "../../../constants"
import { IconButton } from "../../iconButton"
import { RunIcon, Skull2Icon } from "../../icons/misc"
import { CheckIcon } from "../../icons/tailwind"
import { ListTableN } from "../../listTable"
import { TOASTER } from "../../toaster"
import { UrlParamN } from "../router"

export namespace LogListN {
    export const COLS = {
        user: {
            id: "user",
            header: { content: "User" },
            align: "text-left",
            cell: (x) => ({
                content: x.meta.user_name ?? "(anonymous)",
                className: "user",
                title: x.meta.user_id ?? "",
            }),
        },
        battleType: {
            id: "battleType",
            header: { content: "Type", className: "w-[6rem]" },
            align: "text-left",
            cell: (x) => ({
                content: humanizeBattleType(
                    x.search.meta.battleType,
                    x.search.meta.round?.max ?? null,
                ),
                className: "battleType",
            }),
        },
        turns: {
            id: "turns",
            header: { content: "Turns", className: "min-w-[10ch]" },
            align: "text-right",
            cell: (x) => ({
                content: `${formatNumber(x.search.meta.turnCount)} turns`,
                className: "turns",
            }),
        },
        duration: {
            id: "duration",
            header: { content: "Duration" },
            align: "text-right",
            cell: (x) => ({
                content: formatDuration(
                    new Date(x.meta.startedAt),
                    new Date(x.meta.endedAt),
                ),
                className: "duration",
            }),
        },
        profit: {
            id: "profit",
            header: { content: "Profit" },
            // preprocess: (ids) => formatProfit(ids),
            cell: (x) => {
                const p = x.search.finances.profit

                return {
                    content: Math.round(p / 1000) + "k",
                    className: cn("profit", p > 0 ? "positive" : "negative"),
                }
            },
        },
        date: {
            id: "date",
            align: "text-left",
            header: { content: IS_REMOTE ? "Date" : "Start Date" },
            preprocess: (xs) => {
                const [now, setNow] = useState(new Date())

                useEffect(() => {
                    const timerId = setInterval(() => {
                        setNow(new Date())
                    }, 60_000)

                    return () => clearInterval(timerId)
                })

                return { extras: xs.map(() => now), deps: [now] }
            },
            cell: (x, now) => ({
                ...formatStartDate(x.meta.startedAt, now),
                className: "date",
            }),
        } as const satisfies ListTableN.Column<LogSourceN.SearchResult, Date>,
        status: {
            id: "status",
            header: { content: "Status" },
            align: "text-center",
            cell: (x) => formatCompletionType(x),
        },
        actions: {
            id: "actions",
            header: { content: "" },
            align: "text-right",
            skipUrl: true,
            preprocess: useActionsPreproc,
            cell: (x, extras) => ({
                className: "actions",
                content: (
                    <div className="flex h-full">
                        {extras?.showDelete && (
                            <IconButton onClick={() => extras.onDelete(x)}>
                                <Trash2Icon />
                            </IconButton>
                        )}
                        {extras?.showUpload &&
                            (extras.upload ? (
                                <IconButton>
                                    <a
                                        href={`${HVDATA_URL}/logs/${extras.upload.id}`}
                                        target="_blank"
                                    >
                                        <Link />
                                    </a>
                                </IconButton>
                            ) : (
                                <IconButton onClick={() => extras.onUpload(x)}>
                                    <CloudUploadIcon />
                                </IconButton>
                            ))}
                    </div>
                ),
            }),
        } as const satisfies ListTableN.Column<
            LogSourceN.SearchResult,
            ReturnType<typeof useActionsPreproc>["extras"][number]
        >,
        style: {
            id: "style",
            header: { content: "Style", className: "min-w-[12ch]" },
            align: "text-left",
            cell: (x) => ({
                content: humanizeFightingStyle(x.search.style),
                className: "style",
            }),
        },
        // {
        //     id: "enchants",
        //     header: { content: "Enchants Unlocked", className: "pr-4" },
        //     align: "text-center",
        //     preprocess: (ids) => formatEnchants(ids),
        //     cell: ({ value }) => value.cell,
        // } as const satisfies ListTableColumn<
        //     ReturnType<typeof formatEnchants>[number]
        // >,
    } as const satisfies Record<
        string,
        ListTableN.Column<LogSourceN.SearchResult, any>
    >

    export const SORT_IDS = new Set([
        COLS.turns.id,
        COLS.date.id,
        COLS.profit.id,
    ] as const)

    const btA = (st: number, end?: number) =>
        end
            ? range(st, end + 1).map((id) => `arena challenge #${id}`)
            : [`arena challenge #${st}`]
    const btT = (st: number, end: number) =>
        range(st, end + 1).map((id) => `The Tower Floor ${id}`)
    export const BATTLE_TYPES = [
        { label: "Grindfest", ids: new Set(["Grindfest"]) },
        { label: "RE", ids: new Set(["random encounter"]) },
        { label: "Tower", ids: new Set(["Tower"]) },
        { label: "Item World", ids: new Set(["Item World"]) },
        { label: "SPL (A100)", ids: new Set([...btA(35)]) },
        { label: "PGC (A95)", ids: new Set([...btA(34)]) },
        { label: "DwD (A90)", ids: new Set([...btA(33)]) },
        { label: "A85 - A65", ids: new Set([...btA(26, 32)]) },
        { label: "A60 - A35", ids: new Set([...btA(17, 24)]) },
        { label: "A30 - A2", ids: new Set([...btA(0, 16)]) },
        { label: "RoB (TTT)", ids: new Set([...btA(112)]) },
        { label: "RoB (FSM)", ids: new Set([...btA(111)]) },
        { label: "RoB (Unicorn)", ids: new Set([...btA(110)]) },
        { label: "RoB (Real Life)", ids: new Set([...btA(109)]) },
        { label: "RoB (Nagato)", ids: new Set([...btA(108)]) },
        { label: "RoB (Asakura)", ids: new Set([...btA(107)]) },
        { label: "RoB (Asahina)", ids: new Set([...btA(106)]) },
        { label: "RoB (Konata)", ids: new Set([...btA(105)]) },
    ]
    const battleTypeCount = sum(BATTLE_TYPES.map((bt) => bt.ids.size))

    export const STYLES = [
        { ...MAGE_STYLES["Dark Mage"] },
        { ...MAGE_STYLES["Holy Mage"] },
        { ...MAGE_STYLES["Wind Mage"] },
        { ...MAGE_STYLES["Elec Mage"] },
        { ...MAGE_STYLES["Fire Mage"] },
        { ...MAGE_STYLES["Cold Mage"] },
        { ...MELEE_STYLES["One-Handed"] },
        { ...MELEE_STYLES["Two-Handed"] },
        { ...MELEE_STYLES["Dual Wield"] },
        { ...MELEE_STYLES["Niten"] },
        { ...MELEE_STYLES["Bonk"] },
    ]
    const stylesCount = STYLES.length

    export const COMPLETION_TYPES = [
        { id: "finish", label: "Finish" },
        { id: "flee", label: "Flee" },
        { id: "die", label: "Die" },
    ] as const
    const completionTypeCount = COMPLETION_TYPES.length

    export const ERRORS = [
        { id: "none", label: "(none)" },
        { id: "inconsistentBattleTypes", label: "battleType" },
        { id: "parsing", label: "parsing" },
        { id: "missingStart", label: "noStart" },
        { id: "missingEnd", label: "noEnd" },
        { id: "dupes", label: "dupes" },
        { id: "unknownSequence", label: "unkSeq" },
    ]

    export const PARAM_SCHEMA = {
        // Search options
        p: {
            type: "number",
            deser: (x) => (x !== null && x >= 1 ? x - 1 : 0),
            init: () => 0,
        },
        n: {
            type: "number",
            init: () => 15,
        },
        s: {
            type: "string",
            deser: (x) => (x && SORT_IDS.has(x as any) ? x : null),
        },
        desc: {
            type: "boolean",
        },
        id_user: {
            type: "string",
        },
        key_user: {
            type: "string",
        },
        // Filter options
        bt: {
            type: "bitmask",
            deser: (xs) => {
                let battleTypes = xs
                    .map((idx) => BATTLE_TYPES[idx])
                    .filter((x) => !!x)

                return battleTypes.flatMap((bt) => [...bt.ids])
            },
        },
        ct: {
            type: "bitmask",
            deser: (xs) => xs.map((idx) => COMPLETION_TYPES[idx]?.id),
        },
        sp: {
            type: "bitmask",
            deser: (xs) => xs.map((idx) => STYLES[idx]?.id).filter((x) => !!x),
        },
        ss: {
            type: "bitmask",
            deser: (xs) => xs.map((idx) => STYLES[idx]?.id).filter((x) => !!x),
        },
        i: {
            type: "bitmask",
            deser: (xs) => {
                const hasYes = xs.includes(0)
                const hasNo = xs.includes(1)
                if (hasYes && hasNo) {
                    return "both" as const
                } else if (!hasYes && !hasNo) {
                    return "neither" as const
                } else if (hasYes) {
                    return "yes" as const
                } else {
                    return "no" as const
                }
            },
        },
        ds: {
            type: "date",
        },
        de: {
            type: "date",
        },
        e: {
            type: "bitmask",
            deser: (xs) => xs.map((idx) => ERRORS[idx]).filter((x) => !!x),
        },
        rmn: {
            type: "number",
        },
        rmx: {
            type: "number",
        },
    } as const satisfies UrlParamN.Schema

    export const ctx = newContext(() => {
        const [params, setParams] = UrlParamN.useUrlParams({
            schema: PARAM_SCHEMA,
        })

        const pageSize = params["n"].v
        const pageIdx = params["p"].v

        const request = useMemo(
            () =>
                ({
                    pageIdx,
                    pageSize,
                    idUser: params["id_user"].v,
                    keyUser: params["key_user"].v,
                    sortCriteria: params["s"].v
                        ? {
                              cid: params["s"].v,
                              order:
                                  params["desc"].v === true
                                      ? ("desc" as const)
                                      : ("asc" as const),
                          }
                        : null,
                    battleType: withMaxMin(params["bt"].v, battleTypeCount),
                    primaryStyle: withMaxMin(params["sp"].v, stylesCount),
                    secondaryStyle: withMaxMin(params["ss"].v, stylesCount),
                    isImperil:
                        params["i"].v === "yes"
                            ? true
                            : params["i"].v === "no"
                              ? false
                              : null,
                    startDate: params["ds"].v?.toISOString() ?? null,
                    endDate: params["de"].v?.toISOString() ?? null,
                    completionType: withMaxMin(
                        params["ct"].v,
                        completionTypeCount,
                    ),
                    roundMin: params["rmn"].v,
                    roundMax: params["rmx"].v,
                    errors:
                        params["e"].v.length === ERRORS.length ||
                        params["e"].v.length === 0
                            ? null
                            : Object.fromEntries(
                                  params["e"].v.map(
                                      (x) => [x.id as any, true] as const,
                                  ),
                              ),
                }) as const,
            [
                pageIdx,
                pageSize,
                params["id_user"].v,
                params["key_user"].v,
                params["s"].v,
                params["desc"].v,
                params["bt"].v.join("|"),
                params["sp"].v.join("|"),
                params["ss"].v.join("|"),
                params["i"].v,
                params["ds"].v?.toISOString(),
                params["de"].v?.toISOString(),
                params["ct"].v.join("|"),
                params["rmn"].v,
                params["rmx"].v,
                params["e"].v.map((x) => x.label).join("|"),
            ],
        )
        useEffect(() => {
            fetcher.setRequest(request)
        }, [request])

        const logSource = LOG_SOURCE.useContext()
        const fetcher = useAsync(async (req) => {
            const get = (
                pageIdx: number,
                sortCriteria?: ListTableN.SortCriteria,
            ) => {
                return logSource.fetchSearch({
                    ...req,
                    pageIdx,
                    sort: sortCriteria
                        ? {
                              type: sortCriteria.cid,
                              order: sortCriteria.order,
                          }
                        : req.sortCriteria
                          ? {
                                type: req.sortCriteria.cid as any,
                                order: req.sortCriteria.order,
                            }
                          : null,
                })
            }

            const resp = await get(req.pageIdx)

            const prefetch = async () => {
                await get(0)
                const lastPageIdx =
                    Math.ceil(resp.resultCount / resp.pageSize) - 1
                await get(lastPageIdx)

                for (let idx of range(req.pageIdx - 2, req.pageIdx + 2 + 1)) {
                    if (idx <= 0 || idx >= lastPageIdx - 2) {
                        continue
                    }

                    await get(idx)
                }

                for (const cid of LogListN.SORT_IDS) {
                    for (const order of ["desc", "asc"] as const) {
                        await get(req.pageIdx, {
                            cid,
                            order,
                        })
                    }
                }
            }
            prefetch()

            return resp
        }, request)

        useEffect(() => {
            if (!fetcher.data?.ttl) {
                return
            }

            const currReq = fetcher.request
            const refetchTimer = setTimeout(() => {
                if (isEqual(fetcher.request, currReq)) {
                    fetcher.setRequest({ ...currReq })
                }
            }, fetcher.data.ttl * 2)

            return () => clearTimeout(refetchTimer)
        }, [fetcher.data, fetcher.request])

        // Refetch when page index is out of bounds
        useEffect(() => {
            if (fetcher.isPending) {
                return
            }
            if (!fetcher.data) {
                return
            }
            if (
                fetcher.data.resultCount !== 0 ||
                fetcher.request.pageIdx === 0 ||
                fetcher.data.stale
            ) {
                return
            }

            const lastPageIdx = Math.floor(
                fetcher.data.resultCount / fetcher.data.pageSize,
            )
            fetcher.setRequest({
                ...fetcher.request,
                pageIdx: lastPageIdx,
            })
        }, [fetcher.isPending, fetcher.data, fetcher.request])

        // Refetch on log deletion
        useEffect(
            () =>
                DbN.listenIdbEvent((ev) => {
                    switch (ev.type) {
                        case "hvlog_delete":
                            console.log("set", fetcher.request, fetcher.data)
                            fetcher.setRequest({ ...fetcher.request })
                            return
                    }
                }),
            [request],
        )

        return {
            params,
            setParams,
            fetcher,
            logSource,
        }
    })
}

function withMaxMin<T extends Array<any> | Set<any> | Map<any, any> | null>(
    xs: T,
    max: number,
    min = 0,
): T | null {
    let size = 0
    if (Array.isArray(xs)) {
        size = xs.length
    } else if (xs instanceof Set) {
        size = xs.size
    } else if (xs instanceof Map) {
        size = xs.size
    }

    if (size >= max || size <= min) {
        return null
    } else {
        return xs
    }
}

function formatDuration(start: Date, end: Date) {
    const elapsed = end.getTime() - start.getTime()
    const seconds = elapsed / 1000

    const ss = Math.trunc(seconds % 60)
        .toString()
        .padStart(2, "0")
    const mm = Math.trunc(seconds / 60).toString()

    const mmClassName = seconds < 60 ? "mm" : ""

    const result = (
        <span>
            <span className={mmClassName}>{mm}m </span>
            <span>{ss}s</span>
        </span>
    )

    return result
}

function formatStartDate(
    start: string | null,
    now: Date | null,
    opts: {
        threshMinutes?: number
        threshHours?: number
        // threshDays?: number
    } = {},
) {
    if (!start) {
        return {
            content: "-",
        }
    }

    const d = new Date(start)
    now ??= new Date()

    const elapsed = now.getTime() - d.getTime()

    const seconds = elapsed / 1_000
    const minutes = seconds / 60
    const hours = seconds / 3600

    let content: string
    if (minutes <= (opts.threshMinutes ?? 120)) {
        content = `${Math.trunc(minutes)} minutes ago`
    } else if (hours <= (opts.threshHours ?? 48)) {
        content = `${Math.trunc(hours)} hours ago`
    } else {
        content =
            [
                `${d.getHours().toString().padStart(2, "0")}`,
                `${d.getMinutes().toString().padStart(2, "0")}`,
            ].join(":") +
            " " +
            [
                `${d.getDate().toString().padStart(2, "0")}`,
                `${(d.getMonth() + 1).toString().padStart(2, "0")}`,
                `${d.getFullYear()}`,
            ].join("-")
    }

    return {
        content,
        title: start,
    }
}

function formatCompletionType(x: LogSourceN.SearchResult) {
    const completionType = x.search.meta.completionType
    const round = x.search.meta.round

    let titleEl
    if (completionType !== "finish" && round) {
        if (completionType === "die") {
            titleEl = `Died on round ${round.end} / ${round.max}`
        } else if (completionType === "flee") {
            titleEl = `Flee on round ${round.end} / ${round.max}`
        }
    }

    let roundEl = round ? (
        <span>
            {round.end}
            {/* / {round.max} */}
        </span>
    ) : (
        <></>
    )
    let statusEl = <></>
    switch (completionType) {
        case "finish":
            statusEl = (
                <span className="finish flex justify-center">
                    <CheckIcon className="flex" />
                </span>
            )
            // sortValue = "9_done"
            break
        case "die":
            statusEl = (
                <span className="die flex justify-center gap-1 items-center">
                    <span className="w-5">
                        <Skull2Icon />
                    </span>

                    {roundEl}
                </span>
            )
            // sortValue = "1_die"
            break
        case "flee":
            statusEl = (
                <span className="flee flex justify-center gap-1 items-center">
                    <span className="w-6">
                        <RunIcon />
                    </span>

                    {roundEl}
                </span>
            )
            // sortValue = "2_flee"
            break
        default:
            statusEl = (
                <span className="flex justify-center gap-1 items-center">
                    <span className="">???</span>

                    {roundEl}
                </span>
            )
            // sortValue = "3_unknown"
            break
    }

    return {
        content: statusEl,
        title: titleEl,
    }
}

function useActionsPreproc(xs: Array<LogSourceN.SearchResult>) {
    const config = USERSCRIPT_CONFIG.useContext().config
    const db = useMemo(() => new LogDb(), [])
    const { toast } = TOASTER.useContext()

    const showDelete =
        config.showDelete === "yes" || config.showDelete === "warn"

    const showUpload =
        config.hvdataUploadMode !== "default" &&
        config.hvdataUploadMode !== "disabled"

    const onDelete = useCallback(
        async (x: LogSourceN.SearchResult) => {
            if (config.showDelete === "warn") {
                if (
                    !confirm(
                        `Delete ${x.search.meta.battleType?.id ?? "???"} log from ${x.meta.startedAt}?`,
                    )
                ) {
                    return
                }
            }
            await deleteLogs(db, [x.id])
        },
        [config],
    )

    const [uploadCount, setUploadCount] = useState(0)
    const onUpload = useCallback(
        async (x: LogSourceN.SearchResult) => {
            try {
                const logText = await LOG_DB_CACHE().rawCache.fetch(x.id)
                const resp = await HvDataN.uploadLog({
                    id: x.id,
                    logText,
                    config,
                })

                await db.put("logsHvdata", {
                    id: resp.id,
                    user: config.hvdataUser!,
                })

                setUploadCount(uploadCount + 1)
            } catch (e) {
                toast(
                    `Upload failed: ${truncateString(String(e), 30, "...")}`,
                    { error: true },
                )
            }
        },
        [config, uploadCount],
    )

    const req = useMemo(() => [...xs], [xs, uploadCount])
    const uploadFetch = useAsync2(async (xs) => {
        return await Promise.all(
            xs.map((x) => LOG_DB_CACHE().uploadCache.fetch(x.id)),
        )
    }, req)

    const ex = {
        showDelete,
        onDelete,
        showUpload,
        onUpload,
    }

    return {
        extras: xs.map((x, idx) => ({
            ...ex,
            upload: uploadFetch.data?.[idx] ?? null,
        })),
        deps: [config, uploadFetch],
    }
}
