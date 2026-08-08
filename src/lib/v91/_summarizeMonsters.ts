import { LogEntries } from "../db/dbN"
import { MonsterSummary } from "../stats/summary"
import { _ALL_PARSERS, v91N as parsers } from "./_parsers"
import { v91 } from "./v91"

// explosion and parries cant be counted because no mob name logged
export function _summarizeMonsters(
    entries: LogEntries<parsers.HvEvent>,
    partition: v91.LogPartition,
): MonsterSummary {
    let roundCount = 1
    for (let idx = entries.length - 1; idx >= 0; idx--) {
        const x = entries[idx]
        if (x.type === "event") {
            if (x.event.event_type === "ROUND_START") {
                roundCount = x.event.current ?? 1
                break
            }
        }
    }

    const byMid: Record<
        string,
        {
            mid: number
            name: string
            hp: number
            level: number
            appearances: number
            damage: Record<
                "given" | "taken",
                Record<
                    "attack" | "skill" | "spell" | "other",
                    {
                        count: number
                        total: number
                    }
                >
            >
        }
    > = {}

    const infoByName: Record<
        string,
        {
            mid: string
            name: string
            hp: number
        }
    > = {}
    const push = (
        name: string,
        taken: Partial<
            Record<"attack" | "skill" | "spell" | "other", number>
        > | null,
        given: Partial<
            Record<"attack" | "skill" | "spell" | "other", number>
        > | null,
    ) => {
        if (!(name in infoByName)) {
            console.error(`No spawn for monster ${name}`)
            return
        }

        const { mid, hp } = infoByName[name]
        if (given) {
            const d = byMid[mid].damage.given
            if (given.attack !== undefined) {
                d.attack.count += 1
                d.attack.total += given.attack / 1000
            }
            if (given.skill !== undefined) {
                d.skill.count += 1
                d.skill.total += given.skill / 1000
            }
            if (given.spell !== undefined) {
                d.spell.count += 1
                d.spell.total += given.spell / 1000
            }
            if (given.other !== undefined) {
                d.other.count += 1
                d.other.total += given.other / 1000
            }
        }
        if (taken) {
            const d = byMid[mid].damage.taken
            if (taken.attack !== undefined) {
                d.attack.count += 1
                d.attack.total += taken.attack / hp
            }
            if (taken.skill !== undefined) {
                d.skill.count += 1
                d.skill.total += taken.skill / hp
            }
            if (taken.spell !== undefined) {
                d.spell.count += 1
                d.spell.total += taken.spell / hp
            }
            if (taken.other !== undefined) {
                d.other.count += 1
                d.other.total += taken.other / hp
            }
        }
    }

    const template = {
        count: 0,
        total: 0,
    }

    for (const x of entries) {
        if (x.type !== "event") {
            continue
        }

        const ev = x.event
        switch (ev.event_type) {
            case "SPAWN": {
                const { mid, hp, monster, level } = ev
                const k = String(mid)
                byMid[k] ??= {
                    mid: mid,
                    name: monster,
                    hp: hp,
                    level: level,
                    appearances: 0,
                    damage: {
                        given: {
                            attack: { ...template },
                            skill: { ...template },
                            spell: { ...template },
                            other: { ...template },
                        },
                        taken: {
                            attack: { ...template },
                            skill: { ...template },
                            spell: { ...template },
                            other: { ...template },
                        },
                    },
                }
                infoByName[monster] ??= {
                    mid: String(mid),
                    name: monster,
                    hp: ev.hp,
                }
                byMid[k].appearances += 1
                break
            }
            case "E_ATTACK": {
                push(ev.monster, null, {
                    attack: ev.value,
                })
                break
            }
            case "E_ATTACK_PARTIAL": {
                push(ev.monster, null, {
                    attack: ev.value,
                })
                break
            }
            case "E_MISS": {
                if (ev.monster) {
                    push(ev.monster, null, {
                        attack: 0,
                    })
                }
                break
            }
            case "E_MISS_2": {
                if (ev.monster) {
                    push(ev.monster, null, {
                        attack: 0,
                    })
                }
                break
            }
            case "E_MISS_3": {
                push(ev.monster, null, {
                    attack: 0,
                })
                break
            }
            case "E_MISS_4": {
                push(ev.monster, null, {
                    attack: 0,
                })
                break
            }
            case "E_MISS_5": {
                if (ev.monster) {
                    push(ev.monster, null, {
                        attack: 0,
                    })
                }
                break
            }
            case "E_S_ABSORB": {
                push(ev.monster, null, {
                    [ev.verb === "casts" ? "spell" : "skill"]: 0,
                })
                break
            }
            case "E_S_MISS": {
                push(ev.monster, null, {
                    [ev.verb === "casts" ? "spell" : "skill"]: 0,
                })
                break
            }
            case "E_S_MISS_2": {
                push(ev.monster, null, {
                    [ev.verb === "casts" ? "spell" : "skill"]: 0,
                })
                break
            }
            case "E_SPELL_HIT": {
                push(ev.monster, null, {
                    spell: ev.value,
                })
                break
            }
            case "E_SKILL_HIT": {
                push(ev.monster, null, {
                    spell: ev.value,
                })
                break
            }
            case "P_COUNTER": {
                push(
                    ev.monster,
                    {
                        other: ev.value,
                    },
                    null,
                )
                break
            }
            case "P_SPIKE_SHIELD": {
                push(
                    ev.monster,
                    {
                        other: ev.value,
                    },
                    null,
                )
                break
            }
        }
    }

    for (const seq of partition.attack) {
        for (const { event } of seq) {
            switch (event.event_type) {
                case "P_HIT": {
                    push(
                        event.monster,
                        {
                            attack: event.value,
                        },
                        null,
                    )
                    break
                }
                case "P_ATTACK": {
                    push(
                        event.monster,
                        {
                            attack: event.value,
                        },
                        null,
                    )
                    break
                }
                case "P_NAMED_HIT": {
                    push(
                        event.monster,
                        {
                            attack: event.value,
                        },
                        null,
                    )
                    break
                }
                case "P_MELEE_PARRY": {
                    push(
                        event.monster,
                        {
                            attack: 0,
                        },
                        null,
                    )
                    break
                }
                case "P_MELEE_MISS": {
                    push(
                        event.monster,
                        {
                            attack: 0,
                        },
                        null,
                    )
                    break
                }
                case "P_OFFHAND": {
                    push(
                        event.monster,
                        {
                            attack: event.value,
                        },
                        null,
                    )
                    break
                }
                case "P_OFFHAND_MISS": {
                    push(
                        event.monster,
                        {
                            attack: 0,
                        },
                        null,
                    )
                    break
                }
                case "P_ARCANE_BLOW": {
                    push(
                        event.monster,
                        {
                            attack: event.value,
                        },
                        null,
                    )
                    break
                }
            }
        }
    }

    for (const seq of partition.cast) {
        for (const { event } of seq) {
            switch (event.event_type) {
                case "P_HIT": {
                    push(
                        event.monster,
                        {
                            spell: event.value,
                        },
                        null,
                    )
                    break
                }
                case "P_SPELL_MISS": {
                    push(
                        event.monster,
                        {
                            spell: 0,
                        },
                        null,
                    )
                    break
                }
                case "P_SPELL_RESIST": {
                    push(
                        event.monster,
                        {
                            spell: 0,
                        },
                        null,
                    )
                    break
                }
                case "P_ABSORB": {
                    push(
                        event.monster,
                        {
                            spell: 0,
                        },
                        null,
                    )
                    break
                }
                case "P_NAMED_HIT_2": {
                    push(
                        event.monster,
                        {
                            other: event.value,
                        },
                        null,
                    )
                    break
                }
            }
        }
    }

    for (const seq of partition.skill) {
        for (const { event } of seq) {
            switch (event.event_type) {
                case "P_HIT": {
                    push(
                        event.monster,
                        {
                            skill: event.value,
                        },
                        null,
                    )
                    break
                }
                case "P_ABSORB": {
                    push(
                        event.monster,
                        {
                            skill: 0,
                        },
                        null,
                    )
                    break
                }
                case "P_MERCY": {
                    push(
                        event.monster,
                        {
                            skill: event.value,
                        },
                        null,
                    )
                    break
                }
            }
        }
    }

    const soaTemplate = () => ({
        count: [],
        total: [],
    })
    const monsters: MonsterSummary = {
        roundCount,
        mid: [],
        name: [],
        hp: [],
        level: [],
        appearances: [],
        damage: {
            taken: {
                attack: { ...soaTemplate() },
                skill: { ...soaTemplate() },
                spell: { ...soaTemplate() },
                other: { ...soaTemplate() },
            },
            given: {
                attack: { ...soaTemplate() },
                skill: { ...soaTemplate() },
                spell: { ...soaTemplate() },
                other: { ...soaTemplate() },
            },
        },
    }
    for (const x of Object.values(byMid)) {
        for (const k of [
            "mid",
            "name",
            "hp",
            "level",
            "appearances",
        ] as const) {
            ;(monsters as any)[k].push(x[k])
        }

        for (const k1 of ["taken", "given"] as const) {
            for (const k2 of ["attack", "skill", "spell", "other"] as const) {
                monsters["damage"][k1][k2]["count"].push(
                    x["damage"][k1][k2]["count"],
                )
                monsters["damage"][k1][k2]["total"].push(
                    x["damage"][k1][k2]["total"],
                )
            }
        }
    }

    return monsters
}
