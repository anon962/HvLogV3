import { LogDb } from "@/lib/db/db"
import { MigrateV2 } from "@/lib/db/migrateV2"
import { LabeledCheckbox } from "@/lib/ui/checkboxGroup"
import { Loader } from "@/lib/ui/loader"
import { Button } from "@/lib/ui/shadcn/button"
import { Input } from "@/lib/ui/shadcn/input"
import { CommonProps, css, useAsync } from "@/lib/utils/miscUtils"
import { mountReact } from "@/lib/utils/userscriptUtils"
import { cn, L, Unsubs } from "myutils"
import { ReactNode, useEffect, useMemo, useRef, useState } from "react"

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
                                Found <b>500</b> old logs (<b>312.2 MiB</b>) in
                                database. <b>123 / 500</b> have been imported
                                and are ready for deletion.
                            </li>
                        </ul>
                    }
                    actions={[
                        [
                            <span>
                                Import
                                <Input
                                    value={Math.min(250, 250)}
                                    type="number"
                                    className="w-[10ch] inline mx-1"
                                />
                                logs
                            </span>,
                            <ActionButton
                                label="Import from DB"
                                loading={false}
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
                                label="Delete Old Logs"
                                loading={false}
                                className="destructive"
                            />,
                        ],
                        [
                            <span className="flex flex-col gap-1 items-center">
                                <Input type="file" className="inline" />
                            </span>,
                            <ActionButton
                                label="Import Old File"
                                loading={false}
                            />,
                        ],
                        [
                            <span>Export old logs</span>,
                            <ActionButton
                                label="Download Old File"
                                loading={false}
                            />,
                        ],
                    ]}
                    log={["fasdf", "Fasdf", "Fsdafsd"]}
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
        log: string[]
    } & CommonProps,
) {
    const [lineEls, setLineEls] = useState<Array<ReactNode>>([])

    useEffect(() => {
        const newLines = props.log.slice(lineEls.length)
        if (newLines.length === 0) {
            return
        }

        for (const ln of newLines) {
            lineEls.push(<pre>{ln}</pre>)
        }
        setLineEls([...lineEls])
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

            {lineEls.length > 0 && (
                <>
                    <hr></hr>
                    <div className="event-log">{...lineEls}</div>
                </>
            )}
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
    } & CommonProps,
) {
    return (
        <Button
            className={cn("relative", props.className)}
            disabled={props.disabled || props.loading}
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
    const unsubs = Unsubs()

    const [log, setLog] = useState({ lines: [] as string[] })
    const tStart = useMemo(() => performance.now(), [])
    L.sinks["legacy_import"] = {
        disabled: false,
        call: (level, msg, ...rest) => {
            const elapsed = performance.now() - tStart
            const joined =
                `[${level.toUpperCase().padEnd(5)}] [${(elapsed / 1000).toFixed(3)}ms] - ` +
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
    unsubs.push(() => delete L.sinks["legacy_import"])

    const dbFetch = useAsync(
        async () => ({
            pOld: await MigrateV2.initDb(MigrateV2.DBID_P),
            iOld: await MigrateV2.initDb(MigrateV2.DBID_I),
            pNew: await new LogDb({
                world: "persistent",
            }).connect(),
            iNew: await new LogDb({
                world: "isekai",
            }).connect(),
        }),
        [],
    )
    const dbs = useMemo(
        () =>
            dbFetch.data
                ? dbFetch.data
                : { pOld: null, iOld: null, pNew: null, iNew: null },
        [dbFetch.data],
    )

    const [legacyStatsVersion, setLegacyStatsVersion] = useState(0)
    const legacyStatsFetch = useAsync(async () => {
        if (!dbs.pOld) {
            return
        }

        const idsP = new Set(await MigrateV2.selectKeys(dbs.pOld))
        const idsI = new Set(await MigrateV2.selectKeys(dbs.iOld))

        const currIdsP = new Set(
            await dbs.pNew.getAllKeys("logs"),
        ) as Set<string>
        const currIdsI = new Set(
            await dbs.iNew.getAllKeys("logs"),
        ) as Set<string>

        const dupesP = idsP.intersection(currIdsP)
        const dupesI = idsI.intersection(currIdsI)

        return {
            idsP,
            idsI,
            dupesP,
            dupesI,
        }
    }, [legacyStatsVersion, dbs])

    return {
        tStart,
        dbs,
        legacyStats: legacyStatsFetch.data ?? {
            idsP: new Set<string>(),
            idsI: new Set<string>(),
            dupesP: new Set<string>(),
            dupesI: new Set<string>(),
        },
        refetchLegacyStats() {
            setLegacyStatsVersion(legacyStatsVersion + 1)
        },
        unsubs,
    }
}
// #endregion

// #region css
const CSS = css`
    dialog {
        max-width: 40em;
    }

    .log-mgr {
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
            line-height: 1;
            gap: 0.3em;
        }
    }
`
// #endregion
