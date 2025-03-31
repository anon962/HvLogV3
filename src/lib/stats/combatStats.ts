import { range, sum } from "radash"
import { EventGrammar, takeEvents } from "../eventGrammar"
import { CompleteLog, LogEntry } from "../logDb"
import { HvEvent, HvEventMap } from "../parsers"
import {
    EventSummary,
    EventSummaryData,
} from "../ui/hvlog/eventSummary"
import { enumerate, setDefault } from "../utils/miscUtils"

export function summarizeCombatUsage(
    log: CompleteLog
): CombatSummary {
    const data: CombatSummary["data"] = {}

    const offenseKeys = new Set<string>()
    const debuffKeys = new Set<string>()
    const healKeys = new Set<string>()
    const buffKeys = new Set<string>()
    const passiveHealKeys = new Set<string>()
    const passiveAttackKeys = new Set<string>()
    const meleeCastKeys = new Set<string>()

    const xs = log.entries
    for (let idx = 0; idx < xs.length; idx++) {
        const entry = log.entries[idx]
        if (entry.type !== "event") {
            continue
        }
        const ev = entry.event

        // Offense
        const offenseData = takeEntriesWithRoot(
            xs,
            idx,
            "cast",
            "offense"
        )
        if (offenseData) {
            const { cast, effects } = offenseData as {
                cast: HvEventMap["PLAYER_SKILL"]
                effects: HvEvent[][]
            }

            const effectSummary: CombatSummaryData["spell"] = []

            for (const grp of effects) {
                const attack = grp.find(
                    (ev) => ev.event_type === "PLAYER_ATTACK"
                )
                const resist = grp.find(
                    (ev) => ev.event_type === "RESIST"
                )
                const miss = grp.find(
                    (ev) => ev.event_type === "ENEMY_PARRY"
                )
                const death = grp.find(
                    (ev) => ev.event_type === "MONSTER_DEATH"
                )
                effectSummary.push({
                    value: attack?.value ?? 0,
                    miss: !!miss,
                    resist: resist ? 100 : attack?.resist ?? 0,
                    kill: !!death,
                    crit:
                        attack?.multiplier_type === "crits" ||
                        attack?.multiplier_type === "blasts",
                })
            }

            setDefault(data, cast.spell, []).push({
                key: cast.spell,
                logIdx: idx,
                spell: effectSummary,
            })

            offenseKeys.add(cast.spell)

            idx += sum(effects, (xs) => xs.length)
            continue
        }

        // Debuffs
        const debuffData = takeEntriesWithRoot(
            xs,
            idx,
            "cast",
            "debuff"
        )
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

            idx += sum(effects, (xs) => xs.length)
            continue
        }

        // Supportive
        const supportiveData = takeEntriesWithRoot(
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
                                // Channeling
                                // console.error(
                                //     "Unknown heal effect from supportive cast",
                                //     x,
                                //     cast,
                                //     effects
                                // )
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

            idx += sum(effects, (xs) => xs.length)
            continue
        }

        // Melee attacks
        const isStaffBonk =
            ev.event_type === "PLAYER_ATTACK" &&
            ev.spell === "Arcane Blow"
        if (ev.event_type === "PLAYER_MELEE" || isStaffBonk) {
            const effects = takeEntries(xs, idx, "offense")

            const effectSummary: CombatSummaryData["melee"] = {
                primary: {
                    name: isStaffBonk ? "Arcane Blow" : "Main Hand",
                    value: ev.value,
                    miss: false,
                    kill: false,
                    crit:
                        ev.multiplier_type === "crit" ||
                        ev.multiplier_type === "crits",
                },
                secondary: [],
            }
            for (const [idx, grp] of enumerate(effects)) {
                const attack = grp.find(
                    (ev) => ev.event_type === "PLAYER_ATTACK"
                )
                const offhand = grp.find(
                    (ev) => ev.event_type === "PLAYER_OFFHAND"
                )
                const miss = grp.find(
                    (ev) =>
                        ev.event_type === "ENEMY_EVADE" ||
                        ev.event_type === "ENEMY_DODGE"
                )
                const death = grp.find(
                    (ev) => ev.event_type === "MONSTER_DEATH"
                )

                if (idx === 0 && !attack && !offhand) {
                    effectSummary.primary.miss = !!miss
                    effectSummary.primary.kill = !!death
                } else {
                    effectSummary.secondary.push({
                        name: // prettier-ignore
                            offhand ? "Offhand" :
                            attack ? attack.spell :
                            "Unknown",
                        value: attack?.value ?? 0,
                        miss: !!miss,
                        kill: !!death,
                        crit: attack?.multiplier_type === "crit",
                    })
                }
            }

            setDefault(data, "Melee Attacks", []).push({
                key: "Melee Attacks",
                logIdx: idx,
                melee: effectSummary,
            })

            idx += sum(effects, (xs) => xs.length)
            continue
        }

        const meleeSkillData = takeEntriesWithRoot(
            xs,
            idx,
            "meleeCast",
            "offense"
        )
        if (meleeSkillData) {
            const { cast, effects } = meleeSkillData as {
                cast: HvEventMap["PLAYER_ITEM"]
                effects: HvEvent[][]
            }

            const effectSummary: CombatSummaryData["meleeCast"] = []

            for (const [idx, grp] of enumerate(effects)) {
                const attack = grp.find(
                    (ev) => ev.event_type === "PLAYER_ATTACK"
                )
                if (!attack) {
                    console.error(
                        "Expected melee skill to have attack but got nothing",
                        effects
                    )
                    continue
                }

                const parry = grp.find(
                    (ev) => ev.event_type === "ENEMY_PARRY"
                )
                const death = grp.find(
                    (ev) => ev.event_type === "MONSTER_DEATH"
                )

                effectSummary.push({
                    value: attack?.value ?? 0,
                    kill: !!death,
                    crit: attack?.multiplier_type === "crit",
                    parry: !!parry,
                    monster: attack.monster,
                })
            }

            setDefault(data, cast.item, []).push({
                key: cast.item,
                logIdx: idx,
                meleeCast: effectSummary,
            })

            meleeCastKeys.add(cast.item)

            idx += sum(effects, (xs) => xs.length)
            continue
        }

        // Passive attacks (eg spike shield, DoTs)
        if (
            ev.event_type === "PLAYER_ATTACK" ||
            ev.event_type === "PLAYER_SPIKE_SHIELD"
        ) {
            const key =
                ev.event_type === "PLAYER_ATTACK"
                    ? `${ev.spell} (passive)`
                    : "Spike Shield"
            passiveAttackKeys.add(key)

            let kill = false
            const nextEntry = xs[0]
            if (
                nextEntry?.type === "event" &&
                nextEntry?.event.event_type === "MONSTER_DEATH"
            ) {
                kill = true
            }

            setDefault(data, key, []).push({
                key,
                logIdx: idx,
                passiveAttack: {
                    value: ev.value,
                    kill,
                },
            })

            idx += kill ? 1 : 0
            continue
        }
    }

    for (let idx = 0; idx < xs.length; idx++) {
        const entry = log.entries[idx]
        if (entry.type !== "event") {
            continue
        }

        const ev = entry.event

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
                console.error(
                    "Unknown heal effect from EFFECT_RESTORE",
                    ev
                )
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
                label: "Spells",
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
            {
                label: "Melee Attacks",
                has: (d) => d.key === "Melee Attacks",
            },
            {
                label: "Melee Casts",
                has: (d) => meleeCastKeys.has(d.key),
            },
            {
                label: "Passive Attacks",
                has: (d) => passiveAttackKeys.has(d.key),
            },
        ],
    }
}

