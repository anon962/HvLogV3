import { EventGrammar, takeEvents } from "../eventGrammar"
import { CompleteLog, LogEntry } from "../logDb"
import { HvEvent, HvEventMap } from "../parsers"
import {
    EventSummary,
    EventSummaryData,
} from "../ui/hvlog/eventSummary"
import { setDefault } from "../utils/miscUtils"

export function summarizeCombatUsage(
    log: CompleteLog
): CombatSummary {
    const data: CombatSummary["data"] = {}

    const offenseKeys = new Set<string>()
    const debuffKeys = new Set<string>()
    const healKeys = new Set<string>()
    const buffKeys = new Set<string>()
    const passiveHealKeys = new Set<string>()

    const xs = log.entries
    for (let idx = 0; idx < xs.length; idx++) {
        const entry = log.entries[idx]
        if (entry.type !== "event") {
            continue
        }
        const ev = entry.event

        // Offense
        const offenseData = takeEntries(xs, idx, "cast", "offense")
        if (offenseData) {
            const { cast, effects } = offenseData as {
                cast: HvEventMap["PLAYER_SKILL"]
                effects: HvEvent[][]
            }

            const effectSummary: CombatSummaryData["offense"] = []

            for (const grp of effects) {
                const attack = grp.find(
                    (ev) => ev.event_type === "PLAYER_ATTACK"
                )
                const resist = grp.find(
                    (ev) => ev.event_type === "RESIST"
                )
                const miss = grp.find(
                    (ev) => ev.event_type === "PLAYER_MISS"
                )
                const death = grp.find(
                    (ev) => ev.event_type === "MONSTER_DEATH"
                )
                effectSummary.push({
                    value: attack?.value ?? 0,
                    resist:
                        resist || miss
                            ? 100
                            : attack?.resist
                            ? attack.resist
                            : 0,
                    kill: !!death,
                })
            }

            setDefault(data, cast.spell, []).push({
                key: cast.spell,
                logIdx: idx,
                offense: effectSummary,
            })

            offenseKeys.add(cast.spell)

            idx += effects.length
            continue
        }

        // Debuffs
        const debuffData = takeEntries(xs, idx, "cast", "debuff")
        if (debuffData) {
            const { cast, effects } = debuffData as {
                cast: HvEventMap["PLAYER_SKILL"]
                effects: HvEvent[][]
            }

            const effectSummary: CombatSummaryData["debuff"] = []

            for (const grp of effects) {
                const resist = grp.find(
                    (ev) => ev.event_type === "RESIST"
                )
                effectSummary.push(!!resist)
            }

            setDefault(data, cast.spell, []).push({
                key: cast.spell,
                logIdx: idx,
                debuff: effectSummary,
            })

            debuffKeys.add(cast.spell)

            idx += effects.length
            continue
        }

        // Supportive
        const supportiveData = takeEntries(
            xs,
            idx,
            "supportiveCast",
            "supportive"
        )
        if (supportiveData) {
            const { cast, effects } = supportiveData as {
                cast: HvEventMap["PLAYER_SKILL" | "PLAYER_ITEM"]
                effects: HvEvent[][]
            }

            const key =
                cast.event_type === "PLAYER_SKILL"
                    ? cast.spell
                    : cast.item

            const isBuff = effects[0][0].event_type === "PLAYER_BUFF"
            if (isBuff) {
                setDefault(data, key, []).push({
                    key,
                    logIdx: idx,
                    buff: true,
                })

                buffKeys.add(key)
            } else {
                const heal = effects
                    .flatMap((x) => x)
                    .reduce(
                        (acc, x) => {
                            let type = ""
                            let value = 0
                            switch (x.event_type) {
                                case "CURE_RESTORE":
                                    type = "health"
                                    value = x.value
                                    break
                                case "ITEM_RESTORE":
                                    type = x.type
                                    value = x.value
                                    break
                            }

                            if (!(type in acc)) {
                                console.error("Unknown heal type", x)
                                return acc
                            }

                            acc[type] += value
                            return acc
                        },
                        { health: 0, magic: 0, spirit: 0 } as any
                    )

                setDefault(data, key, []).push({
                    key: key,
                    logIdx: idx,
                    heal,
                })

                healKeys.add(key)
            }

            idx += effects.length
            continue
        }

        // Draughts / Regen / Riddlemaster
        const healTypes = new Set([
            "health",
            "magic",
            "spirit",
        ] as const)
        if (ev.event_type === "EFFECT_RESTORE") {
            if (healTypes.has(ev.type as any)) {
                setDefault(data, ev.effect, []).push({
                    key: ev.effect,
                    logIdx: idx,
                    effectHeals: {
                        health: 0,
                        magic: 0,
                        spirit: 0,
                        [ev.type]: ev.value,
                    },
                })

                passiveHealKeys.add(ev.effect)
            } else {
                console.error("Unknown heal type", ev)
            }
        } else if (ev.event_type === "RIDDLE_RESTORE") {
            setDefault(data, "RIDDLE_RESTORE", []).push({
                key: "RIDDLE_RESTORE",
                logIdx: idx,
                effectHeals: {
                    health: ev.hp,
                    magic: ev.mp,
                    spirit: ev.sp,
                },
            })

            passiveHealKeys.add("RIDDLE_RESTORE")
        }

        // Spark of Life
        if (ev.event_type === "SPARK_TRIGGER") {
            setDefault(data, "SPARK_TRIGGER", []).push({
                key: "SPARK_TRIGGER",
                logIdx: idx,
                spark: true,
            })
        }
    }

    return {
        data,
        groups: [
            {
                label: "Offense",
                has: (d) => offenseKeys.has(d.key),
            },
            {
                label: "Debuffs",
                has: (d) => debuffKeys.has(d.key),
            },
            {
                label: "Heals",
                has: (d) => healKeys.has(d.key),
            },
            {
                label: "Buffs",
                has: (d) => buffKeys.has(d.key),
            },
            {
                label: "Passive Heals",
                has: (d) => passiveHealKeys.has(d.key),
            },
            {
                label: "Times Sparked",
                has: (d) => d.key === "SPARK_TRIGGER",
            },
        ],
    }
}

