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
    const spellsWeighted = sort(
        Object.entries(spell).map(
            (kv) => [kv[0], kv[1].events.logIdx.length] as const,
        ),
        (kv) => kv[1],
        true,
    )

    const attackWeight = attack["Attack"]?.events.logIdx.length ?? 0
    const skillsWeighted = sort(
        Object.entries(skill).map(
            (kv) => [kv[0], kv[1].events.logIdx.length] as const,
        ),
        (kv) => kv[1] + attackWeight,
        true,
    )

    const candidates = sort([...spellsWeighted, ...skillsWeighted], (x) => x[1])

    let pStyle: FightingStyle | null = null
    let pStyleWeight = 0
    let sStyle: FightingStyle | null = null
    let sStyleWeight = 0
    for (const [id, weight] of candidates) {
        const style: FightingStyle | undefined =
            MAGE_STYLES_BY_SPELL[id] ?? MELEE_STYLES_BY_SKILL[id]
        if (!style) {
            continue
        }
        if (style.id === (pStyle as FightingStyle)?.id) {
            continue
        }

        if (!pStyle) {
            pStyle = style
            pStyleWeight = weight
        } else {
            sStyle = style
            sStyleWeight = weight
            break
        }
    }

    const isImperil =
        (spell["Imperil"]?.events.logIdx.length ?? 0) >= pStyleWeight / 8

    return {
        primary: pStyle,
        secondary: sStyle,
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

const MAGE_STYLES = {
    "Dark Mage": {
        id: "Dark Mage",
        name: "Dark Mage",
        spells: new Set(["Ragnarok", "Disintegrate", "Corruption"]),
    },
    "Holy Mage": {
        id: "Holy Mage",
        name: "Holy Mage",
        spells: new Set(["Paradise Lost", "Banishment", "Smite"]),
    },
    "Wind Mage": {
        id: "Wind Mage",
        name: "Wind Mage",
        spells: new Set(["Storms of Njord", "Downburst", "Gale"]),
    },
    "Elec Mage": {
        id: "Elec Mage",
        name: "Elec Mage",
        spells: new Set(["Wrath of Thor", "Chained Lightning", "Shockblast"]),
    },
    "Fire Mage": {
        id: "Fire Mage",
        name: "Fire Mage",
        spells: new Set(["Flames of Loki", "Inferno", "Fiery Blast"]),
    },
    "Cold Mage": {
        id: "Cold Mage",
        name: "Cold Mage",
        spells: new Set(["Fimbulvetr", "Blizzard", "Freeze"]),
    },
} as const
const MAGE_STYLES_BY_SPELL = Object.fromEntries(
    Object.values(MAGE_STYLES).flatMap((style) =>
        [...style.spells].map((spell) => [spell, style]),
    ),
)

const MELEE_STYLES = {
    "One-Handed": {
        id: "One-Handed",
        name: "One-Handed",
        skills: new Set(["Merciful Blow", "Vital Strike", "Shield Bash"]),
    },
    "Dual Wield": {
        id: "Dual Wield",
        name: "Dual Wield",
        skills: new Set(["Iris Strike", "Backstab", "Frenzied Blows"]),
    },
    "Two-Handed": {
        id: "Two-Handed",
        name: "Two-Handed",
        skills: new Set(["Great Cleave", "Rending Blow", "Shatter Strike"]),
    },
    Niten: {
        id: "Niten",
        name: "Niten",
        skills: new Set(["Skyward Sword"]),
    },
    Bonk: {
        id: "Bonk",
        name: "Bonk",
        skills: new Set(["Concussive Strike"]),
    },
} as const
const MELEE_STYLES_BY_SKILL = Object.fromEntries(
    Object.values(MELEE_STYLES).flatMap((style) =>
        [...style.skills].map((skill) => [skill, style]),
    ),
)

type FightingStyle = ValueOf<typeof MAGE_STYLES> | ValueOf<typeof MELEE_STYLES>
