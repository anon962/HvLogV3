import { DbN, LogEntry } from "@/lib/db/dbN"
import { LOG_SOURCE } from "@/lib/db/logSource"
import { IndexMap } from "@/lib/stats/indexMap"
import { v91 } from "@/lib/v91/v91"
import { ChevronDown } from "lucide-react"
import {
    alphabetical,
    bufferedReduce,
    cn,
    css,
    Css,
    last,
    newContext,
    range,
    useAsync2,
    zip,
} from "myutils"
import { Fragment, useDeferredValue, useEffect, useMemo, useState } from "react"
import { CheckboxGroup } from "../checkboxGroup"
import { useUrlParams } from "./router"

export function RawLogViewer(props: { id: DbN.LogId }) {
    return (
        <N.ctx.Provider arg={props.id}>
            <Inner />
        </N.ctx.Provider>
    )
}

function Inner(props: {}) {
    const ctx = N.ctx.useContext()

    return (
        <div className="raw-log flex">
            <Css css={CSS} />

            <Filter />

            <div className="log">
                {...ctx.regions.map((r) => (
                    <Line key={r.idxs[0] ?? -1} region={r} />
                ))}
            </div>
        </div>
    )
}

function Line(props: { region: N.Region }) {
    const ctx = N.ctx.useContext()

    const entry = ctx.entries[props.region.idxs[0]]
    const isRoundStart =
        entry?.type === "event" && entry.event.event_type === "ROUND_START"
    const isRoundEnd =
        entry?.type === "event" && entry.event.event_type === "ROUND_END"

    return (
        <Fragment>
            {isRoundStart && <hr></hr>}

            {isRoundStart || isRoundEnd ? (
                <RoundExpander region={props.region} isStart={isRoundStart} />
            ) : (
                <TurnExpander region={props.region} />
            )}
        </Fragment>
    )
}

// #region expander
function TurnExpander(props: { region: N.Region }) {
    const [expand, setExpand] = useState(false)
    const ctx = N.ctx.useContext()

    useEffect(() => {
        const cb = () => {
            setExpand(false)
        }
        window.addEventListener("hvlog:raw-collapse", cb)
        return () => window.removeEventListener("hvlog:raw-collapse", cb)
    }, [])

    const turnIdx = ctx.indexMap.l2t(props.region.idxs[0])

    const evTypes = useMemo(() => {
        return new Set(
            range(props.region.idxs[0], props.region.idxs[1] + 1).map((idx) => {
                const entry = ctx.entries[idx]
                if (entry.type === "event") {
                    return ctx.eventTypes.findIndex(
                        (x) => x === entry.event.event_type,
                    )
                } else {
                    return -1
                }
            }),
        )
    }, [props.region, ctx.entries])

    useEffect(() => {
        setExpand(evTypes.intersection(ctx.params.ev.v).size > 0)
    }, [evTypes, ctx.params.ev])

    return (
        <div className={cn("turn")}>
            <span>{ctx.lines[props.region.idxs[0]]}</span>

            <button
                className={cn({ expand: expand })}
                onClick={() => setExpand(!expand)}
            >
                <span>Turn {turnIdx}</span>
                <ChevronDown />
            </button>

            {expand && (
                <div className="events">
                    {range(props.region.idxs[0], props.region.idxs[1] + 1).map(
                        (logIdx) => (
                            <p key={logIdx}>{ctx.lines[logIdx]}</p>
                        ),
                    )}
                </div>
            )}
        </div>
    )
}
function RoundExpander(props: { region: N.Region; isStart: boolean }) {
    const [expand, setExpand] = useState(false)
    const ctx = N.ctx.useContext()

    useEffect(() => {
        const cb = () => {
            setExpand(false)
        }
        window.addEventListener("hvlog:raw-collapse", cb)
        return () => window.removeEventListener("hvlog:raw-collapse", cb)
    }, [])

    const evTypes = useMemo(() => {
        return new Set(
            range(props.region.idxs[0], props.region.idxs[1] + 1).map((idx) => {
                const entry = ctx.entries[idx]
                if (entry.type === "event") {
                    return ctx.eventTypes.findIndex(
                        (x) => x === entry.event.event_type,
                    )
                } else {
                    return -1
                }
            }),
        )
    }, [props.region, ctx.entries])

    useEffect(() => {
        setExpand(evTypes.intersection(ctx.params.ev.v).size > 0)
    }, [evTypes, ctx.params.ev])

    const roundIdx = ctx.indexMap.l2r(props.region.idxs[0])

    return (
        <div className="round-marker">
            <button
                onClick={() => setExpand(!expand)}
                className={cn("", { expand: expand })}
            >
                {props.isStart ? (
                    <p className="round-start">Round {roundIdx} start</p>
                ) : (
                    <p className="round-end">
                        Round {roundIdx} end{"  "}
                    </p>
                )}

                <ChevronDown />
            </button>

            {expand && (
                <div className="events">
                    {range(props.region.idxs[0], props.region.idxs[1] + 1).map(
                        (logIdx) => (
                            <p key={logIdx}>{ctx.lines[logIdx]}</p>
                        ),
                    )}
                </div>
            )}
        </div>
    )
}
// #endregion

