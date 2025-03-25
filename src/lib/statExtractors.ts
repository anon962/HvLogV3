import { last } from "radash"
import { CompleteLog } from "./logDb"
import { HvEvent, HvEventMap } from "./parsers"
import { LogAnalysis } from "./statsDb"
import { enumerate, findNext } from "./utils/miscUtils"
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
            const isMeleeAttack =
                ev.event_type === "PLAYER_ATTACK" &&
                ev.spell.endsWith(" Strike")

            // Most player actions fall under PLAYER_SKILLs like "you cast blah"
            // Exception to this is a melee attacks, which results in multiple lines like
            //    Arcane Blow hits blah for 12345 blah damage
            //    Void Strike hits blah for 12345 blah damage
            // So need to check if its a melee attack and only count it once
            const shouldCount =
                ev.event_type !== "PLAYER_ATTACK" ||
                (isMeleeAttack &&
                    acc.lastMeleeAttackIndex - ev.logIndex > 1)

            if (shouldCount) {
                acc.turnIndexes.push(ev.logIndex)
            }

            if (isMeleeAttack) {
                acc.lastMeleeAttackIndex = ev.logIndex
            }

            return acc
        },
        {
            turnIndexes: [] as number[],
            lastMeleeAttackIndex: -99,
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

export function extractDrops(log: CompleteLog): LogAnalysis["drops"] {
    const drops: LogAnalysis["drops"] = {}

    const add = (k: string, count: number, logIdx: number) => {
        drops[k] = drops[k] ?? { name: k, entries: [] }
        drops[k].entries.push({ logIdx, count })
    }

    for (const [idx, entry] of enumerate(log.entries)) {
        if (entry.type !== "event") {
            continue
        }

        const ev = entry.event
        switch (ev.event_type) {
            case "AUTO_SALVAGE":
                add(ev.item, ev.value, idx)
                if (ev.item2) add(ev.item2, ev.value2!, idx)
                break
            case "AUTO_SELL":
                add("autosell", ev.value, idx)
                break
            case "CLEAR_BONUS":
                add(ev.item, 1, idx)
                break
            case "CREDITS":
                add("credits", ev.value, idx)
                break
            case "DROP":
                {
                    const [name, count] = extractNameCount(ev.item)
                    add(name, count, idx)
                }
                break
            case "EVENT_ITEM":
                {
                    const [name, count] = extractNameCount(ev.item)
                    add(name, count, idx)
                }
                break
            case "EXPERIENCE":
                add("experience", ev.value, idx)
                break
            case "PROFICIENCY":
                add("proficiency", ev.value, idx)
                break
            case "SOUL_FRAG_DROP":
                add("Soul Fragment", ev.count, idx)
                break
            case "TOKEN_BONUS":
                add(ev.item, 1, idx)
                break
        }
    }

    return drops

    function extractNameCount(text: string) {
        let name, count

        const m = text.match(/(\d+)x? (.*)/)
        if (m) {
            count = parseInt(m[1])
            name = m[2]
        } else {
            count = 1
            name = text
        }

        return [name, count] as [string, number]
    }
}

export function extractItemUsage(log: CompleteLog) {
    let usage: LogAnalysis["itemUsage"] = {}

    for (const [idx, entry] of enumerate(log.entries)) {
        if (entry.type !== "event") {
            continue
        }

        const ev = entry.event
        switch (ev.event_type) {
            case "PLAYER_ITEM":
                usage[ev.item] = usage[ev.item] ?? []
                usage[ev.item].push(idx)
                break
        }
    }

    return usage
}