function takeEntriesWithRoot(
    entries: LogEntry[],
    startIdx: number,
    rootRef: keyof typeof CAST_GRAMMAR,
    effectRef: keyof typeof CAST_GRAMMAR
): { cast: HvEvent; effects: HvEvent[][] } | null {
    const evs = takeEvents(
        entries,
        startIdx,
        [{ refs: [rootRef] }, { refs: [effectRef] }],
        CAST_GRAMMAR
    )
    if (!evs) {
        return null
    }

    const [cast, ...firstEffects] = evs
    if (!firstEffects.length) {
        return null
    }

    const effects = firstEffects.length ? [firstEffects] : []
    effects.push(
        ...takeEntries(
            entries,
            startIdx + 1 + firstEffects.length,
            effectRef
        )
    )

    return {
        cast,
        effects,
    }
}

function takeEntries(
    entries: LogEntry[],
    startIdx: number,
    effectRef: keyof typeof CAST_GRAMMAR
): HvEvent[][] {
    const effects = []
    let offset = 0

    while (true) {
        const nextEffects = takeEvents(
            entries,
            startIdx + offset,
            [{ refs: [effectRef] }],
            CAST_GRAMMAR
        )

        if (nextEffects) {
            effects.push(nextEffects)
            offset += nextEffects.length
        } else {
            return effects
        }
    }
}

// prettier-ignore
const CAST_GRAMMAR = {
    cast: [
        { keys: ["PLAYER_SKILL"] },
    ],
    offense: [
        { refs: ["offenseMiss", "offenseHit"] },
    ],
    offenseMiss: [
        { keys: ["ENEMY_PARRY", "ENEMY_EVADE", "ENEMY_DODGE"] },
    ],
    offenseHit: [
        { keys: ["PLAYER_ATTACK", "PLAYER_OFFHAND"] },
        // Debuffs can occur an indefinite number of times
        // but currently no way to express that in the grammar
        // so just add it a bunch times as optional
        ...[...range(10)].map(() => 
            ({ keys: [
                "MONSTER_DEATH" as const,
                "DEBUFF" as const,
                "PLAYER_SPELL_ABSORBED" as const,
            ],
                optional: true 
            })
        ),

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
    meleeCast: [
        { keys: ["PLAYER_ITEM"] }
    ],
    items: [
        { keys: ["PLAYER_ITEM"] }
    ],
} as const satisfies EventGrammar

//

export type CombatSummary = EventSummary<
    CombatSummaryData,
    Array<{
        label:
            | "Spells"
            | "Debuffs"
            | "Heals"
            | "Buffs"
            | "Passive Heals"
            | "Times Sparked"
            | "Melee Attacks"
            | "Passive Attacks"
            | "Melee Casts"
        has: (d: CombatSummaryData) => boolean
    }>
>

type CombatSummaryData = EventSummaryData<{
    spell?: Array<{
        value: number
        miss: boolean
        resist: number
        kill: boolean
        crit: boolean
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
    melee?: {
        primary: {
            name: string
            value: number
            miss: boolean
            kill: boolean
            crit: boolean
        }
        secondary: Array<{
            name: string
            value: number
            miss: boolean
            kill: boolean
            crit: boolean
        }>
    }
    meleeCast?: Array<{
        value: number
        kill: boolean
        crit: boolean
        parry: boolean
        monster: string
    }>
    passiveAttack?: {
        value: number
        kill: boolean
    }
}>