// #region filter
function Filter(props: {}) {
    const ctx = N.ctx.useContext()

    const ctx2 = useDeferredValue(ctx)
    const options = useMemo(() => {
        const secondaryMask = new Set(
            [...ctx2.params.ev.v].map((idx) => ctx2.eventTypes[idx]),
        )

        return ctx2.eventTypes.map((id, idx) => ({
            label: id,
            idx,
            checked: secondaryMask.has(id),
        }))
        // .filter((x) => !ctx2.eventMaskPrimary.has(x.label))
    }, [ctx2.params.ev, ctx2.eventTypes, ctx2.eventMaskPrimary])

    return (
        <form className="flex flex-col sticky top-0 rounded-sm border-2 p-2 mr-4 max-h-[80vh] overflow-auto">
            <div className="flex justify-end p-2 gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        ctx.setParams({ ev: null })
                    }}
                    className="py-[0.5em] px-[1em] h-max"
                >
                    Clear
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                        window.dispatchEvent(new Event("hvlog:raw-collapse"))
                    }}
                    className="py-[0.5em] px-[1em] h-max"
                >
                    Collapse All
                </Button>
            </div>

            <CheckboxGroup
                header="Events"
                options={options}
                checked={options.map((x) => x.checked)}
                onCheckedChange={({ checked }) => {
                    let update: Array<number> = []

                    for (const [x, v] of zip(options, checked)) {
                        if (v) {
                            update.push(x.idx)
                        }
                    }

                    ctx.setParams({
                        ev: update,
                    })
                }}
                listProps={{
                    className: "block! columns-2 lg:columns-3",
                }}
            />
        </form>
    )
}
// #endregion

// #region namespace
namespace RawLogViewerN {
    export type Region = {
        idxs: [number, number]
    }

