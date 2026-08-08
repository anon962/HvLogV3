import { BaseHvEvent } from "@/lib/eventParser"
import { CompleteLog, LogEntry } from "@/lib/db/schema"
import JsonView from "@uiw/react-json-view"
import { enumerate, range, sleep } from "myutils"
import { memo, ReactElement, useEffect, useRef, useState } from "react"
import { IndexMap } from "../../stats/indexMap"
import { XIcon } from "../icons/tailwind"

export function LogEventList<T extends BaseHvEvent>(props: {
    log: CompleteLog<T>
    indexMap: IndexMap
}) {
    const { rows, loading, indexMap, activeIdx, setActiveIdx } = useRowsAsync(
        props.log,
        props.indexMap,
    )

    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setActiveIdx(-1)
        scrollRef.current?.scrollTo({ top: 0 })
    }, [props.log.id])

    return (
        <div className="log-event-list flex flex-col h-full">
            <div
                ref={scrollRef}
                // onClick={() => setActiveIdx(-1)}
                className="flex flex-col h-full overflow-auto"
            >
                {...rows}
            </div>

            {props.log.entries[activeIdx] && (
                <LogEntryDetails
                    onClose={() => setActiveIdx(-1)}
                    entry={props.log.entries[activeIdx]}
                    label={`Round ${indexMap.l2r(
                        activeIdx,
                    )}, Turn ${indexMap.l2t(activeIdx)}`}
                />
            )}
        </div>
    )
}

function useRowsAsync<T extends BaseHvEvent>(
    log: CompleteLog<T>,
    indexMap: IndexMap,
) {
    const [current, setCurrent] = useState({
        id: "",
        rows: [] as ReactElement[],
        activeLogIdx: -1,
    })

    const [target, setTarget] = useState({
        activeLogIdx: -1,
    })

    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        const updateTargets = new Set<number>()

        if (current.id !== log.id) {
            setCurrent((current) => ({
                id: log.id,
                rows: [],
                activeLogIdx: -1,
            }))

            range(0, log.entries.length).forEach((idx) =>
                updateTargets.add(idx),
            )
        }

        if (current.activeLogIdx !== target.activeLogIdx) {
            updateTargets.add(current.activeLogIdx)
            updateTargets.add(target.activeLogIdx)

            setCurrent({
                ...current,
                activeLogIdx: target.activeLogIdx,
            })
        }

        async function load() {
            let toUpdate = [] as Array<{
                idx: number
                el: ReactElement
            }>

            for (const [logIdx, entry] of enumerate(log.entries)) {
                const needsPush = logIdx > current.rows.length
                const needsUpdate = updateTargets.has(logIdx)

                if (!needsPush && !needsUpdate) {
                    continue
                }

                toUpdate.push({
                    idx: logIdx,
                    el: (
                        <EventRowContainer
                            logId={log.id}
                            logIdx={logIdx}
                            entry={entry}
                            indexMap={indexMap}
                            activeLogIdx={target.activeLogIdx}
                            setActiveLogIdx={() =>
                                setTarget((target) => ({
                                    ...target,
                                    activeLogIdx: logIdx,
                                }))
                            }
                        />
                    ),
                })

                if (toUpdate.length > 1_000 && !cancelled) {
                    const update = [...toUpdate]
                    toUpdate = []
                    setCurrent((current) => {
                        const rows = current.rows
                        for (const { idx, el } of update) {
                            rows[idx] = el
                        }
                        return { ...current, rows }
                    })

                    await sleep(10)
                    if (cancelled) {
                        return
                    }
                }
            }

            if (toUpdate.length) {
                setCurrent((current) => {
                    const rows = current.rows
                    for (const { idx, el } of toUpdate) {
                        rows[idx] = el
                    }
                    return { ...current, rows }
                })
            }

            setLoading(false)
        }

        load()

        return () => {
            cancelled = true
        }
    }, [target.activeLogIdx, log.id])

    return {
        rows: current.rows,
        indexMap,
        loading,
        activeIdx: current.activeLogIdx,
        setActiveIdx: (logIdx: number) =>
            setTarget((target) => ({
                ...target,
                activeLogIdx: logIdx,
            })),
    }
}

interface EventRowContainerProps {
    logIdx: number
    entry: LogEntry<any>
    indexMap: IndexMap
    activeLogIdx: number
    setActiveLogIdx: (logIdx: number) => void
    logId: string
}