function takeEntries(
    entries: LogEntry[],
    startIdx: number,
    rootRef: keyof typeof CAST_GRAMMAR,
    effectRef: keyof typeof CAST_GRAMMAR
): { cast: HvEvent; effects: HvEvent[][] } | null {
    const evs = takeEvents(
        entries,
        startIdx,
        [{ refs: [rootRef] }],
        CAST_GRAMMAR
    )
    if (!evs) {
        return null
    }

    const [cast, ...firstEffects] = evs
    const effects = firstEffects.length ? [firstEffects] : []

    while (true) {
        const nextEffects = takeEvents(
            entries,
            startIdx + 1 + effects.length,
            [{ refs: [effectRef] }],
            CAST_GRAMMAR
        )

        if (nextEffects) {
            effects.push(nextEffects)
        } else {
            return {
                cast,
                effects,
            }
        }
    }
}

// prettier-ignore
const CAST_GRAMMAR = {
    cast: [
        { keys: ["PLAYER_SKILL"] },
    ],
    offense: [
        { keys: ["PLAYER_ATTACK", "PLAYER_MISS", "RESIST", "MONSTER_DEATH"] },
        { keys: ["DEBUFF"], optional: true }, 
    ],
    debuff: [
        { keys: ["DEBUFF", "RESIST"] },
    ],
    supportiveCast: [
        { keys: ["PLAYER_SKILL", "PLAYER_ITEM"] },
    ],
    supportive: [
        { keys: ["CURE_RESTORE", "ITEM_RESTORE", "PLAYER_BUFF"] },
    ],
} as const satisfies EventGrammar

//

export type CombatSummary = EventSummary<
    CombatSummaryData,
    Array<{
        label:
            | "Offense"
            | "Debuffs"
            | "Heals"
            | "Buffs"
            | "Passive Heals"
            | "Times Sparked"
        has: (d: CombatSummaryData) => boolean
    }>
>

type CombatSummaryData = EventSummaryData<{
    offense?: Array<{
        value: number
        resist: number
        kill: boolean
    }>
    heal?: {
        health: number
        magic: number
        spirit: number
    }
    effectHeals?: {
        health: number
        magic: number
        spirit: number
    }
    debuff?: boolean[]
    buff?: boolean
    spark?: boolean
}>
