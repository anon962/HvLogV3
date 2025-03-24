import { LogEntry } from "@/lib/logDb"
import { HvEventMap } from "@/lib/parsers"
import { findNext } from "@/lib/utils/miscUtils"
import { JSX } from "react"
import { LogWithAnalysis } from "./main"

export function LogEventList(props: { log: LogWithAnalysis }) {
    let turnIdx = -1

    return (
        <div className="log-event-list flex flex-col">
            {props.log.log.entries.flatMap((entry, logIdx) => {
                const els: JSX.Element[] = []

                const isNewTurn =
                    logIdx ===
                    props.log.analysis.turnIndexes[turnIdx + 1]
                if (isNewTurn) {
                    turnIdx += 1

                    els.push(
                        <div className="turn-start flex gap-2 px-6 pb-4 items-center">
                            <span className="">{turnIdx + 1}</span>
                            <hr className=""></hr>
                        </div>
                    )
                }

                if (
                    entry.type === "event" &&
                    entry.event.event_type === "ROUND_START"
                ) {
                    const [nextRoundStartLogIdx] = findNext(
                        props.log.log.entries,
                        (entry) =>
                            entry.type === "event" &&
                            entry.event.event_type === "ROUND_START",
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

                    let label = `Round ${entry.event.current ?? 1}`
                    label += `, Turns ${turnIdx + 2}`
                    label += ` - ${
                        nextRoundStartTurnIdx
                            ? nextRoundStartTurnIdx
                            : props.log.analysis.turnIndexes.length
                    }`

                    els.push(
                        <div className="round-label sticky py-4 pr-4 mb-4 top-0 flex justify-end bg-card font-bold border-b">
                            {label}
                        </div>
                    )
                } else {
                    els.push(<LogEntryRow entry={entry} />)
                }

                return els
            })}
        </div>
    )
}

function LogEntryRow(props: { entry: LogEntry }) {
    let content
    if (props.entry.type === "event") {
        const eventType = props.entry.event.event_type
        const summary =
            eventType in EVENT_SUMMARY_MAP
                ? EVENT_SUMMARY_MAP[eventType](
                      props.entry.event as any
                  )
                : JSON.stringify(props.entry.event)

        content = (
            <div className="flex">
                <pre className="min-w-48 pr-4">
                    {props.entry.event.event_type}
                </pre>
                <pre>{summary}</pre>
            </div>
        )
    } else {
        content = (
            <div className="flex">
                <pre className="min-w-48 pr-4">ERROR</pre>
                <pre>{props.entry.detail}</pre>
            </div>
        )
    }

    return <div className="pb-4 px-12">{content}</div>
}

const EVENT_SUMMARY_MAP = {
    AUTO_SALVAGE: (ev) =>
        `Dropped ${ev.item.split(" ")[0]} for ${
            ev.value
        }c from auto-salvage`,
    AUTO_SELL: (ev) => `Dropped ${ev.value}c from auto-sell`,
    BUFF_EXPIRE: (ev) => `${ev.effect} expired`,
    CLEAR_BONUS: (ev) => `Dropped (${ev.item})`,
    COOLDOWN_EXPIRE: (ev) => `${ev.spell} ready`,
    CREDITS: (ev) => `Dropped ${ev.value} credits`,
    CURE_RESTORE: (ev) => `Healed ${ev.value} health using Cure`,
    DEBUFF: (ev) => `Cast ${ev.name}`,
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

function useRoundTurnCounter(log: LogWithAnalysis) {}
