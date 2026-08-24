export function parseBattleType(id: string): MetaSummary["battleType"] | null {
    switch (id) {
        case "Grindfest":
            return { id, category: "Grindfest" }

        case "Item World":
            return { id, category: "Item World" }

        case "random encounter":
            return { id, category: "RE" }

        default:
            const arena = id.match(/arena challenge #(\d+)/)
            if (arena) {
                return {
                    id,
                    category: "Arena",
                    categoryValue: parseInt(arena[1]),
                }
            }

            const tower = id.match(/The Tower \(Floor (\d+)\)/)
            if (tower) {
                return {
                    id,
                    category: `Tower`,
                    categoryValue: parseInt(tower[1]),
                }
            }
    }

    return null
}

export interface MetaSummary {
    version: "v91"
    completionType: "finish" | "flee" | "die" | null
    battleType: null | {
        id: string
        category: "Arena" | "Tower" | "Item World" | "Grindfest" | "RE"
        categoryValue?: number
    }
    round: {
        end: number
        max: number
    } | null
    turnIndices: number[]
    roundIndices: Record<number, number>
    eventCount: number
    enchants: string[]
    errors: {
        parsing: boolean
        inconsistentBattleTypes: boolean
        missingStart: boolean
        missingEnd: boolean
        dupes: boolean
        unknownSequence: boolean
    }
}

// export function extractIwEnchants(
//     log: CompleteLog,
//     battleType: MetaSummary["battleType"],
// ): MetaSummary["enchants"] {
//     switch (battleType?.name) {
//         case "Item World":
//             return log.entries
//                 .slice(-1000)
//                 .flatMap((entry) =>
//                     entry.type === "event" ? [entry.event] : [],
//                 )
//                 .flatMap((ev) =>
//                     ev.event_type === "ENCHANT_GAIN" ? [ev.value] : [],
//                 )
//     }

//     return []
// }

export function humanizeBattleType(
    bt: MetaSummary["battleType"],
    roundMax: number | null | undefined,
) {
    const ARENA_ALIASES = {
        "33": "Arena - DwD",
        "34": "Arena - PGC",
        "35": "Arena - SPL",
        "105": "RoB - Konata",
        "106": "RoB - Asahina",
        "107": "RoB - Asakura",
        "108": "RoB - Nagato",
        "109": "RoB - Real Life",
        "110": "RoB - Unicorn",
        "111": "RoB - FSM",
        "112": "RoB - TTT",
    } as Record<string, string>

    if (!bt) {
        return "???"
    }

    switch (bt.category) {
        case "Arena": {
            const name = ARENA_ALIASES[bt.categoryValue!]
            if (name) {
                return name
            }
            const r = roundMax ?? "???"
            return `Arena ${r}r`
        }
        case "Tower":
            return `Tower ${bt.categoryValue!}f`
        case "RE":
            return "Random Encounter"
        default:
            return bt.category
    }
}
