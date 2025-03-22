import { last } from "radash"
import { CompleteLog } from "./logDb"
import { HvEvent, HvEventMap } from "./parsers"
import { LogAnalysis } from "./statsDb"
import { findNext } from "./utils/miscUtils"
import { InferCollectionType } from "./utils/typeUtils"

function filterEvents<TEvent extends keyof HvEventMap>(
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
    // Corrupted if...
    //   - Does not start at round 1
    //   - Battle type changes
    battleType: LogAnalysis["battleType"] | null
    round: LogAnalysis["round"] | null
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
            }
    }

    const lst = last(evs)!
    result.round = {
        end: lst.current!,
        max: lst.max!,
    }

    result.inconsistentBattleTypes = evs.some(
        (ev) => ev.battle_type !== first.battle_type
    )

    result.startCount = evs.length
    result.startCount = filterEvents(log, ["ROUND_END"]).length

    return result
}

export function extractNumTurns(log: CompleteLog): {
    turnIndexes: number[]
} {
    const evs = filterEvents(log, [
        "PLAYER_ATTACK",
        "PLAYER_SKILL",
        "PLAYER_ITEM",
    ])

    const { turnIndexes } = evs.reduce(
        (acc, ev) => {
            // Melee attacks can trigger consecutive PLAYER_ATTACK events
            //    Arcane Blow hits blah for 12345 blah damage
            //    Void Strike hits blah for 12345 blah damage
            // Otherwise there's hopefully another event inbetween turns (namely monster attack)
            if (ev.logIndex - acc.lastTurnIndex > 1) {
                turnIndexes.push(ev.logIndex)
            }

            acc.lastTurnIndex = ev.logIndex
            return acc
        },
        {
            turnIndexes: [] as number[],
            lastTurnIndex: -99,
        }
    )

    return { turnIndexes }
}

export function extractCompletionType(
    log: CompleteLog
): LogAnalysis["completionType"] {
    const evs = filterEvents(log, null)

    // Find ROUND_END
    const endMarkers = new Set([
        "ROUND_END",
        "PLAYER_DEATH",
        "FLEE",
    ] as const)
    const [end, _] = findNext(
        evs,
        (
            x: HvEvent
        ): x is HvEventMap[InferCollectionType<typeof endMarkers>] =>
            endMarkers.has(x.event_type as any),
        { reverse: true }
    )

    switch (end?.event_type) {
        case "ROUND_END":
            return "finish"
        case "FLEE":
            return "flee"
        case "PLAYER_DEATH":
            return "die"
        default:
            return null
    }
}

type a = Set<"ROUND_END" | "ROUND_START">
type b = InferCollectionType<a>
type c = HvEventMap[b]
type d = HvEventMap[InferCollectionType<a>]