    export const ctx = newContext((id: DbN.LogId) => {
        const logSource = LOG_SOURCE.useContext()
        const [params, setParams] = useUrlParams({
            schema: {
                ev: {
                    type: "number[]",
                    deser: (xs) => new Set(xs),
                    init: () => new Set(),
                },
            },
        })

        const { data } = useAsync2(async (id) => {
            return id
                ? await Promise.all([
                      logSource.fetchMetaSummary(id),
                      logSource.fetchLog(id),
                      logSource.fetchEntries(id),
                      logSource.fetchIndexMap(id),
                  ] as const)
                : null
        }, id)

        const dataStuff = useMemo(() => {
            let regions: Array<Region> = []
            let eventTypes: string[] = []
            let lines: Array<string> = []
            let entries: Array<LogEntry> = []
            let indexMap = new IndexMap([], {}, 0)
            let eventMaskPrimary = new Set<string>()
            if (data) {
                const [meta, raw, entries_, indexMap_] = data
                entries = entries_
                indexMap = indexMap_

                lines = raw.split("\n").flatMap((ln) => {
                    ln = ln.trim()
                    if (ln.length > 0) {
                        return [ln]
                    } else {
                        return []
                    }
                })

                switch (meta.version) {
                    case "v91":
                        eventTypes = v91.ALL_PARSERS.map((x) => x.name)
                }
                eventTypes = alphabetical(eventTypes)

                eventMaskPrimary = new Set([
                    "P_CAST",
                    "P_ATTACK",
                    "P_MELEE_PARRY",
                    "P_MELEE_MISS",
                    "P_ARCANE_BLOW",
                    "P_ITEM_OR_SKILL",
                    "P_STANCE_START",
                    "SKILL_FAIL",
                    "STANCE_FAIL",
                    "CAST_FAIL",
                    "ITEM_FAIL",
                    "ATTACK_FAIL",
                    "ATTACK_FAIL_2",
                    "SCAN_1",
                    "P_DEFEND",
                    "ROUND_START",
                    "ROUND_END",
                ])

                regions = bufferedReduce(
                    range(lines.length),
                    (result, buf, idx) => {
                        if (idx !== undefined && idx < lines.length) {
                            const entry = entries[idx]
                            let primary = false
                            if (
                                entry.type === "error" ||
                                eventMaskPrimary.has(entry.event.event_type)
                            ) {
                                primary = true
                            }

                            if (primary && buf.length > 0) {
                                result.push({ idxs: [buf[0], last(buf)!] })
                                buf = [idx]
                            } else {
                                buf.push(idx)
                            }
                        } else {
                            result.push({ idxs: [buf[0], last(buf)!] })
                        }

                        return { result, buf }
                    },
                )
            }

            return {
                eventTypes,
                eventMaskPrimary,
                lines,
                entries,
                regions,
                indexMap,
            }
        }, [data])

        return {
            id,
            params,
            setParams,
            ...dataStuff,
        }
    })
}
import N = RawLogViewerN
import { Button } from "../shadcn/button"
// #endregion

// #region css
const CSS = css`
    .raw-log {
        font-family: monospace;
        font-size: 0.85em;
        display: flex;
        justify-content: center;
        align-items: start;

        .log {
            display: grid;
            grid-template-columns: 1fr 10em;
            width: 38em;
        }

        .turn,
        .round-marker {
            display: contents;
        }

        .turn > *,
        .round-marker > button,
        .events {
            padding: 0.125em 0.625em;
        }
        .turn > :nth-child(1) {
            min-width: 20em;
            max-width: 36em;
            text-align: end;
            background-color: color-mix(
                in oklch,
                var(--background),
                var(--foreground) 20%
            );
        }
        .turn > :nth-child(2) {
            user-select: none;
            background-color: color-mix(
                in oklch,
                var(--background),
                var(--foreground) 10%
            );
            &:hover {
                background-color: color-mix(
                    in oklch,
                    var(--background),
                    var(--color-blue-100) 20%
                );
                color: var(--color-yellow-200);
            }
        }

        .round-marker > button {
            display: flex;
            justify-content: end;
            gap: 1em;
            background-color: color-mix(
                in oklch,
                var(--background),
                var(--foreground) 5%
            );
            &:hover {
                background-color: color-mix(
                    in oklch,
                    var(--background),
                    var(--color-blue-100) 15%
                );
                color: var(--color-yellow-200);
            }
        }

        hr,
        .round-marker > button {
            grid-column: 1 / span 2;
        }

        .events {
            grid-column: 1 / span 2;
            display: flex;
            flex-flow: column;
            text-align: left;
            background-color: color-mix(
                in oklch,
                var(--background),
                var(--foreground) 10%
            );
            color: color-mix(in oklch, var(--foreground), transparent 10%);
            border-bottom: 1px solid
                color-mix(in oklab, var(--color-border), var(--foreground) 30%);
            padding-bottom: 1em;
        }

        .turn > :nth-child(2) {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        button svg {
            height: 1.25em;
            width: 1.25em;
            transition: all 0.2s;
        }
        button.expand svg {
            transform: rotate(180deg);
        }

        hr {
            border-style: dashed;
            border-color: color-mix(
                in oklab,
                var(--color-border),
                var(--foreground) 20%
            );

            &:first-child {
                display: none;
            }
        }
    }
`
// #endregion
