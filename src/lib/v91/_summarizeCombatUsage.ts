import { enumerate } from "myutils"
import { CompleteLog } from "../logDb/schema"
import {
    CombatSummary,
    CombatSummaryEventMap,
    summarizeStyle,
} from "../stats/combatStats"
import { type v91 as parsers } from "./_parsers"
import { type v91 } from "./v91"

const enemyActions = new Set([
    "E_ATTACK",
    "E_ATTACK_PARTIAL",
    "E_MISS",
    "E_MISS_2",
    "E_MISS_3",
    "E_MISS_4",
    "E_MISS_5",
    "E_S_ABSORB",
    "E_S_MISS",
    "E_S_MISS_2",
    "E_SPELL_HIT",
    "E_SKILL_HIT",
])

export function _summarizeCombatUsage(
    log: CompleteLog<parsers.HvEvent>,
    partition: v91.LogPartition,
): CombatSummary & { hasDupeError: boolean } {
    const effectBlame: Record<string, string> = {}
    const blamedCasts = new Set<string>()

    const allEvents = Object.values(partition).flatMap((cat) =>
        cat.flatMap((seq) => seq),
    )

    let spell: CombatSummary["spell"] = {}
    {
        for (const seq of partition.cast) {
            const [root, ...effects] = seq

            const buffer = new CombatEventBuffer<"spell">(
                () => ({
                    logIdx: [],
                    hitCount: [],
                    value: [],
                    miss: [],
                    kill: [],
                    crit: [],
                    partialResist: [],
                    resist: [],
                    glance: [],
                    absorb: [],
                }),
                () => ({
                    hitCount: 0,
                    value: 0,
                    miss: 0,
                    kill: 0,
                    crit: 0,
                    partialResist: 0,
                    resist: 0,
                    glance: 0,
                    absorb: 0,
                }),
            )

            let isEnemyPhase = false
            for (let idx = 0; idx < effects.length; idx += 1) {
                const { event, logIdx } = effects[idx]

                if (enemyActions.has(event.event_type)) {
                    isEnemyPhase = true
                }

                const kill =
                    effects[idx + 1]?.event.event_type === "MONSTER_DEATH"
                        ? 1
                        : 0

                switch (event.event_type) {
                    case "P_HIT":
                        if (!isEnemyPhase)
                            buffer.push(root.event.spell, {
                                value: event.value,
                                hitCount: 1,
                                kill,
                                crit: +(event.multiplier_type === "crit"),
                                partialResist: +!!event.resist,
                                glance: +(event.multiplier_type === "glanced"),
                            })
                        break
                    case "P_SPELL_MISS":
                        if (!isEnemyPhase)
                            buffer.push(root.event.spell, {
                                value: 0,
                                hitCount: 1,
                                kill,
                                miss: 1,
                            })
                        break
                    case "P_SPELL_RESIST":
                        if (!isEnemyPhase)
                            buffer.push(root.event.spell, {
                                value: 0,
                                hitCount: 1,
                                kill,
                                resist: 1,
                            })
                        break
                    case "P_ABSORB":
                        if (!isEnemyPhase)
                            buffer.push(root.event.spell, {
                                value: 0,
                                hitCount: 1,
                                kill,
                                absorb: 1,
                            })
                        break
                }
            }

            buffer.flush(spell, root.logIdx)
        }
    }
    // Remove (likely) debuffs
    for (const [key, group] of Object.entries(spell)) {
        if (group.events.value.every((v) => v === 0)) {
            delete spell[key]
        }
    }

    const heal: CombatSummary["heal"] = {}
    {
        const buffer = new CombatEventBuffer(
            () => ({
                logIdx: [],
                health: [],
                magic: [],
                spirit: [],
            }),
            () => ({
                type: 0,
                health: 0,
                magic: 0,
                spirit: 0,
            }),
        )

        for (const seq of partition.cast) {
            const [root, ...effects] = seq
            for (const { event } of effects) {
                switch (event.event_type) {
                    case "P_CURE_RESTORE":
                        buffer.push(root.event.spell, {
                            health: event.value,
                            magic: 0,
                            spirit: 0,
                        })
                        break
                }
            }

            buffer.flush(heal, root.logIdx, (x) => ({ ...x, type: "cast" }))
        }

        for (const seq of partition.item) {
            const [root, ...effects] = seq
            for (const { event } of effects) {
                switch (event.event_type) {
                    case "P_ITEM_RESTORE":
                        buffer.push(root.event.name, {
                            health: 0,
                            magic: 0,
                            spirit: 0,
                            [event.type]: event.value,
                        })
                        break
                }
            }

            buffer.flush(heal, root.logIdx, (x) => ({ ...x, type: "item" }))
        }
    }

    const passiveHeal: CombatSummary["passiveHeal"] = {}
    {
        const template = () => ({
            logIdx: [],
            health: [],
            magic: [],
            spirit: [],
        })
        const template2 = () => ({
            health: 0,
            magic: 0,
            spirit: 0,
        })

        for (const { event, logIdx } of allEvents) {
            switch (event.event_type) {
                case "EFFECT_RESTORE":
                    pushCombatEvent(
                        passiveHeal,
                        event.effect,
                        logIdx,
                        {
                            health: 0,
                            magic: 0,
                            spirit: 0,
                            [event.type]: event.value,
                        },
                        template,
                        template2,
                    )
                    break
                case "RIDDLE_RESTORE":
                    pushCombatEvent(
                        passiveHeal,
                        "Riddlemaster",
                        logIdx,
                        {
                            health: event.hp,
                            magic: event.mp,
                            spirit: event.sp,
                        },
                        template,
                        template2,
                    )
                    break
                default:
                    break
            }
        }
    }

    const debuff: CombatSummary["debuff"] = {}
    {
        const template = () => ({
            logIdx: [],
            hitCount: [],
            partialResistCount: [],
            resistCount: [],
            missCount: [],
        })
        const template2 = () => ({
            hitCount: 0,
            partialResistCount: 0,
            resistCount: 0,
            missCount: 0,
        })

        for (const [root, ...effects] of partition.cast) {
            if (!(root.event.spell in blamedCasts)) {
                const firstHit = effects.find(
                    ({ event }) => event.event_type === "P_DEBUFF_HIT",
                ) as v91.LogPartitionEntry<"P_DEBUFF_HIT">
                if (firstHit) {
                    blamedCasts.add(root.event.spell)
                    effectBlame[firstHit.event.name] = root.event.spell
                }
            }

            let hitCount = 0
            let partialResistCount = 0
            let resistCount = 0
            let missCount = 0
            for (const { event, logIdx } of effects) {
                if (enemyActions.has(event.event_type)) {
                    break
                }

                // Ignore damage spells that happen to apply debuff
                if (event.event_type === "P_HIT") {
                    break
                }

                switch (event.event_type) {
                    case "P_DEBUFF_HIT":
                        // Ignore secondary debuffs like Coalesced Mana
                        if (root.event.spell !== effectBlame[event.name]) {
                            break
                        }

                        hitCount += 1
                        break
                    case "P_DEBUFF_RESIST":
                        partialResistCount += 1
                        break
                    // case "P_DEBUFF_MISS":
                    //     resistCount += 1
                    //     break
                    case "P_SPELL_RESIST":
                        resistCount += 1
                        break
                }
            }

            if (hitCount + partialResistCount + resistCount + missCount === 0) {
                continue
            }

            pushCombatEvent(
                debuff,
                root.event.spell,
                root.logIdx,
                {
                    hitCount,
                    missCount,
                    partialResistCount,
                    resistCount,
                },
                template,
                template2,
            )
        }
    }

    const buff: CombatSummary["buff"] = {}
    {
        const template = () => ({
            logIdx: [],
            type: [],
        })

        for (const [root, ...effects] of partition.cast) {
            for (const { event } of effects) {
                if (enemyActions.has(event.event_type)) {
                    break
                }

                switch (event.event_type) {
                    case "P_BUFF_EFFECT":
                        if (event.effect === "Channeling") {
                            continue
                        }
                        pushCombatEvent(
                            buff,
                            root.event.spell,
                            root.logIdx,
                            {
                                type: "cast",
                            },
                            template,
                            () => ({}),
                        )
                        break
                }
            }
        }

        for (const [root, ...effects] of partition.item) {
            // Dont count elixirs as buffs
            if (
                effects.some((ev) => ev.event.event_type === "P_ITEM_RESTORE")
            ) {
                continue
            }

            for (const { event } of effects) {
                if (enemyActions.has(event.event_type)) {
                    break
                }

                switch (event.event_type) {
                    case "P_BUFF_EFFECT":
                        pushCombatEvent(
                            buff,
                            root.event.name,
                            root.logIdx,
                            {
                                type: "item",
                            },
                            template,
                            () => ({}),
                        )
                        break
                }
            }
        }
    }

    const spark: CombatSummary["spark"] = {}
    {
        for (const { event, logIdx } of allEvents) {
            if (event.event_type === "SPARK_TRIGGER") {
                spark["Spark of Life"] ??= {
                    key: "Spark of Life",
                    events: {
                        logIdx: [],
                    },
                }
                spark["Spark of Life"].events.logIdx.push(logIdx)
            }
        }
    }

    const attack: CombatSummary["attack"] = {}
    {
        for (const [root, ...effects] of partition.attack) {
            const buffer = new CombatEventBuffer<"attack">(
                () => ({
                    logIdx: [],
                    hitCount: [],
                    value: [],
                    kill: [],
                    crit: [],
                    miss: [],
                    partialParry: [],
                    parry: [],
                    glance: [],
                }),
                () => ({
                    value: 0,
                    hitCount: 0,
                    kill: 0,
                    crit: 0,
                    miss: 0,
                    partialParry: 0,
                    parry: 0,
                    glance: 0,
                }),
            )

            let realRoot = root as any as v91.PartitionEntry<
                Exclude<(typeof root)["event"]["event_type"], "P_DEBUFF_HIT">
            >
            let realRootIdx = -1
            if (root.event.event_type === "P_DEBUFF_HIT") {
                realRootIdx = effects.findIndex(
                    ({ event }) => event.event_type !== "P_DEBUFF_HIT",
                )
                // @ts-ignore
                realRoot = effects[realRootIdx]
            }

            const kill = +(
                effects[realRootIdx + 1]?.event.event_type === "MONSTER_DEATH"
            )
            switch (realRoot.event.event_type) {
                case "P_ATTACK":
                    buffer.push("Main Hand", {
                        value: realRoot.event.value,
                        hitCount: 1,
                        kill,
                        crit: +(realRoot.event.multiplier_type === "crit"),
                        glance: +(realRoot.event.multiplier_type === "glance"),
                        partialParry: +!!realRoot.event.parry,
                    })
                    break
                case "P_MELEE_PARRY":
                    buffer.push("Main Hand", {
                        hitCount: 1,
                        parry: 1,
                    })
                    break
                case "P_MELEE_MISS":
                    buffer.push("Main Hand", {
                        hitCount: 1,
                        parry: 1,
                    })
                    break
                default:
                    throw new Error()
            }

            for (let idx = realRootIdx + 2; idx < effects.length; idx++) {
                const { event } = effects[idx]

                const kill = +(
                    effects[idx + 1]?.event.event_type === "MONSTER_DEATH"
                )

                switch (event.event_type) {
                    // Domino
                    case "P_ATTACK":
                        buffer.push("Domino Strike", {
                            value: event.value,
                            hitCount: 1,
                            kill,
                            crit: +(event.multiplier_type === "crit"),
                            glance: +(event.multiplier_type === "glance"),
                        })
                        break
                    case "P_MELEE_PARRY":
                        buffer.push("Domino Strike", {
                            hitCount: 1,
                            parry: 1,
                        })
                        break
                    case "P_MELEE_MISS":
                        buffer.push("Domino Strike", {
                            hitCount: 1,
                            miss: 1,
                        })
                        break
                    case "P_HIT":
                        console.error(
                            "Unexpected P_HIT event when root is a melee attack",
                        )
                        break
                    case "P_NAMED_HIT":
                        buffer.push(event.name, {
                            value: event.value,
                            hitCount: 1,
                            kill,
                            glance: +(event.multiplier_type === "glances"),
                            crit: +(event.multiplier_type === "crits"),
                            partialParry: +!!event.parry,
                        })
                        break
                    case "P_COUNTER":
                        buffer.push("Counter", {
                            value: event.value,
                            hitCount: 1,
                            kill,
                        })
                        break
                    case "P_OFFHAND":
                        buffer.push("Offhand", {
                            value: event.value,
                            hitCount: 1,
                            kill,
                        })
                        break
                }
            }

            buffer.flush(attack, realRoot.logIdx)
        }
    }

    const skill: CombatSummary["skill"] = {}
    {
        for (const [root, ...effects] of partition.skill) {
            const buffer = new CombatEventBuffer(
                () => ({
                    logIdx: [],
                    hitCount: [],
                    value: [],
                    kill: [],
                    crit: [],
                    absorb: [],
                }),
                () => ({
                    hitCount: 0,
                    value: 0,
                    kill: 0,
                    crit: 0,
                    absorb: 0,
                }),
            )

            let isEnemyPhase = false
            for (let idx = 0; idx < effects.length; idx++) {
                const kill =
                    effects[idx + 1]?.event.event_type === "MONSTER_DEATH"

                const event = effects[idx].event
                if (enemyActions.has(event.event_type)) {
                    isEnemyPhase = true
                }

                switch (event.event_type) {
                    case "P_HIT":
                        if (!isEnemyPhase)
                            buffer.push(root.event.name, {
                                value: event.value,
                                hitCount: 1,
                                kill,
                                crit: +(event.multiplier_type === "crit"),
                            })
                        break
                    case "P_ABSORB":
                        if (!isEnemyPhase)
                            buffer.push(root.event.name, {
                                hitCount: 1,
                                kill,
                                absorb: 1,
                            })
                        break
                    case "P_MERCY":
                        if (!isEnemyPhase)
                            buffer.push(root.event.name, {
                                value: event.value,
                                hitCount: 1,
                                kill,
                            })
                        break
                }
            }
        }
    }

    const passiveAttack: CombatSummary["passiveAttack"] = {}
    {
        for (const [key, grp] of Object.entries(partition)) {
            for (const seq of grp) {
                const buffer = new CombatEventBuffer(
                    () => ({
                        logIdx: [],
                        damage: [],
                        kill: [],
                    }),
                    () => ({
                        damage: 0,
                        kill: 0,
                    }),
                )

                for (let idx = 0; idx < seq.length; idx++) {
                    const { event, logIdx } = seq[idx]
                    const kill =
                        seq[idx + 1]?.event.event_type === "MONSTER_DEATH"
                            ? 1
                            : 0

                    switch (event.event_type) {
                        case "P_SPIKE_SHIELD":
                            buffer.push("Spike Shield", {
                                damage: event.value,
                                kill,
                            })
                            break
                        case "P_NAMED_HIT_2":
                            buffer.push(event.name, {
                                damage: event.value,
                                kill,
                            })
                            break
                        case "P_EXPLOSION":
                            buffer.push(`${event.explosion} (explosion)`, {
                                damage: event.value,
                                kill,
                            })
                            break
                    }
                }

                buffer.flush(passiveAttack, seq[0].logIdx)
            }
        }
    }

    const cds = new Set<string>()
    const noCd = new Set<string>()
    const confirmedCd = new Set<string>()
    const downtime: Record<string, number> = {}
    let hasDupeError = false
    for (const [idx, x] of enumerate(log.entries)) {
        if (x.type === "error") {
            continue
        }

        const { event } = x
        if (
            event.event_type === "P_CAST" ||
            event.event_type === "P_ITEM_OR_SKILL"
        ) {
            const k = event.event_type === "P_CAST" ? event.spell : event.name

            if (noCd.has(k)) {
            } else if (cds.has(k)) {
                cds.delete(k)
                noCd.add(k)
                delete downtime[k]
                if (confirmedCd.has(k)) {
                    hasDupeError = true
                    // console.log(
                    //     "del",
                    //     k,
                    //     log.entries.slice(idx - 50, idx + 50).map((x) => x.event),
                    // )
                }
            } else {
                cds.add(k)
            }
        } else if (event.event_type === "P_CD_EXPIRE") {
            cds.delete(event.spell)
            confirmedCd.add(event.spell)
        } else if (event.event_type === "ROUND_START") {
            for (const k of cds) {
                downtime[k] ??= 0
                downtime[k] += 1
            }
        }
    }

    for (const k of Object.keys(downtime)) {
        if (!confirmedCd.has(k)) {
            delete downtime[k]
        }
    }

    const riddlemaster: CombatSummary["riddlemaster"] = {
        Ponies: {
            key: "Ponies",
            events: {
                logIdx: [],
            },
        },
    }
    {
        for (const seq of partition.start) {
            if (seq.some(({ event }) => event.event_type === "RIDDLE_MASTER")) {
                riddlemaster["Ponies"].events.logIdx.push(seq[0].logIdx)
            }
        }
    }

    const damageTaken: CombatSummary["damageTaken"] = {}
    {
        const push = (
            k: string,
            v: {
                damage?: { value: number; type: string }
                crits?: boolean
                glances?: boolean
                evades?: boolean
                partialParries?: boolean
                parries?: boolean
                partialBlocks?: boolean
                blocks?: boolean
                partialResists?: boolean
                resists?: boolean
                whiffs?: boolean
                absorbs?: boolean
            },
        ) => {
            damageTaken[k] ??= {
                types: {},
                hitCount: 0,
                glances: 0,
                evades: 0,
                crits: 0,
            }
            const tgt = damageTaken[k]

            v["crits"] ??= false
            v["glances"] ??= false
            v["evades"] ??= false

            tgt["hitCount"] += 1

            if ("damage" in v) {
                tgt["types"][v.damage!.type] ??= 0
                tgt["types"][v.damage!.type] += v.damage!.value
            }

            for (const kv of Object.entries(v)) {
                switch (kv[0]) {
                    case "damage":
                        break
                    default:
                        // @ts-ignore
                        tgt[kv[0]] ??= 0
                        // @ts-ignore
                        tgt[kv[0]] += kv[1] ? 1 : 0
                }
            }
        }

        for (const [idx, entry] of enumerate(log.entries)) {
            if (entry.type === "error") {
                continue
            }
            const { event: ev } = entry

            switch (ev.event_type) {
                case "SPIRIT_SHIELD":
                    break
                case "E_ATTACK":
                    push("Attack", {
                        damage: { value: ev.value, type: ev.damage_type },
                        crits: ev.multiplier_type === "crits",
                        glances: ev.multiplier_type === "glances",
                    })
                    break
                case "E_ATTACK_PARTIAL":
                    push("Attack", {
                        damage: { value: ev.value, type: ev.damage_type },
                        crits: ev.multiplier_type === "crits",
                        glances: ev.multiplier_type === "glances",
                        partialBlocks: !!ev.block,
                        partialParries: !!ev.parry,
                    })
                    break
                case "E_MISS":
                    push("Attack", {
                        partialBlocks: !!ev.partial_block,
                        blocks: !ev.partial_block,
                        partialParries: !!ev.partial_parry,
                        parries: !ev.partial_parry,
                    })
                    break
                case "E_MISS_2":
                    push("Attack", {
                        blocks: ev.multiplier_type === "block",
                        parries: ev.multiplier_type === "parry",
                    })
                    break
                case "E_MISS_3":
                    push("Attack", {
                        whiffs: true,
                    })
                    break
                case "E_MISS_4":
                    push("Attack", {
                        evades: true,
                    })
                    break
                case "E_MISS_5":
                    push("Attack", {
                        partialBlocks: !!ev.partial_block,
                        blocks: !ev.partial_block,
                        partialResists: !!ev.partial_resist,
                        resists: !ev.partial_resist,
                    })
                    break
                case "E_S_ABSORB":
                    push(ev.verb === "casts" ? "Spell" : "Skill", {
                        absorbs: true,
                    })
                    break
                case "E_S_MISS":
                    push(ev.verb === "casts" ? "Spell" : "Skill", {
                        whiffs: true,
                    })
                    break
                case "E_S_MISS_2":
                    push(ev.verb === "casts" ? "Spell" : "Skill", {
                        evades: true,
                    })
                    break
                case "E_SPELL_HIT":
                    push("Spell", {
                        damage: { value: ev.value, type: ev.damage_type },
                        crits: ev.multiplier_type === "crits",
                        glances: ev.multiplier_type === "glances",
                        partialBlocks: !!ev.block,
                        partialResists: !!ev.resist,
                    })
                    break
                case "E_SKILL_HIT":
                    push("Skill", {
                        damage: { value: ev.value, type: ev.damage_type },
                        crits: ev.multiplier_type === "crits",
                        glances: ev.multiplier_type === "glances",
                        partialBlocks: !!ev.block,
                        partialParries: !!ev.parry,
                    })
                    break
            }
        }
    }

    const critMults: CombatSummary["critMults"] = []
    {
        const push = (n: number) => {
            for (let idx = 0; idx < n; idx++) {
                critMults[idx] ??= {
                    count: 0,
                }
            }
            critMults[n - 1].count += 1
        }

        for (const seq of [...partition.attack, ...partition.skill]) {
            for (const entry of seq) {
                const { event: ev } = entry
                switch (ev.event_type) {
                    case "P_HIT":
                    case "P_ATTACK":
                    case "P_OFFHAND":
                        push(ev.crit_mult ?? 1)
                        break
                }
            }
        }
    }

    return {
        style: summarizeStyle(spell, attack, skill) as CombatSummary["style"],
        effectBlame,
        downtime,
        spell,
        skill,
        attack,
        buff,
        debuff,
        heal,
        passiveHeal,
        spark,
        passiveAttack,
        riddlemaster,
        hasDupeError,
        damageTaken,
        critMults,
    }
}