const EventRowContainer = memo((props: EventRowContainerProps) => {
    const { logIdx, entry, indexMap, activeLogIdx, setActiveLogIdx, logId } =
        props

    const els: ReactElement[] = []

    const turnIdx = indexMap.l2t(logIdx)
    const roundIdx = indexMap.l2r(logIdx)

    const isNewTurn = logIdx === indexMap.t2l(turnIdx)
    if (isNewTurn && logIdx > 0) {
        els.push(
            <div className="turn-start flex gap-2 px-6 pb-4 items-center">
                <span className="">{turnIdx}</span>
                <hr className=""></hr>
            </div>,
        )
    }

    if (entry.type === "event" && entry.event.event_type === "ROUND_START") {
        const nextRoundStartTurn =
            indexMap.r2t(roundIdx + 1) ?? indexMap.turnIndexes.length

        let label = `Round ${entry.event.current ?? 1}`
        label += `, Turns ${turnIdx} - ${nextRoundStartTurn}`

        const activeClass = activeLogIdx === logIdx ? " active" : ""

        els.push(
            <div
                onClick={(ev) => {
                    setActiveLogIdx(logIdx)
                }}
                className={
                    "round-label sticky py-4 pr-4 mb-4 top-0 flex justify-end bg-card font-bold border-b rounded-t-md" +
                    activeClass
                }
            >
                {label}
            </div>,
        )
    } else {
        els.push(
            <EventRow
                key={logIdx}
                onClick={() => setActiveLogIdx(logIdx)}
                entry={entry}
                isActive={activeLogIdx === logIdx}
            />,
        )
    }

    return <>{...els}</>
})

interface EventRowProps {
    entry: LogEntry
    isActive: boolean
    onClick?: (entry: LogEntry) => void
}

const EventRow = memo((props: EventRowProps) => {
    const { entry, isActive, onClick } = props
    const activeClass = props.isActive ? " active" : ""

    let content
    if (props.entry.type === "event") {
        const eventType = props.entry.event.event_type
        const summary =
            eventType in EVENT_SUMMARY_MAP
                ? EVENT_SUMMARY_MAP[eventType](props.entry.event as any)
                : JSON.stringify(props.entry.event)

        content = (
            <>
                <pre className="event-type">{props.entry.event.event_type}</pre>
                <pre className="event-detail">{summary}</pre>
            </>
        )
    } else {
        content = (
            <>
                <pre className="event-type">ERROR</pre>
                <pre className="event-detail">{props.entry.detail}</pre>
            </>
        )
    }

    return (
        <div
            onClick={(ev) => {
                if (!props.isActive) {
                    props.onClick?.(props.entry)
                }
                ev.stopPropagation()
            }}
            className={"event-row" + activeClass}
        >
            {content}
        </div>
    )
})

function LogEntryDetails(props: {
    entry: LogEntry
    label: string
    onClose?: () => void
}) {
    return (
        <div className="json-view p-8 border-t border-t-muted-foreground relative">
            <button
                onClick={() => props.onClose?.()}
                className="size-12 rounded-full absolute top-4 right-4 hover:bg-muted cursor-pointer flex justify-center items-center"
            >
                <XIcon />
            </button>

            <pre className="pb-4">{props.label}</pre>

            <JsonView
                value={props.entry}
                style={JSON_VSCODE_THEME}
                displayDataTypes={false}
                displayObjectSize={false}
                highlightUpdates={false}
                shortenTextAfterLength={Number.POSITIVE_INFINITY}
            />
        </div>
    )
}

