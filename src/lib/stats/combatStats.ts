import { sort, ValueOf } from "myutils"

export function summarizeStyle(
    spell: CombatSummary["spell"],
    attack: CombatSummary["attack"],
    skill: CombatSummary["skill"],
): {
    primary: FightingStyle | null
    secondary: FightingStyle | null
    isImperil: boolean
} {
    const weights = {} as Record<string, number>
    for (const style of Object.values(MAGE_STYLES)) {
        weights[style.id] = 0
        for (const [key, x] of Object.entries(spell)) {
            if (style.spells.has(key)) {
                weights[style.id] += x.events.logIdx.length
            }
        }
    }

    const attackWeight = attack["Attack"]?.events.logIdx.length ?? 0
    for (const style of Object.values(MELEE_STYLES)) {
        weights[style.id] = 0
        for (const [key, x] of Object.entries(skill)) {
            if (style.skills.has(key)) {
                weights[style.id] += x.events.logIdx.length
                weights[style.id] += attackWeight
            }
        }
    }

    const candidates = sort(Object.keys(weights), (k) => weights[k], true)

    let pStyle: FightingStyle =
        (MAGE_STYLES as any)[candidates[0]] ??
        (MELEE_STYLES as any)[candidates[0]]
    let pStyleWeight = weights[candidates[0]]

    let sStyle: FightingStyle =
        (MAGE_STYLES as any)[candidates[1]] ??
        (MELEE_STYLES as any)[candidates[1]]
    let sStyleWeight = weights[candidates[1]]

    const isImperil =
        (spell["Imperil"]?.events.logIdx.length ?? 0) >= pStyleWeight / 8

    return {
        primary: pStyleWeight > 0 ? pStyle : null,
        secondary: pStyleWeight > 0 && sStyleWeight > 0 ? sStyle : null,
        isImperil,
    }
}

export type CombatSummary = {
    [K in keyof CombatSummaryEventMap]: Record<
        string,
        {
            key: string
            events: {
                [K2 in keyof CombatSummaryEventMap[K]]: Array<
                    CombatSummaryEventMap[K][K2]
                >
            } & { logIdx: number[] }
        }
    >
} & {
    style: {
        primary: FightingStyle | null
        secondary: FightingStyle | null
        isImperil: boolean
    }
} & {
    effectBlame: Record<string, string>
    downtime: Record<string, number>
    damageTaken: Record<
        string,
        {
            types: Record<string, number>
            hitCount: number
            crits: number
            glances: number
            evades: number
            partialParries?: number
            parries?: number
            partialBlocks?: number
            blocks?: number
            partialResists?: number
            resists?: number
            whiffs?: number
            absorbs?: number
        }
    >
    critMults: Array<{ count: number }>
}

export type CombatSummaryEventMap = {
    spell: SpellEvent
    heal: HealEvent
    passiveHeal: PassiveHealEvent
    debuff: DebuffEvent
    buff: BuffEvent
    spark: SparkEvent
    attack: AttackEvent
    skill: SkillEvent
    passiveAttack: PassiveAttackEvent
    riddlemaster: RiddlemasterEvent
    scan: ScanEvent
}

type SpellEvent = {
    hitCount: number
    value: number
    miss: number
    kill: number
    crit: number
    partialResist: number
    resist: number
    glance: number
    absorb: number
}
type HealEvent = {
    type: "item" | "cast"
    health: number
    magic: number
    spirit: number
}
type PassiveHealEvent = {
    health: number
    magic: number
    spirit: number
}
type DebuffEvent = {
    hitCount: number
    partialResistCount: number
    resistCount: number
    missCount: number
}
type BuffEvent = { type: "item" | "cast" }
type SparkEvent = {}
type AttackEvent = {
    value: number
    hitCount: number
    kill: number
    crit: number
    miss: number
    partialParry: number
    parry: number
    glance: number
}
type SkillEvent = {
    hitCount: number
    value: number
    kill: number
    crit: number
    absorb: number
}
type PassiveAttackEvent = {
    damage: number
    kill: number
}
type RiddlemasterEvent = {}
type ScanEvent = {
    monster: string
    trainer: string | null
}

export const MAGE_STYLES = {
    "Dark Mage": {
        id: "Dark Mage",
        spells: new Set(["Ragnarok", "Disintegrate", "Corruption"]),
    },
    "Holy Mage": {
        id: "Holy Mage",
        spells: new Set(["Paradise Lost", "Banishment", "Smite"]),
    },
    "Wind Mage": {
        id: "Wind Mage",
        spells: new Set(["Storms of Njord", "Downburst", "Gale"]),
    },
    "Elec Mage": {
        id: "Elec Mage",
        spells: new Set(["Wrath of Thor", "Chained Lightning", "Shockblast"]),
    },
    "Fire Mage": {
        id: "Fire Mage",
        spells: new Set(["Flames of Loki", "Inferno", "Fiery Blast"]),
    },
    "Cold Mage": {
        id: "Cold Mage",
        spells: new Set(["Fimbulvetr", "Blizzard", "Freeze"]),
    },
} as const

export const MELEE_STYLES = {
    "One-Handed": {
        id: "One-Handed",
        skills: new Set(["Merciful Blow", "Vital Strike", "Shield Bash"]),
    },
    "Dual Wield": {
        id: "Dual Wield",
        skills: new Set(["Iris Strike", "Backstab", "Frenzied Blows"]),
    },
    "Two-Handed": {
        id: "Two-Handed",
        skills: new Set(["Great Cleave", "Rending Blow", "Shatter Strike"]),
    },
    Niten: {
        id: "Niten",
        skills: new Set(["Skyward Sword"]),
    },
    Bonk: {
        id: "Bonk",
        skills: new Set(["Concussive Strike"]),
    },
} as const

type FightingStyle = ValueOf<typeof MAGE_STYLES> | ValueOf<typeof MELEE_STYLES>

export function humanizeFightingType(style: CombatSummary["style"]) {
    let result

    const p = FIGHTING_STYLE_NAMES[style.primary?.id as any]
    const s = FIGHTING_STYLE_NAMES[style.secondary?.id as any]

    if (p && s) {
        result = `${p.short} + ${s.short}`
    } else if (p) {
        result = p.long
    } else {
        result = "???"
    }

    return result
}

export const FIGHTING_STYLE_NAMES = {
    "Dark Mage": {
        long: "Dark Mage",
        short: "Dark",
    },
    "Holy Mage": {
        long: "Holy Mage",
        short: "Holy",
    },
    "Wind Mage": {
        long: "Wind Mage",
        short: "Wind",
    },
    "Elec Mage": {
        long: "Elec Mage",
        short: "Elec",
    },
    "Fire Mage": {
        long: "Fire Mage",
        short: "Fire",
    },
    "Cold Mage": {
        long: "Cold Mage",
        short: "Cold",
    },
    "One-Handed": {
        long: "One-Handed",
        short: "1H",
    },
    "Dual Wield": {
        long: "Dual Wield",
        short: "DW",
    },
    "Two-Handed": {
        long: "Two-Handed",
        short: "2H",
    },
    Niten: {
        long: "Niten",
        short: "Niten",
    },
    Bonk: {
        long: "Bonk",
        short: "Bonk",
    },
} as Record<
    string,
    {
        long: string
        short: string
    }
>
