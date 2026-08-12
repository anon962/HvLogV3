import { LogDb, LogDbConn } from "@/lib/db/db"
import { DbN } from "@/lib/db/dbN"
import { MigrateV2 } from "@/lib/db/migrateV2"
import { LabeledCheckbox } from "@/lib/ui/checkboxGroup"
import { Loader } from "@/lib/ui/loader"
import { Button } from "@/lib/ui/shadcn/button"
import { Input } from "@/lib/ui/shadcn/input"
import {
    CommonProps,
    compressZstd,
    css,
    decompressZstd,
    randomUint8Array,
    readZip,
    useAsync,
    useAsync2,
    writeZip,
} from "@/lib/utils/miscUtils"
import { mountReact } from "@/lib/utils/userscriptUtils"
import { unwrap } from "idb"
import {
    batched,
    clamp,
    cn,
    enumerate,
    L,
    throttle,
    truncateString,
} from "myutils"
import {
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

// #region command
export function registerLogExport() {
    mountReact(
        Dialog,
        {},
        {
            isDialog: true,
        },
    )

    window.GM_registerMenuCommand(
        "Log Import / Export",
        () =>
            mountReact(
                Dialog,
                {},
                {
                    isDialog: true,
                },
            ),
        {
            id: "export_logs",
        },
    )
}
// #endregion

// #region dialog
function Dialog() {
    const [show, setShow] = useState(true)

    const dialogRef = useRef<HTMLDialogElement>(null)
    useEffect(() => {
        show ? dialogRef.current?.showModal() : dialogRef.current?.close()
    }, [show])

    const {
        status,
        log,
        dbs,
        legacyStats,
        migrateOldDb,
        importOldFiles,
        downloadOldFiles,
    } = useImportState()
    const totalOld = legacyStats.idsP.size + legacyStats.idsI.size
    const totalDupes =
        legacyStats.currIdsP.intersection(legacyStats.idsP).size +
        legacyStats.currIdsI.intersection(legacyStats.idsI).size

    const [count, setCount] = useState(200)
    const [importFiles, setImportFiles] = useState([] as File[])

    return (
        <>
            <style>{CSS}</style>

            <dialog
                ref={dialogRef}
                className="log-mgr max-w-[80vw] max-h-[80vh] flex flex-col"
            >
                <Section
                    className="migration"
                    title="Log Migration"
                    desc={
                        <ul>
                            <li>
                                Import old logs from previous HvLog versions
                                (2.x and earlier). This is not automatic due to
                                possible data loss. (Previous versions did not
                                store the original log.)
                            </li>
                            <li>
                                After import, you should{" "}
                                <b>
                                    check for weirdness or download the old logs
                                    before deleting.
                                </b>{" "}
                                Issues can be reported in the forum thread.
                            </li>
                            <li>
                                Found <b>{totalOld}</b> old logs in database.{" "}
                                <b>
                                    <span className="underline text-red-400">
                                        {totalDupes}
                                    </span>{" "}
                                    / {totalOld}
                                </b>{" "}
                                have been imported and are ready for deletion.
                            </li>
                        </ul>
                    }
                    actions={[
                        [
                            <span>
                                Import
                                <Input
                                    value={count}
                                    min="1"
                                    max={totalOld}
                                    onInput={(ev) => {
                                        const v = parseInt(ev.target.value)
                                        if (!Number.isNaN(v)) {
                                            setCount(v)
                                        } else {
                                            setCount(0)
                                        }
                                    }}
                                    type="number"
                                    className="w-[10ch] inline mx-1"
                                />
                                logs
                            </span>,
                            <ActionButton
                                onClick={() =>
                                    migrateOldDb(clamp(count, 1, totalOld))
                                }
                                label="Import from DB"
                                loading={status.action !== null}
                            />,
                        ],
                        [
                            <LabeledCheckbox
                                label="Include ALL un-imported logs"
                                checked={true}
                                onCheckedChange={() => {}}
                                className="destructive"
                            />,
                            <ActionButton
                                onClick={() => {}}
                                label="Delete Old Logs"
                                loading={false}
                                className="destructive"
                            />,
                        ],
                        [
                            <span className="flex flex-col gap-1 items-center">
                                <Input
                                    onChange={(ev) =>
                                        setImportFiles(
                                            ev.target.files
                                                ? Array.from(ev.target.files)
                                                : [],
                                        )
                                    }
                                    type="file"
                                    multiple
                                    className="inline"
                                />
                            </span>,
                            <ActionButton
                                onClick={() => importOldFiles(importFiles)}
                                label="Import Old File"
                                loading={false}
                            />,
                        ],
                        [
                            <span>Export old logs</span>,
                            <ActionButton
                                onClick={() => downloadOldFiles()}
                                label="Download Old Files"
                                loading={false}
                            />,
                        ],
                    ]}
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
            lines.els.push(<pre>{ln}</pre>)
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
                {...props.actions.flatMap(([l, r]) => [l, r])}
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
            className={cn("relative", props.className)}
            disabled={props.disabled || props.loading}
            onClick={props.onClick}
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
function useImportState() {
    const [log, setLog] = useState({ lines: [] as string[] })
    const tStart = useMemo(() => performance.now(), [])
    useEffect(() => {
        L.sinks["legacy_import"] = {
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
                log.lines.push(toPush)

                setLog({ ...log })
            },
        }
        return () => {
            delete L.sinks["legacy_import"]
        }
    }, [])

    const dbFetch = useAsync(async () => {
        return {
            dbP: await new LogDb({
                world: "persistent",
            }).connect(),
            dbI: await new LogDb({
                world: "isekai",
            }).connect(),
        }
    }, true)
    const dbs = useMemo(
        () =>
            dbFetch.data
                ? { ready: true as const, ...dbFetch.data }
                : {
                      ready: false as const,
                      dbP: null,
                      dbI: null,
                  },
        [dbFetch.data],
    )

    const [legacyStatsFetchVersion, setLegacyStatsFetchVersion] = useState(0)
    const legacyStatsFetchKey = useMemo(
        () => ({ dbs, legacyStatsFetchVersion }),
        [dbs, legacyStatsFetchVersion],
    )
    const legacyStatsFetch = useAsync2(async ({ dbs }) => {
        if (!dbs.ready) {
            return
        }

        const idsP = new Set(await MigrateV2.selectKeys(unwrap(dbs.dbP)))
        const idsI = new Set(await MigrateV2.selectKeys(unwrap(dbs.dbI)))

        const currIdsP = new Set(
            await dbs.dbP.getAllKeys("logsMeta"),
        ) as Set<string>
        const currIdsI = new Set(
            await dbs.dbI.getAllKeys("logsMeta"),
        ) as Set<string>

        L.info(
            `Found ${idsP.size + idsI.size} old logs with ${idsP.intersection(currIdsP).size + idsI.intersection(currIdsI).size} ready for deletion`,
        )

        return {
            idsP,
            idsI,
            currIdsP,
            currIdsI,
        }
    }, legacyStatsFetchKey)

    const legacyStats = legacyStatsFetch.data ?? {
        idsP: new Set<string>(),
        idsI: new Set<string>(),
        currIdsP: new Set<string>(),
        currIdsI: new Set<string>(),
    }

    const [status, setStatus] = useState({
        action: null as string | null,
        pending: {
            migrateOldDb: null as null | { count: number },
            importOldFiles: null as null | { files: File[] },
            downloadOldFiles: null as null | {},
        },
    })
    useEffect(() => {
        if (status.action !== null) {
            return
        }

        if (!dbs.ready) {
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
                    setLegacyStatsFetchVersion(legacyStatsFetchVersion + 1)
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

        if (status.pending.migrateOldDb && legacyStatsFetch.data) {
            runAction(
                "migrateOldDb",
                migrateOldDb({
                    ...status.pending.migrateOldDb,
                    dbs,
                    stats: legacyStatsFetch.data,
                }),
            )
        } else if (status.pending.importOldFiles && legacyStatsFetch.data) {
            runAction(
                "importOldFiles",
                importOldFiles({
                    ...status.pending.importOldFiles,
                    dbs,
                    stats: legacyStatsFetch.data,
                }),
            )
        } else if (status.pending.downloadOldFiles && legacyStatsFetch.data) {
            runAction(
                "downloadOldFiles",
                downloadOldFiles({
                    ...status.pending.downloadOldFiles,
                    dbs,
                    stats: legacyStatsFetch.data,
                }),
            )
        }
    }, [status, dbs])

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
        log,
        dbs,
        legacyStats,
        migrateOldDb: (count: number) => queueAction("migrateOldDb", { count }),
        importOldFiles: (files: File[]) =>
            queueAction("importOldFiles", { files }),
        downloadOldFiles: () => queueAction("downloadOldFiles", {}),
    }

    // #region migrateOldDb
    async function migrateOldDb(opts: {
        count: number
        dbs: typeof dbs & { ready: true }
        stats: typeof legacyStats
    }) {
        const nonDupesP = opts.stats.idsP.difference(opts.stats.currIdsP)
        const nonDupesI = opts.stats.idsI.difference(opts.stats.currIdsI)

        let count = 0
        const idsP = [...nonDupesP, ...opts.stats.idsP]
        const idsI = [...nonDupesI, ...opts.stats.idsI]
        const total = Math.min(opts.count, idsP.length + idsI.length)

        const [logImportStatus, cancelLog] = throttle({
            interval: 3000,
            fn: () => L.info(`Importing logs ${count} / ${total} ...`),
        })

        for (const [db, ids, world] of [
            [opts.dbs.dbP, idsP, "persistent"],
            [opts.dbs.dbI, idsI, "isekai"],
        ] as const) {
            for (const idBatch of batched(ids, 50)) {
                const toInsert: Array<ImportFormat> = []
                for (const id of idBatch) {
                    if (count + 1 > opts.count) {
                        break
                    }

                    try {
                        logImportStatus()
                        const oldLog = await MigrateV2.selectLog(unwrap(db), id)
                        const newLog = {
                            id,
                            world,
                            meta: {
                                start: oldLog.meta.start,
                                lastUpdate: oldLog.meta.lastUpdate,
                            },
                            lines: oldLog.entries.map((x) =>
                                MigrateV2.reverseEntry(x),
                            ),
                        } as const
                        toInsert.push(newLog)
                        count += 1
                    } catch (e) {
                        L.error(e)
                        continue
                    }
                }
                if (toInsert.length === 0) {
                    break
                }

                await importOldLogs({
                    dbP: opts.dbs.dbP,
                    dbI: opts.dbs.dbI,
                    logs: toInsert,
                    cb: (_, idx) => logImportStatus(),
                })
            }
        }

        cancelLog()
        L.info(`Imported ${count} logs!`)
    }
    // #endregion
    // #region importOldFiles
    async function importOldFiles(opts: {
        files: File[]
        dbs: typeof dbs & { ready: true }
        stats: typeof legacyStats
    }) {
        const stats = {
            ids: new Set<string>(),
            byteCount: 0,
        }

        for (const file of opts.files) {
            const name = file.name.toLowerCase()

            L.info(`Reading ${file.name} ...`)
            const [status, cancelStatus] = throttle({
                fn: (idx: number, total: number) =>
                    L.info(
                        `Importing old logs from ${file.name} (${idx + 1} / ${total}) ...`,
                    ),
                interval: 2000,
            })

            try {
                if (name.endsWith("jsonl.gz") || name.endsWith("jsonl")) {
                    let fromFile = await MigrateV2.readJsonlExport(file)

                    const { byteCount } = await importOldLogs({
                        dbP: opts.dbs.dbP,
                        dbI: opts.dbs.dbI,
                        logs: fromFile,
                        cb: (stats, idx) => status(idx, fromFile.length),
                    })
                    stats.byteCount += byteCount
                    for (const l of fromFile) {
                        stats.ids.add(l.id)
                    }
                    cancelStatus()
                } else if (
                    name.endsWith("zip.zstd") ||
                    name.endsWith("zip") ||
                    name.endsWith("json")
                ) {
                    let jsonData: Array<{
                        data: string
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

                    if (name.endsWith("zip.zstd")) {
                        try {
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

                    let logs: Array<DownloadFormat> = []
                    if (zipData) {
                        for await (const { filename, data } of readZip({
                            data: zipData.data,
                            type: "string",
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
                                data: await new Blob([x.data]).text(),
                                blame: x.blame,
                            })
                        } catch (e) {
                            L.error(e)
                            L.error(
                                `Unable to read text file ${x.blame.join("->")}`,
                            )
                        }
                    }
                    for (const x of jsonData) {
                        try {
                            logs.push(JSON.parse(x.data))
                        } catch (e) {
                            L.error(e)
                            L.error(
                                `Unable to parse JSON data from file ${x.blame.join("->")}: ${truncateString(x.data, 50, "...")}`,
                            )
                        }
                    }

                    const { byteCount } = await importOldLogs({
                        dbP: opts.dbs.dbP,
                        dbI: opts.dbs.dbI,
                        logs: logs.map((l) => ({
                            id: l.id,
                            world: l.world,
                            meta: {
                                start: l.meta.start,
                                lastUpdate: l.meta.lastUpdate,
                            },
                            lines: l.entries.map((x) =>
                                MigrateV2.reverseEntry(x),
                            ),
                        })),
                        cb: (stats, idx) => status(idx, logs.length),
                    })
                    stats.byteCount += byteCount
                    for (const l of logs) {
                        stats.ids.add(l.id)
                    }
                    cancelStatus()
                } else {
                    L.error(`Invalid file type: ${file.name}`)
                }
            } catch (e) {
                L.error(e)
                continue
            }
        }

        const dupes = stats.ids.intersection(
            opts.stats.currIdsP.union(opts.stats.currIdsI),
        )
        L.info(
            `Imported ${stats.ids.size} logs (${(stats.byteCount / 1024 / 1024).toFixed(1)} MiB / ${dupes.size} dupes) from ${opts.files.map((f) => f.name)}`,
        )
    }
    // #endregion
    // #region downloadOldFiles
    type DownloadFormat = MigrateV2.Log & { world: "persistent" | "isekai" }
    async function downloadOldFiles(opts: {
        dbs: typeof dbs & { ready: true }
        stats: typeof legacyStats
    }) {
        const batchSize = 100
        const toExport = [
            ...[...opts.stats.idsP].map(
                (id) => ({ world: "persistent", id }) as const,
            ),
            ...[...opts.stats.idsI].map(
                (id) => ({ world: "isekai", id }) as const,
            ),
        ]
        const batches = batched(toExport, batchSize)
        L.info(
            `Exporting ${opts.stats.idsP} persistent logs and ${opts.stats.idsI} isekai logs in ${batches.length} batches of ${batchSize}.`,
        )

        const d = new Date()
        const fileNameBase = [
            d.getFullYear() + "-",
            String(d.getMonth() + 1).padStart(2, "0"),
            "-" + String(d.getDate()).padStart(2, "0"),
            "_" + String(d.getHours()).padStart(2, "0"),
            String(d.getMinutes()).padStart(2, "0"),
            String(d.getSeconds()).padStart(2, "0"),
        ].join("")

        for (const [batchIdx, batch] of enumerate(batches)) {
            const startIdx = batchIdx * batchSize
            L.info(
                `Exporting logs ${startIdx + 1} to ${startIdx + batch.length}`,
            )

            const logs: Array<DownloadFormat> = []
            for (const world of ["persistent", "isekai"] as const) {
                logs.push(
                    ...(
                        await Promise.all(
                            batch
                                .filter((x) => x.world === world)
                                .map(({ id }) =>
                                    MigrateV2.selectLog(
                                        unwrap(opts.dbs.dbP),
                                        id,
                                    ),
                                ),
                        )
                    ).map((x) => ({ ...x, world })),
                )
            }

            const zipBlob = await writeZip(
                Object.fromEntries(
                    logs.map(
                        (l) => [l.id + ".json", JSON.stringify(l)] as const,
                    ),
                ),
            )

            const compressed = await compressZstd({ x: zipBlob, pool: true })

            const fileName =
                fileNameBase + `_p${String(batchIdx).padStart(3, "0")}.zip.zstd`
            const downloadEl = Object.assign(document.createElement("a"), {
                download: fileName,
                href: URL.createObjectURL(new Blob([compressed])),
            })
            document.body.appendChild(downloadEl)
            downloadEl.click()
            downloadEl.remove()
        }
    }

    // #region importOldLogs
    type ImportFormat = {
        id: string
        world: "persistent" | "isekai"
        meta: MigrateV2.Log["meta"]
        lines: string[]
    }
    type ImportStats = {
        byteCount: number
    }
    async function importOldLogs(opts: {
        dbP: LogDbConn
        dbI: LogDbConn
        logs: Array<ImportFormat>
        cb?: (stats: ImportStats, idx: number) => void
    }): Promise<ImportStats> {
        const stats: ImportStats = {
            byteCount: 0,
        }
        let idx = 0
        for (const batch of batched(opts.logs, 10)) {
            opts.cb?.(stats, idx)

            const logs = await Promise.all(
                batch.map(async (l) => ({
                    meta: {
                        id: l.id,
                        start: l.meta.start,
                        lastUpdate: l.meta.lastUpdate,
                        version: 0,
                        world: l.world,
                        user_id: null,
                        user_name: null,
                    },
                    raw: {
                        id: l.id,
                        compressed: 10,
                        raw: null,
                        raw_c: await compressZstd({
                            x: l.lines.join("\n"),
                            level: 10,
                            pool: true,
                        }),
                        // compressed: 0,
                        // raw: l.lines.join("\n"),
                        // raw_c: null,
                    },
                })),
            )

            for (const l of logs) {
                stats.byteCount += l.raw.raw_c.byteLength
            }

            for (const [world, db] of [
                ["persistent", opts.dbP],
                ["isekai", opts.dbI],
            ] as const) {
                const txn = db.transaction(["logsMeta", "logsRaw"], "readwrite")
                for (const l of logs) {
                    if (l.meta.world === world) {
                        await txn.objectStore("logsMeta").put(l.meta)
                        await txn.objectStore("logsRaw").put(l.raw)
                    }
                }
                txn.commit()
            }

            idx += batch.length
        }

        return stats
    }
    // #endregion
}
// #endregion
// #endregion

// #region css
const CSS = css`
    dialog {
        max-width: min(80vw, 50em);
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

        section > hr {
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
