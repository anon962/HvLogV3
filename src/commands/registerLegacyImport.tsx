import { LogDb } from "@/lib/db/db"
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
    useAsync,
    useAsync2,
} from "@/lib/utils/miscUtils"
import { mountReact } from "@/lib/utils/userscriptUtils"
import { unwrap } from "idb"
import { cn, L, throttle } from "myutils"
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

    const { status, log, dbs, legacyStats, migrateOldDb, importOldFiles } =
        useImportState()
    const totalOld = legacyStats.idsP.size + legacyStats.idsI.size
    const totalDupes =
        legacyStats.currIdsP.intersection(legacyStats.idsP).size +
        legacyStats.currIdsI.intersection(legacyStats.idsI).size

    const [count, setCount] = useState(250)
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
                                    {totalDupes} / {totalOld}
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
                                    min="0"
                                    max={totalOld}
                                    onChange={(ev) => {
                                        const v = parseInt(ev.target.value)
                                        if (!Number.isNaN(v)) {
                                            setCount(v)
                                        }
                                    }}
                                    type="number"
                                    className="w-[10ch] inline mx-1"
                                />
                                logs
                            </span>,
                            <ActionButton
                                onClick={() =>
                                    migrateOldDb(Math.min(count, totalOld))
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
                                onClick={() => {}}
                                label="Download Old File"
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

    const [legacyStatsVersion, setLegacyStatsVersion] = useState(0)
    const legacyStatsFetch = useAsync2(
        async ({ legacyStatsVersion, dbs }) => {
            if (!dbs.ready) {
                return
            }

            const idsP = new Set(await MigrateV2.selectKeys(unwrap(dbs.dbP)))
            const idsI = new Set(await MigrateV2.selectKeys(unwrap(dbs.dbI)))

            const currIdsP = new Set(
                await dbs.dbP.getAllKeys("logs"),
            ) as Set<string>
            const currIdsI = new Set(
                await dbs.dbI.getAllKeys("logs"),
            ) as Set<string>

            return {
                idsP,
                idsI,
                currIdsP,
                currIdsI,
            }
        },
        { legacyStatsVersion, dbs },
    )

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
                    setLegacyStatsVersion(legacyStatsVersion + 1)
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
    }

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
            const txn = db.transaction(["logs"], "readwrite")
            for (const id of ids) {
                if (count >= opts.count) {
                    break
                }

                try {
                    const oldLog = await MigrateV2.selectLog(unwrap(db), id)
                    const lines = oldLog.entries.map((x) =>
                        MigrateV2.reverseEntry(x),
                    )
                    const newLog: DbN.IdbLogRow = {
                        id,
                        meta: {
                            start: oldLog.meta.start,
                            lastUpdate: oldLog.meta.lastUpdate,
                            world,
                            user_id: null,
                            user_name: null,
                        },
                        compressed: false,
                        raw: lines.join("\n"),
                        raw_c: null,
                    }

                    await txn.objectStore("log").put(newLog)
                    count += 1
                    logImportStatus()
                } catch (e) {
                    L.error(e)
                    continue
                }
            }
            txn.commit()
        }

        cancelLog()
        L.info(`Imported ${count} logs!`)
    }

    async function importOldFiles(opts: {
        files: File[]
        dbs: typeof dbs & { ready: true }
        stats: typeof legacyStats
    }) {
        const logs: Array<DbN.IdbLogRow> = []

        for (const file of opts.files) {
            if (file.name.endsWith("jsonl.gz") || file.name.endsWith("jsonl")) {
                try {
                    for (const l of await MigrateV2.readJsonlExport(file)) {
                        logs.push({
                            id: l.id,
                            meta: {
                                ...l.meta,
                                world: l.world,
                                user_id: null,
                                user_name: null,
                            },
                            // compressed: true,
                            // raw: null,
                            // raw_c: await compressZstd(l.lines.join("\n")),
                            compressed: false,
                            raw: l.lines.join("\n"),
                            raw_c: null,
                        })
                    }
                } catch (e) {
                    L.error(e)
                    continue
                }
            } else {
                L.error(`Invalid file type: ${file.name}`)
            }
        }

        for (const [world, db] of [
            ["persistent", opts.dbs.dbP],
            ["isekai", opts.dbs.dbI],
        ] as const) {
            const txn = db.transaction(["logs"], "readwrite")
            for (const l of logs) {
                if (l.meta.world === world) {
                    await txn.objectStore("logs").put(l)
                }
            }
            txn.commit()
        }

        const dupes = new Set(logs.map((l) => l.id)).intersection(
            opts.stats.currIdsP.union(opts.stats.currIdsI),
        )
        L.info(
            `Imported ${logs.length} logs (${dupes.size} dupes) from ${opts.files.map((f) => f.name)}`,
        )
    }
}
// #endregion

// #region css
const CSS = css`
    dialog {
        max-width: 40em;
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
