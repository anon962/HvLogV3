import { last } from "radash"
import { CompleteLog } from "../logDb"
import { HvEvent, HvEventMap } from "../parsers"
import { LogSummary } from "../summaryDb"
import { findNext } from "../utils/miscUtils"
import { InferCollectionType } from "../utils/typeUtils"

export function filterEvents<TEvent extends keyof HvEventMap>(
    log: CompleteLog,
    eventTypes: TEvent[] | null
): Array<HvEventMap[TEvent] & { logIndex: number }> {
    const evs = log.entries.flatMap((entry, idx) =>
        entry.type === "event"
            ? [{ ...entry.event, logIndex: idx }]
            : []
    )

    if (eventTypes === null) {
        return evs as any[]
    } else {
        const s = new Set(eventTypes)
        return evs.filter((ev) =>
            s.has(ev.event_type as any)
        ) as any[]
    }
}

export function extractBattleType(log: CompleteLog): {
    battleType: LogSummary["battleType"] | null
    round: LogSummary["round"] | null
    inconsistentBattleTypes: boolean
    startCount: number
    endCount: number
} {
    const result = {
        battleType: null,
        round: null,
        inconsistentBattleTypes: false,
        startCount: 0,
        endCount: 0,
    } as ReturnType<typeof extractBattleType>

    const evs = filterEvents(log, ["ROUND_START"])
    if (!evs.length) {
        return result
    }

    const first = evs[0]
    switch (first.battle_type) {
        case "Grindfest":
            result.battleType = { name: "Grindfest" }
            break
        case "Item World":
            result.battleType = { name: "Item World" }
            break
        case "random encounter":
            result.battleType = { name: "random encounter" }
            result.round = {
                end: 1,
                max: 1,
            }
            break
        default:
            const arena = first.battle_type.match(
                /arena challenge #(\d+)/
            )
            if (arena) {
                result.battleType = {
                    name: "Arena",
                    id: parseInt(arena[1]),
                }
                break
            }

            const tower = first.battle_type.match(
                /The Tower \\(Floor (\d+)\\)/
            )
            if (tower) {
                result.battleType = {
                    name: `Tower`,
                    floor: parseInt(tower[1]),
                }
                break
            }
    }

    const lst = last(evs)!
    result.round =
        lst.current && lst.max
            ? {
                  end: lst.current!,
                  max: lst.max!,
              }
            : null

    result.inconsistentBattleTypes = evs.some(
        (ev) => ev.battle_type !== first.battle_type
    )

    result.startCount = evs.length
    result.startCount = filterEvents(log, ["ROUND_END"]).length

    return result
}

export function extractTurnIndexes(log: CompleteLog): number[] {
    const evs = filterEvents(log, [
        "PLAYER_ATTACK",
        "PLAYER_SKILL",
        "PLAYER_ITEM",
        "PLAYER_MELEE",
        "SPIRIT_STANCE_START",
    ])

    const turnIndexes = evs.flatMap((ev) => {
        // Most player actions fall under PLAYER_SKILLs like "you cast blah"
        // Exception to this is a melee attacks, which results in multiple lines like
        //    Arcane Blow hits blah for 12345 blah damage
        //    Void Strike hits blah for 12345 blah damage
        // So need to check if its a melee attack and only count it once
        if (
            ev.event_type === "PLAYER_ATTACK" &&
            ev.spell !== "Arcane Blow"
        ) {
            return []
        }

        return [ev.logIndex]
    })

    return turnIndexes
}

export function extractRoundIndexes(log: CompleteLog) {
    return filterEvents(log, ["ROUND_START"]).reduce((acc, ev) => {
        acc[ev.current ?? 1] = ev.logIndex
        return acc
    }, {} as Record<number, number>)
}

export function extractCompletionType(
    log: CompleteLog
): LogSummary["completionType"] {
    const evs = filterEvents(log, null)

    // Find ROUND_END
    const endMarkers = new Set([
        "ROUND_END",
        "DEFEAT",
        "FLEE",
    ] as const)

    // prettier-ignore
    const cond =
        (ev: HvEvent): ev is HvEventMap[InferCollectionType<typeof endMarkers>] =>
            endMarkers.has(ev.event_type as any)

    const [end, _] = findNext(evs, cond, {
        reverse: true,
        breakOn: (ev) => ev.event_type === "ROUND_START",
    })

    switch (end?.event_type) {
        case "ROUND_END":
            return "finish"
        case "FLEE":
            return "flee"
        case "DEFEAT":
            return "die"
        default:
            return null
    }
}
