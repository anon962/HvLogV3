import { HV_WORLDS } from "@/lib/constants"
import { deleteLogs, LogDb } from "@/lib/db/db"
import { DbN } from "@/lib/db/dbN"
import { LOG_PROCESSING_LOCK } from "@/lib/db/logSource"
import { TASK_LOCK } from "@/lib/db/userscriptTasks"
import { Loader } from "@/lib/ui/loader"
import { Button } from "@/lib/ui/shadcn/button"
import { Input } from "@/lib/ui/shadcn/input"
import {
    CommonProps,
    compressZstd,
    decompressZstd,
    formatMiB,
    mountReact,
    readZip,
    writeZip,
} from "@/lib/utils/miscUtils"
import { XIcon } from "lucide-react"
import {
    alphabeticalBy,
    AsyncLock,
    batched,
    cn,
    css,
    enumerate,
    fillDateTemplate,
    ISODate,
    L,
    objectValues,
    sum,
    throttle,
    truncateString,
} from "myutils"
import {
    Fragment,
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

export function registerLogManager() {
    window.GM_registerMenuCommand("Manage Logs", () => mountReact(Dialog, {}), {
        id: "manage_logs",
    })
}

// #region dialog
function Dialog() {
    const dialogRef = useRef<HTMLDialogElement>(null)
    useEffect(() => {
        dialogRef.current?.showModal()
    }, [dialogRef?.current])

    const { status, log, exportLogs, importLogs, deleteLogs_ } =
        useManagerState()
    const isBusy = useMemo(
        () =>
            (status.action !== null && status.action !== "initLogs") ||
            Object.values(status.pending).some((x) => x !== null),
        [status],
    )

    const tryClose = useCallback(() => {
        if (isBusy) {
            return false
        }
        if (!dialogRef.current) {
            return
        }
        dialogRef.current.dispatchEvent(
            new Event("hvlog:unmount", { bubbles: true }),
        )
        return true
    }, [dialogRef.current, isBusy])

    const totals = useMemo(() => {
        const logs = [...objectValues(status.logs)]

        return {
            count: logs.length,
            sizeRaw: sum(logs.map((l) => l.sizeRaw)),
            sizeComp: sum(logs.map((l) => l.sizeComp)),
            legacyCount: logs.filter((l) => l.isLegacy).length,
        }
    }, [status])

    const [importFiles, setImportFiles] = useState([] as File[])
    const [delStart, setDelStart] = useState(new Date("2000-01-01"))
    const [delEnd, setDelEnd] = useState(new Date("2099-01-01"))

    const dateDeletions = useMemo(() => {
        const st = delStart.toISOString()
        const end = delEnd.toISOString()
        const ids = Object.values(status.logs)
            .filter((l) => l.startedAt >= st)
            .filter((l) => l.startedAt <= end)
            .map((l) => l.id)
        return ids
    }, [status, delStart, delEnd])
    const legacyDeletions = useMemo(() => {
        const ids = Object.values(status.logs)
            .filter((l) => l.isLegacy)
            .map((l) => l.id)
        return ids
    }, [status])

    const actions: Array<[ReactNode, ReactNode]> = [
        [
            <span></span>,
            <ActionButton
                onClick={() => exportLogs()}
                label="Export All Logs"
                loading={isBusy}
            />,
        ],
        [
            <span className="flex flex-col gap-1 items-center">
                <Input
                    onChange={(ev) => {
                        setImportFiles([...(ev.target.files ?? [])])
                    }}
                    type="file"
                    accept=".zip.zst,.zip,.json"
                    multiple
                    className="inline"
                    disabled={isBusy}
                />
            </span>,
            <ActionButton
                onClick={() => importLogs(importFiles)}
                label="Import Logs"
                loading={isBusy}
                disabled={importFiles.length === 0}
            />,
        ],
        [
            <div className="flex flex-col">
                <span className="inline-flex gap-1 w-full justify-end items-center">
                    <span className="shrink-0">
                        Delete {dateDeletions.length} old logs from
                    </span>
                    <Input
                        className="max-w-[12em]"
                        type="date"
                        value={delStart.toISOString().split("T")[0]}
                        onInput={(ev) =>
                            ev.target.valueAsDate
                                ? setDelStart(ev.target.valueAsDate)
                                : null
                        }
                    />
                    <span>to</span>
                    <Input
                        className="max-w-[12em]"
                        type="date"
                        value={delEnd.toISOString().split("T")[0]}
                        onInput={(ev) =>
                            ev.target.valueAsDate
                                ? setDelEnd(ev.target.valueAsDate)
                                : null
                        }
                    />
                </span>
                <span className="text-end">(including end date, utc time)</span>
            </div>,
            <ActionButton
                onClick={() => {
                    if (confirm(`Logs can not be un-deleted! Are you sure?`)) {
                        deleteLogs_(dateDeletions)
                    }
                }}
                label="Delete Old Logs"
                loading={isBusy}
                disabled={dateDeletions.length === 0}
            />,
        ],
    ]
    if (totals.legacyCount > 0) {
        actions.push([
            <span>
                Delete {legacyDeletions.length} logs from version {"<"}2.x
            </span>,
            <ActionButton
                onClick={() => {
                    if (confirm(`Logs can not be un-deleted! Are you sure?`)) {
                        deleteLogs_(legacyDeletions)
                    }
                }}
                label="Delete Jank Logs"
                loading={isBusy}
            />,
        ])
    }

    return (
        <>
            <style>{CSS}</style>

            <dialog
                ref={dialogRef}
                className="log-mgr max-w-[80vw] max-h-[80vh] flex flex-col"
                onCancel={(ev) => {
                    const didClose = tryClose()
                    if (!didClose) {
                        ev.preventDefault()
                    }
                }}
                onClick={(ev) => {
                    if (ev.target === dialogRef.current) {
                        tryClose()
                    }
                }}
            >
                <button
                    onClick={() => tryClose()}
                    disabled={isBusy}
                    className="absolute rounded-full bg-transparent hover:bg-foreground/10 top-[0.5em] right-[0.5em] h-[2.5em] w-[2.5em] p-[0.25em] disabled:text-muted! disabled:pointer-events-none:"
                >
                    <XIcon className="size-full" />
                </button>

                <Section
                    title="Log Manager"
                    desc={
                        <ul>
                            <li>
                                Logs can be exported to / imported from .zip and
                                .zip.zst archives containing JSON files.
                            </li>
                            <li>
                                Found <b>{totals.count}</b> logs totaling{" "}
                                <b>{formatMiB(totals.sizeComp)} MiB</b>{" "}
                                compressed /{" "}
                                <b>{formatMiB(totals.sizeRaw)} MiB</b>{" "}
                                uncompressed.
                            </li>
                        </ul>
                    }
                    actions={actions}
                    log={log}
                />

                <hr></hr>
            </dialog>
        </>
    )
}
// #endregion

// #region section
function Section(
    props: {
        title: string
        desc: ReactNode
        actions: Array<[ReactNode, ReactNode]>
        log: { lines: string[] }
    } & CommonProps,
) {
    const [lines, setLineEls] = useState({ els: [] as Array<ReactNode> })

    useEffect(() => {
        const newLines = props.log.lines.slice(lines.els.length)
        if (newLines.length === 0) {
            return
        }

        for (const ln of newLines) {
            lines.els.push(<pre key={lines.els.length}>{ln}</pre>)
        }
        setLineEls({
            els: lines.els,
        })
    }, [props.log])

    return (
        <section className={cn(props.className)}>
            <div>
                <h1>{props.title}</h1>
                {props.desc}
            </div>

            <hr></hr>
            <div className="actions">
                {...props.actions
                    .flatMap(([l, r]) => [l, r])
                    .map((x, idx) => <Fragment key={idx}>{x}</Fragment>)}
            </div>

            <hr></hr>
            <div className="event-log">{...lines.els}</div>
        </section>
    )
}
// #endregion

// #region button
function ActionButton(
    props: {
        label: string
        loading: boolean
        disabled?: boolean
        onClick: () => void
    } & CommonProps,
) {
    return (
        <Button
            className={cn(
                "relative bg-gray-600 hover:bg-gray-700",
                props.className,
            )}
            disabled={props.disabled || props.loading}
            onClick={props.onClick}
            variant="secondary"
        >
            <span className={cn(props.loading ? "invisible" : "")}>
                {props.label}
            </span>
            <span className="absolute">
                <Loader show={props.loading} />
            </span>
        </Button>
    )
}
// #endregion

// #region state
function useManagerState() {
    const [logLines, setLogLines] = useState({ lines: [] as string[] })
    const tStart = useMemo(() => performance.now(), [])

    useLogMonitor()
    const dbFetch = useMemo(async () => {
        return await (
            await new LogDb().connect()
        ).conn
    }, [])

    const logs = useRef(
        {} as Record<
            DbN.LogId,
            {
                id: DbN.LogId
                world: DbN.HvWorld
                startedAt: ISODate
                isLegacy: boolean
                sizeComp: number
                sizeRaw: number
            }
        >,
    )

    const [status, setStatus] = useState({
        action: "initLogs" as string | null,
        lock: new AsyncLock(),
        logs: logs.current,
        pending: {
            export: null as null | {},
            import: null as null | { files: File[] },
            delete: null as null | { ids: Array<DbN.LogId> },
        },
    })
    type Status = typeof status
    initLogs()

    useActionRunner(status)

    const queueAction = useCallback(
        <T extends keyof (typeof status)["pending"]>(
            key: T,
            fnOpts: Exclude<(typeof status)["pending"][T], null>,
        ) => {
            setStatus({
                ...status,
                pending: {
                    ...status.pending,
                    [key]: status.pending[key] ?? fnOpts,
                },
            })
        },
        [status],
    )

    return {
        status,
        log: logLines,
        exportLogs: () => queueAction("export", {}),
        importLogs: (files: File[]) => queueAction("import", { files }),
        deleteLogs_: (ids: Array<DbN.LogId>) => queueAction("delete", { ids }),
    }

    // #region useLogScan
    function initLogs() {
        useEffect(() => {
            setStatus((x) => ({ ...x, action: "scan" }))
            async function run() {
                const lock = await status.lock.acquire()
                const db = await dbFetch

                let stats = {
                    count: 0,
                    size: 0,
                    uncompCount: 0,
                }

                const ids = await db.getAllKeys("logsMeta")

                const [statusLog, cancelStatusLog] = throttle({
                    interval: 3000,
                    fn: () =>
                        L.info(
                            `Scanning logs (${stats.count} / ${ids.length} / ${formatMiB(stats.size)} MiB) ...`,
                        ),
                })

                for (const id of ids) {
                    statusLog()

                    const meta = (await db.get("logsMeta", id))!
                    const raw = (await db.get("logsRaw", id))!

                    status.logs[id] = {
                        id,
                        world: meta.world,
                        startedAt: meta.startedAt,
                        sizeRaw: raw.raw_size,
                        sizeComp: raw.raw_c?.byteLength || 0,
                        isLegacy: !!meta.reversed,
                    }

                    stats.count += 1
                    stats.size += raw.raw_c?.byteLength || raw.raw?.length || 0
                    if (!raw.raw_c) {
                        stats.uncompCount += 1
                    }
                }

                cancelStatusLog()

                L.info(
                    `Found ${stats.count} logs totaling ${formatMiB(stats.size)} MiB`,
                )

                setStatus((x) => ({ ...x, action: null }))
                lock.release()
            }
            run()
        }, [])
    }
    // #endregion

    function useLogMonitor() {
        useEffect(() => {
            L.sinks["log_manager"] = {
                disabled: false,
                call: (level, msg, ...rest) => {
                    const elapsed = performance.now() - tStart
                    const joined =
                        `[${(elapsed / 1000).toFixed(3)}s] [${level.toUpperCase().padEnd(5)}] - ` +
                        [msg, ...rest]
                            .map((x) => {
                                try {
                                    return JSON.stringify(x)
                                } catch (e) {
                                    return String(x)
                                }
                            })
                            .join(" ")

                    const maxLength = 500
                    const toPush =
                        joined.length >= maxLength
                            ? joined.slice(0, maxLength - 3) + "..."
                            : joined
                    logLines.lines.push(toPush)

                    setLogLines({ ...logLines })
                },
            }
            return () => {
                delete L.sinks["log_manager"]
            }
        }, [])
    }

    // #region useActionRunner
    function useActionRunner(status: Status) {
        useEffect(() => {
            if (status.action !== null) {
                return
            }

            const runAction = (
                key: keyof (typeof status)["pending"],
                result: Promise<void>,
            ) => {
                setStatus((status) => ({ ...status, action: key }))
                result
                    .catch((e) => {
                        L.error(e)
                    })
                    .finally(() => {
                        setStatus((status) => ({
                            ...status,
                            action: null,
                            pending: {
                                ...status.pending,
                                [key]: null,
                            },
                        }))
                    })
            }

            if (status.pending.export) {
                runAction(
                    "export",
                    exportLogs({
                        logs: status["logs"],
                        ...status.pending.export,
                    }),
                )
            } else if (status.pending.import) {
                runAction(
                    "import",
                    importLogs({
                        ...status.pending.import,
                    }),
                )
            } else if (status.pending.delete) {
                runAction(
                    "delete",
                    deleteLogs_({
                        ...status.pending.delete,
                    }),
                )
            }
        }, [status])
    }
    // #endregion

    // #region exportLogs
    async function exportLogs(opts: { logs: Status["logs"] }) {
        const BATCH_SIZE = 100
        const fileNameBase = fillDateTemplate(
            new Date(),
            `hvlog_${String(Math.random()).slice(3, 6)}_yyyy_MM_dd_`,
        )

        const db = await dbFetch

        let idx = 0
        const [statusLog, cancelStatusLog] = throttle({
            interval: 3000,
            fn: () => L.info(`Exporting logs (${idx} / ${allLogs.length}) ...`),
        })

        const allLogs = alphabeticalBy(
            Object.values(opts.logs),
            (x) => x.startedAt,
        )
        const batches = batched(allLogs, BATCH_SIZE)
        for (const [batchIdx, batch] of enumerate(batches)) {
            const toDownload: Array<V3Export> = []

            for (const log of batch) {
                idx += 1
                statusLog()

                const meta = (await db.get("logsMeta", log.id))!
                const raw = (await db.get("logsRaw", log.id))!

                let text
                if (raw.raw_c) {
                    const decompressed = await decompressZstd({
                        x: raw.raw_c,
                    })
                    text = await new Blob([decompressed]).text()
                } else {
                    text = raw.raw
                }

                toDownload.push({
                    id: meta.id,
                    type: "v3_export",
                    meta,
                    raw: {
                        ...raw,
                        compressed: 0,
                        raw: text,
                        raw_c: null,
                    },
                })
            }

            const zipBlob = await writeZip(
                Object.fromEntries(
                    toDownload.map(
                        (x) =>
                            [
                                x.meta.world + "_" + x.id + ".json",
                                JSON.stringify(x),
                            ] as const,
                    ),
                ),
            )
            const compressed = await compressZstd({ x: zipBlob, pool: true })
            const fileName =
                fileNameBase + `p${String(batchIdx).padStart(3, "0")}.zip.zst`
            const downloadEl = Object.assign(document.createElement("a"), {
                download: fileName,
                href: URL.createObjectURL(new Blob([compressed])),
            })
            document.body.appendChild(downloadEl)
            downloadEl.click()
            downloadEl.remove()
        }

        cancelStatusLog()
    }
    // #endregion
    // #region importLogs
    async function importLogs(opts: { files: File[] }) {
        for (const file of opts.files) {
            const name = file.name.toLowerCase()

            L.info(`Reading ${file.name} ...`)

            let jsonData: Array<{
                data: Blob
                blame: string[]
            }> = []
            let textData: Array<{
                data: Uint8Array<ArrayBuffer>
                blame: string[]
            }> = []
            let zipData: {
                data: Uint8Array<ArrayBuffer>
                blame: string[]
            } | null = null

            if (name.endsWith("zip.zst")) {
                try {
                    L.info(`Decompressing ${file.name}`)
                    const bytes = await file.bytes()
                    zipData = {
                        data: await decompressZstd({
                            x: bytes,
                        }),
                        blame: [file.name],
                    }
                } catch (e) {
                    L.error(e)
                    L.error(`Failed to decompress ${file.name}`)
                    continue
                }
            } else if (file.name.endsWith("zip")) {
                zipData = {
                    data: await file.bytes(),
                    blame: [file.name],
                }
            } else if (file.name.endsWith("json")) {
                textData.push({
                    data: await file.bytes(),
                    blame: [file.name],
                })
            }

            if (zipData) {
                L.info(`Unzipping`, file.name)
                for await (const { filename, data } of readZip({
                    data: zipData.data,
                    type: "blob",
                    onFail: (e, x) => {
                        L.error(e)
                        L.error(
                            `Unable to read text file ${[...zipData.blame, x.filename].join("->")}`,
                        )
                    },
                })) {
                    jsonData.push({
                        data,
                        blame: [...zipData.blame, filename],
                    })
                }
            }
            for (const x of textData) {
                try {
                    jsonData.push({
                        data: new Blob([x.data]),
                        blame: x.blame,
                    })
                } catch (e) {
                    L.error(e)
                    L.error(`Unable to read text file ${x.blame.join("->")}`)
                }
            }

            const locks = [
                await TASK_LOCK.acquire(),
                await LOG_PROCESSING_LOCK.acquire(),
            ]

            const db = await dbFetch
            const stats = {
                count: 0,
                ids: new Set<string>(),
                size: 0,
                total: jsonData.length,
            }
            const [statusLog, cancelStatusLog] = throttle({
                fn: () =>
                    L.info(
                        `Importing logs from ${file.name} (${stats.count} / ${stats.total}) ...`,
                    ),
                interval: 5000,
            })
            for (const x of jsonData) {
                stats.count += 1
                statusLog()

                try {
                    const d: V3Export = await new Response(x.data).json()
                    if (d.type !== "v3_export") {
                        L.error(
                            `JSON file does not contain a log: ${x.blame.join("->")}`,
                        )
                        continue
                    }

                    const rawBytes = new TextEncoder().encode(d.raw.raw)
                    const compressed = await compressZstd({
                        x: rawBytes,
                        level: 10,
                        pool: true,
                    })

                    const txn = db.transaction(
                        ["logsMeta", "logsRaw"],
                        "readwrite",
                    )
                    await txn.objectStore("logsMeta").put(d.meta)
                    await txn.objectStore("logsRaw").put({
                        ...d.raw,
                        compressed: 10,
                        raw: null,
                        raw_size: rawBytes.byteLength,
                        raw_c: compressed,
                    })
                    txn.commit()

                    stats.ids.add(d.id)
                    stats.size += compressed.byteLength
                    status.logs[d.id] = {
                        id: d.id,
                        world: d.meta.world,
                        startedAt: d.meta.startedAt,
                        sizeRaw: rawBytes.byteLength,
                        sizeComp: compressed.byteLength,
                        isLegacy: !!d.meta.reversed,
                    }
                } catch (e) {
                    L.error(e)
                    L.error(
                        `Unable to parse JSON data from file ${x.blame.join("->")}`,
                    )
                }
            }

            L.info(
                `Imported ${stats.ids.size} logs from ${file.name} (${formatMiB(stats.size)} MiB compressed)`,
            )
            cancelStatusLog()

            const done =
                ((await db.get("kv", "compressDone")) as Set<DbN.LogId>) ??
                new Set()
            await db.put("kv", done.union(stats.ids), "compressDone")
            locks.forEach((lock) => lock.release())
        }
    }
    // #endregion
    // #region deleteLogs
    async function deleteLogs_(opts: { ids: Array<DbN.LogId> }) {
        const db = await dbFetch
        for (const world of HV_WORLDS) {
            const idsForWorld = [...opts.ids].filter(
                (id) => status.logs[id].world === world,
            )
            if (!idsForWorld) {
                continue
            }

            L.info(`Deleting ${idsForWorld.length} ${world} logs ...`)
            const txn = db.transaction(
                [
                    "logsRaw",
                    "logsMeta",
                    "summariesForMeta",
                    "summariesForSearch",
                ],
                "readwrite",
            )
            await deleteLogs(txn, idsForWorld)
        }

        for (const id of opts.ids) {
            delete status.logs[id]
        }
    }
    // #endregion
}
// #endregion

type V3Export = {
    id: DbN.LogId
    type: "v3_export"
    meta: DbN.IdbSchema["logsMeta"][DbN.LogId]
    raw: DbN.IdbSchema["logsRaw"][DbN.LogId] & { raw: string }
}

// #region css
const CSS = css`
    dialog {
        width: 100%;
        max-width: min(80vw, 54em);
        max-height: min(80vh, 80em);
    }

    .log-mgr {
        height: 100%;
        & > section {
            display: flex;
            flex-flow: column;
            height: 100%;
        }
        .event-log {
            height: 100%;
            flex: 1 1 0;
        }

        font-size: 0.8rem;
        h1 {
            font-weight: 700;
            font-size: 1rem;
        }

        padding: 0;
        section > *:not(hr) {
            padding: 1em 2em;
        }
        section > hr {
            margin: 0 2em;
        }

        hr {
            border-color: color-mix(
                in oklch,
                var(--border-color),
                transparent 20%
            );
        }

        .actions {
            display: grid;
            grid-template-columns: 1fr max-content;
            justify-items: end;
            align-items: center;
            gap: 0.5em 1em;

            button:not([role="checkbox"]) {
                width: 100%;
                min-width: 6em;
                height: 2.5em;

                background-color: var(--color-gray-500);
                &:hover {
                    background-color: var(--color-gray-600);
                }
            }

            input {
                display: inline;
            }
        }

        .event-log {
            font-family: monospace;
            background-color: color-mix(
                in oklch,
                var(--background),
                transparent 50%
            );
            color: color-mix(
                in oklch,
                var(--color-foreground),
                transparent 25%
            );
            margin: 1em 2em;
            border-radius: 1em;
            font-size: 0.7rem;
            display: flex;
            flex-flow: column;
            line-height: 1.25;
            gap: 0.5em;
            overflow: auto;

            & > pre {
                white-space: wrap;
            }
        }
    }
`
// #endregion