const EVENT_SUMMARY_MAP = {
    AUTO_SALVAGE: (ev) =>
        `Dropped ${ev.value} ${ev.item}${
            ev.item2 ? " and " + ev.value + "x " + ev.item2 : ""
        } from auto-salvage`,
    AUTO_SELL: (ev) => `Dropped ${ev.value}c from auto-sell`,
    BUFF_EXPIRE: (ev) => `${ev.effect} expired`,
    CLEAR_BONUS: (ev) => `Dropped (${ev.item})`,
    COOLDOWN_EXPIRE: (ev) => `${ev.spell} ready`,
    CREDITS: (ev) => `Dropped ${ev.value} credits`,
    CURE_RESTORE: (ev) => `Healed ${ev.value} health using Cure`,
    DEBUFF: (ev) => `Applied ${ev.name}`,
    DEBUFF_EXPIRE: (ev) => `${ev.effect} expired`,
    DEFEAT: (ev) => ``,
    DISPEL: (ev) => `Dispelled ${ev.effect}`,
    DROP: (ev) => `Dropped ${ev.item}`,
    DROP_EVENT: (ev) => `Dropped ${ev.item}`,
    EFFECT_RESTORE: (ev) => `Healed ${ev.value} ${ev.type} from ${ev.effect}`,
    ENEMY_BASIC: (ev) => `Lost ${ev.value} health`,
    ENEMY_DODGE: (ev) => ``,
    ENEMY_EVADE: (ev) => ``,
    ENEMY_MISS: (ev) => ``,
    ENEMY_MISS_2: (ev) => ``,
    ENEMY_PARRY: (ev) => ``,
    ENEMY_SKILL_ABSORB: (ev) => `${ev.spell} absorbed`,
    ENEMY_SKILL_MISS: (ev) => ``,
    ENEMY_SKILL_MISS_2: (ev) => ``,
    ENEMY_SKILL_SUCCESS: (ev) => ``,
    ENCHANT_GAIN: (ev) => `Gained enchant ${ev.value}`,
    EXPLOSION: (ev) =>
        `Dealt ${ev.value} ${ev.type} damage (${ev.explosion} explosion)`,
    EVENT_ITEM: (ev) => `Dropped ${ev.item}`,
    EXPERIENCE: (ev) => `Dropped ${ev.value} exp`,
    FLEE: (ev) => ``,
    GEM: (ev) => `Gained ${ev.type} gem`,
    ITEM_RESTORE: (ev) => `Healed ${ev.value} ${ev.type}`,
    LEVEL_UP: (ev) => `Reached Level ${ev.level}!`,
    MASTERY_GAIN: (ev) => ``,
    MB_USAGE: (ev) => ``,
    MONSTER_DEATH: (ev) => ``,
    PLAYER_ATTACK: (ev) => {
        const msg = `Dealt ${ev.value}${
            ev.damage_type ? " " + ev.damage_type : ""
        } damage`
        return `${msg}.`
    },
    PLAYER_BUFF: (ev) => `Gained ${ev.effect}`,
    PLAYER_COUNTER: (ev) => ``,
    PLAYER_ITEM: (ev) => `Cast ${ev.item}`,
    PLAYER_OFFHAND: (ev) => `Dealt ${ev.value} damage`,
    PLAYER_MELEE: (ev) => `Dealt ${ev.value} ${ev.damage_type} damage`,
    PLAYER_SKILL: (ev) => `Cast ${ev.spell}`,
    PLAYER_SPELL_ABSORBED: (ev) => ``,
    PLAYER_SPIKE_SHIELD: (ev) => `Dealt ${ev.value} damage`,
    POTENCY_GAIN: (ev) => `Gained ${ev.value} PXP`,
    PROFICIENCY: (ev) => `Dropped ${ev.value} ${ev.type}`,
    RESIST: (ev) => `100% resist`,
    RIDDLE_MASTER: (ev) => ``,
    RIDDLE_RESTORE: (ev) => ``,
    ROUND_END: (ev) => ``,
    ROUND_START: (ev) => `Round ${ev.current} start`,
    SOUL_FRAG_DROP: (ev) => `Dropped ${ev.count} Soul Fragments`,
    SPARK_TRIGGER: (ev) => `Spark of Life triggered`,
    SPAWN: (ev) => `Monster ${ev.monster} spawned`,
    SPIRIT_SHIELD: (ev) =>
        `Lost ${ev.damage - ev.spirit_damage} health and ${
            ev.spirit_damage
        } sp`,
    SPIRIT_STANCE_START: (ev) => ``,
    SPIRIT_STANCE_END: (ev) => ``,
    TOKEN_BONUS: (ev) => `Dropped ${ev.item}`,
} satisfies {
    [K in keyof HvEventMap]: (ev: HvEventMap[K]) => string
}

const JSON_VSCODE_THEME = {
    "--w-rjv-font-family": "monospace",
    "--w-rjv-color": "#9cdcfe",
    "--w-rjv-key-number": "#268bd2",
    "--w-rjv-key-string": "#9cdcfe",
    "--w-rjv-background-color": "",
    "--w-rjv-line-color": "#36334280",
    "--w-rjv-arrow-color": "#838383",
    "--w-rjv-edit-color": "var(--w-rjv-color)",
    "--w-rjv-info-color": "#9c9c9c7a",
    "--w-rjv-update-color": "#9cdcfe",
    "--w-rjv-copied-color": "#9cdcfe",
    "--w-rjv-copied-success-color": "#28a745",

    "--w-rjv-curlybraces-color": "#d4d4d4",
    "--w-rjv-colon-color": "#d4d4d4",
    "--w-rjv-brackets-color": "#d4d4d4",
    "--w-rjv-ellipsis-color": "#cb4b16",
    "--w-rjv-quotes-color": "var(--w-rjv-key-string)",
    "--w-rjv-quotes-string-color": "var(--w-rjv-type-string-color)",

    "--w-rjv-type-string-color": "#ce9178",
    "--w-rjv-type-int-color": "#b5cea8",
    "--w-rjv-type-float-color": "#b5cea8",
    "--w-rjv-type-bigint-color": "#b5cea8",
    "--w-rjv-type-boolean-color": "#569cd6",
    "--w-rjv-type-date-color": "#b5cea8",
    "--w-rjv-type-url-color": "#3b89cf",
    "--w-rjv-type-null-color": "#569cd6",
    "--w-rjv-type-nan-color": "#859900",
    "--w-rjv-type-undefined-color": "#569cd6",
} as any
