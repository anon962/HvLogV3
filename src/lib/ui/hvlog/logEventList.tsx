import { LogEntry } from "@/lib/logDb"
import { HvEventMap } from "@/lib/parsers"
import { findNext } from "@/lib/utils/miscUtils"
import JsonView from "@uiw/react-json-view"
import { JSX, useEffect, useMemo, useState } from "react"
import { XIcon } from "../icons/tailwind"
import { LogWithAnalysis } from "./main"

export function LogEventList(props: { log: LogWithAnalysis }) {
    // @todo: This index tracking is spaghetti. Need to group the log events by round / turn before trying to render it

    const [activeIdx, setActiveIdx] = useState({
        log: -1,
        turn: -1,
        round: -1,
    })

    let turnIdx = -1
    let roundIdx = 1

    useEffect(() => {
        setActiveIdx({ log: -1, turn: -1, round: -1 })
    }, [props.log])

    return (
        <div className="log-event-list flex flex-col h-full">
            <div
                onClick={() =>
                    setActiveIdx({ log: -1, turn: -1, round: -1 })
                }
                className="flex flex-col h-full overflow-auto"
            >
                {props.log.log.entries.flatMap((entry, logIdx) => {
                    const els: JSX.Element[] = []

                    const isNewTurn =
                        logIdx ===
                        props.log.analysis.turnIndexes[turnIdx + 1]
                    if (isNewTurn) {
                        turnIdx += 1

                        els.push(
                            <div className="turn-start flex gap-2 px-6 pb-4 items-center">
                                <span className="">
                                    {turnIdx + 1}
                                </span>
                                <hr className=""></hr>
                            </div>
                        )
                    }

                    if (
                        entry.type === "event" &&
                        entry.event.event_type === "ROUND_START"
                    ) {
                        roundIdx = entry.event.current ?? 1

                        const [__, nextRoundStartLogIdx] = findNext(
                            props.log.log.entries,
                            (entry) =>
                                entry.type === "event" &&
                                entry.event.event_type ===
                                    "ROUND_START",
                            {
                                start: logIdx + 1,
                            }
                        )

                        let [_, nextRoundStartTurnIdx] = findNext(
                            props.log.analysis.turnIndexes,
                            (nextLogIndex) =>
                                nextLogIndex >
                                (nextRoundStartLogIdx ??
                                    Number.POSITIVE_INFINITY),
                            { start: turnIdx }
                        )

                        let label = `Round ${
                            entry.event.current ?? 1
                        }`
                        label += `, Turns ${turnIdx + 2}`
                        label += ` - ${
                            nextRoundStartTurnIdx
                                ? nextRoundStartTurnIdx
                                : props.log.analysis.turnIndexes
                                      .length
                        }`

                        const activeClass =
                            activeIdx.log === logIdx ? " active" : ""

                        const activeData = {
                            log: logIdx,
                            turn: turnIdx + 2,
                            round: roundIdx,
                        }

                        els.push(
                            <div
                                onClick={(ev) => {
                                    setActiveIdx(activeData)
                                    ev.stopPropagation()
                                }}
                                className={
                                    "round-label sticky py-4 pr-4 mb-4 top-0 flex justify-end bg-card font-bold border-b" +
                                    activeClass
                                }
                            >
                                {label}
                            </div>
                        )
                    } else {
                        const activeData = {
                            log: logIdx,
                            turn: turnIdx + 1,
                            round: roundIdx,
                        }

                        els.push(
                            <LogEntryRow
                                onClick={() =>
                                    setActiveIdx(activeData)
                                }
                                entry={entry}
                                isActive={activeIdx.log === logIdx}
                            />
                        )
                    }

                    return els
                })}
            </div>

            {activeIdx.log > -1 && (
                <LogEntryDetails
                    onClose={() =>
                        setActiveIdx({ log: -1, turn: -1, round: -1 })
                    }
                    entry={props.log.log.entries[activeIdx.log]}
                    label={`Round ${activeIdx.round}, Turn ${activeIdx.turn}`}
                />
            )}
        </div>
    )
}

function LogEntryRow(props: {
    entry: LogEntry
    isActive: boolean
    onClick?: (entry: LogEntry) => void
}) {
    return useMemo(() => {
        const activeClass = props.isActive ? " active" : ""

        let content
        if (props.entry.type === "event") {
            const eventType = props.entry.event.event_type
            const summary =
                eventType in EVENT_SUMMARY_MAP
                    ? EVENT_SUMMARY_MAP[eventType](
                          props.entry.event as any
                      )
                    : JSON.stringify(props.entry.event)

            content = [
                <pre className="event-type">
                    {props.entry.event.event_type}
                </pre>,
                <pre>{summary}</pre>,
            ]
        } else {
            content = [
                <pre className="event-type">ERROR</pre>,
                <pre>{props.entry.detail}</pre>,
            ]
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
    }, [props.entry, props.isActive, props.entry])
}

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
    EFFECT_RESTORE: (ev) =>
        `Healed ${ev.value} ${ev.type} from ${ev.effect}`,
    ENEMY_BASIC: (ev) => `Lost ${ev.value} health`,
    ENEMY_SKILL_ABSORB: (ev) => `${ev.spell} absorbed`,
    ENEMY_SKILL_MISS: (ev) => ``,
    ENEMY_SKILL_SUCCESS: (ev) => ``,
    EVENT_ITEM: (ev) => `Dropped ${ev.item}`,
    EXPERIENCE: (ev) => `Dropped ${ev.value} exp`,
    FLEE: (ev) => ``,
    GEM: (ev) => `Gained ${ev.type} gem`,
    ITEM_RESTORE: (ev) => `Healed ${ev.value}${ev.type}`,
    MB_USAGE: (ev) => ``,
    MONSTER_DEATH: (ev) => ``,
    PLAYER_ATTACK: (ev) =>
        `Dealt ${ev.value}${
            ev.damage_type ? " " + ev.damage_type : ""
        } damage (${ev.resist ?? 0}% resist).`,
    PLAYER_BUFF: (ev) => `Gained ${ev.effect}`,
    PLAYER_DODGE: (ev) => ``,
    PLAYER_ITEM: (ev) => `Cast ${ev.item}`,
    PLAYER_MISS: (ev) => ``,
    PLAYER_SKILL: (ev) => `Cast ${ev.spell}`,
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