function pushCombatEvent<T extends keyof CombatSummaryEventMap>(
    acc: CombatSummary[T],
    id: string,
    logIdx: number,
    x: CombatSummaryEventMap[T],
    template: () => CombatSummary[T][string]["events"],
    template2: () => CombatSummaryEventMap[T],
) {
    acc[id] ??= {
        key: id,
        events: template(),
    }

    x = {
        ...template2(),
        ...x,
        logIdx,
    }

    // @ts-ignore
    const keys: Array<keyof CombatSummaryEventMap[T]> = Object.keys(
        acc[id].events,
    )
    for (const k of keys) {
        // @ts-ignore
        acc[id].events[k].push(x[k])
    }
}

class CombatEventBuffer<T extends keyof CombatSummaryEventMap> {
    data: Record<string, CombatSummaryEventMap[T]> = {}

    constructor(
        public template: () => CombatSummary[T][string]["events"],
        public template2: () => CombatSummaryEventMap[T],
    ) {}

    push(id: string, x: Partial<CombatSummaryEventMap[T]>) {
        this.data[id] ??= this.template2()
        for (const k of Object.keys(x)) {
            // @ts-ignore
            this.data[id][k] += x[k]
        }
    }

    flush(
        acc: CombatSummary[T],
        logIdx: number,
        tfm?: (x: CombatSummaryEventMap[T]) => CombatSummaryEventMap[T],
    ) {
        for (let [id, x] of Object.entries(this.data)) {
            x = tfm ? tfm(x) : x
            pushCombatEvent(acc, id, logIdx, x, this.template, this.template2)
        }

        this.data = {}
    }
}
