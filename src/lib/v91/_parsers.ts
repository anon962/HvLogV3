import { BaseHvEvent, EventParser, t } from "../eventParser"
import { ValueOf } from "myutils"

export namespace v91 {
    export type HvEvent = ValueOf<HvEventMap>
    export type HvEventMap = {
        [K in keyof _P]: BaseHvEvent<_P[K]["schema"], _P[K]["name"]>
    }
}

const Group = (name: string, patt: string) => `(?<${name}>${patt})`
const Float = (name: string) => Group(name, "\\d+(?:\\.\\d*)?")
const Mult = (...args: string[]) => Group("multiplier_type", args.join("|"))
const Num = (name: string) => Group(name, "\\d+?")
const Word = (name: string) => Group(name, "[\\w\\s\\-]+")
const Words = (name: string) => Group(name, "[\\w\\s\\- ]+?")
const Monster = () => Group("monster", "[\\w\\s\\-+]+") // "New Game +" is a valid monster name

const CritMult = () => `(?:${Num("crit_mult")}x-)?`

// @todo: override order and frequency order
// prettier-ignore
const PARSERS = {
    P_CAST: new EventParser(
        "P_CAST",
        `You cast ${Words("spell")}\\.`,
        { spell: t("string") }
    ),
    // Erling Braut Haaland was hit for 94426 Dark damage
    // Erling Braut Haaland was crit for 200632 Dark damage
    P_HIT: new EventParser(
        "P_HIT",
        `${Monster()}(?:${Group('resist', ' resists, and')})? was ${CritMult()}${Mult("hit", "crit", "glanced")} for ${Num("value")} (?:${Word("damage_type")} )?damage\\.?`,
        {
            monster: t("string"),
            resist: t("boolean").optional(),
            multiplier_type: t("string"),
            crit_mult: t("number").optional(),
            damage_type: t("string").optional(),
            value: t("number"),
        }
    ),
    P_SPELL_MISS: new EventParser(
        "P_SPELL_MISS",
        `${Monster()} deftly evades your spell\\.`,
        {
            monster: t("string")
        }
    ),
    P_SPELL_RESIST: new EventParser(
        "P_SPELL_RESIST",
        `${Monster()} shrugs off the effects of your spell\\.`,
        {
            monster: t("string")
        }
    ),
    P_SPELL_ABSORB: new EventParser(
        "P_ABSORB",
        `${Monster()} gets hit, but the spell is absorbed\\.`,
        {
            monster: t("string"),
        }
    ),
    P_DEBUFF_HIT: new EventParser(
        "P_DEBUFF_HIT",
        `${Monster()} gains the effect ${Words("name")}\\.`,
        {
            monster: t("string"),
            name: t("string"),
        }
    ),
    // Nana Morse partially resists the effects of your spell.
    P_DEBUFF_RESIST: new EventParser(
        "P_DEBUFF_RESIST",
        `${Monster()} partially resists the effects of your spell\\.`,
        {
            monster: t("string")
        }
    ),
    // P_DEBUFF_MISS: new EventParser(
    //     "P_DEBUFF_MISS",
    //     `${Monster()} resists your spell\\.`,
    //     {
    //         monster: t("string"),
    //     }
    // ),
    P_DEBUFF_EXPIRE: new EventParser(
        "P_DEBUFF_EXPIRE",
        `The effect ${Words("effect")} on ${Monster()} has worn off\\.`,
        {
            effect: t("string"),
            monster: t("string"),
        }
    ),
    P_BUFF: new EventParser(
        "P_BUFF_EFFECT",
        `You gain the effect ${Words("effect")}\\.`,
        { effect: t("string") }
    ),
    P_ITEM_OR_SKILL: new EventParser(
        "P_ITEM_OR_SKILL",
        `You use ${Words("name")}\\.`,
        {
            name: t("string"),
        }
    ),
    P_MERCY: new EventParser(
        "P_MERCY",
        `${Monster()} is eviscerated for ${Num('value')} ${Word('damage_type')} damage, putting it out of its misery`,
        {
            monster: t("string"),
            value: t("number"),
            damage_type: t("string"),
        }
    ),
    // You 2x-crit Rippling Ophelia, which partially parries, causing 60212 points of Void damage.
    P_ATTACK: new EventParser(
        "P_ATTACK",
        `You ${CritMult()}${Mult("hit", "crit", "glance")} ${Monster()},(?:${Group("parry", " which partially parries,")})? causing ${Num("value")} points of ${Word("damage_type")} damage\\.`,
        {
            crit_mult: t("number").optional(),
            multiplier_type: t('string'),
            monster: t("string"),
            parry: t("boolean").optional(),
            value: t("number"),
            damage_type: t("string"),
        }
    ),
    // Arcane Blow glances Ikuta Minami, which partially parries, causing 1246 points of Crushing damage
    // Arcane Blow glances Tryuu, causing 2879 points of Crushing damage.
    // Dark Strike hits Tryuu, causing 822 additional points of Dark damage.
    P_NAMED_HIT: new EventParser(
        "P_NAMED_HIT",
        `${Words("name")} ${Mult("hits", "crits", "glances")} ${Monster()}, (?:${Group("parry", "which partially parries, ")})?causing ${Num("value")} (?:additional )?points of (?:${Word("damage_type")} )?damage\\.`,
        {
            name: t("string"),
            multiplier_type: t("string"),
            monster: t("string"),
            parry: t("boolean").optional(),
            value: t("number"),
            damage_type: t("string").optional(),
        }
    ),
    P_NAMED_HIT_2: new EventParser(
        "P_NAMED_HIT_2",
        `${Words("name")} hits ${Monster()} for ${Num("value")} damage.`,
        {
            name: t("string"),
            monster: t("string"),
            value: t("number"),
        }
    ),
    P_MELEE_PARRY: new EventParser(
        "P_MELEE_PARRY",
        `${Monster()} ${Mult("parries")} your attack\\.`,
        {
            monster: t("string"),
            multiplier_type: t("string"),
        }
    ),
    P_MELEE_MISS: new EventParser(
        "P_MELEE_MISS",
        `${Monster()} dodges your attack\\.`,
        {
            monster: t("string"),
        }
    ),
    P_COUNTER: new EventParser(
        "P_COUNTER",
        `You counter ${Monster()} for ${Num("value")} points of ${Word("damage_type")} damage\\.`,
        {
            monster: t("string"),
            value: t("number"),
            damage_type: t("string"),
        }
    ),
    P_OFFHAND: new EventParser(
        "P_OFFHAND",
        `Your offhand attack ${CritMult()}${Mult("hits", "crits")} ${Monster()}, causing ${Num("value")} points of ${Word("damage_type")} damage\\.`,
        {
            crit_mult: t("number").optional(),
            multiplier_type: t('string'),
            monster: t("string"),
            value: t("number"),
            damage_type: t("string"),
        }
    ),
    P_CD_EXPIRE: new EventParser(
        "P_CD_EXPIRE",
        `Cooldown expired for ${Words("spell")}`,
        {
            spell: t("string"),
        }
    ),
    P_STANCE_START: new EventParser(
        "P_STANCE_START",
        `Spirit Stance Engaged`,
        {}
    ),
    P_STANCE_END: new EventParser(
        "P_STANCE_END",
        `Spirit Stance Exhausted`,
        {}
    ),
    P_SPIKE_SHIELD: new EventParser(
        "P_SPIKE_SHIELD",
        `Your spike shield hits ${Monster()} for ${Num("value")} (?:points of )?(?:${Word("damage_type")} )?damage\\.?`,
        {
            monster: t("string"),
            damage_type: t("string").optional(),
            value: t("number"),
        }
    ),
    P_EXPLOSION: new EventParser(
        "P_EXPLOSION",
        `${Words('explosion')} explodes for ${Num('value')} ${Word("type")} damage`,
        {
            explosion: t('string'),
            value: t("number"),
            type: t("string"),
        }
    ),
    P_CURE_RESTORE: new EventParser(
        "P_CURE_RESTORE",
        `You are healed for ${Num("value")} Health Points\\.`,
        {
            value: t("number"),
        }
    ),
    P_ITEM_RESTORE: new EventParser(
        "P_ITEM_RESTORE",
        `Recovered ${Num("value")} points of ${Word("type")}\\.`,
        { value: t("number"), type: t("string") }
    ),
    // You drain 924 points of health from Drogon.
    P_DRAIN: new EventParser(
        "P_DRAIN",
        `You drain ${Num("value")} points of ${Word("type")} from ${Monster()}.`,
        {
            value: t("number"),
            type: t("string"),
        }
    ),

    // Trying A Margherita Pizza hits you, causing 874 points of Piercing damage.
    // Myth Android glances you, causing 466 points of Slashing damage.
    E_ATTACK: new EventParser(
        "E_ATTACK",
        `${Monster()} ${Mult("hits", "crits", "glances")} you, causing ${Num("value")} points of ${Word("damage_type")} damage\\.`,
        {
            monster: t("string"),
            multiplier_type: t("string"),
            value: t("number"),
            damage_type: t("string"),
        }
    ),
    // Kazooie glances you; you partially block and partially parry the attack, and take 103 points of Piercing damage.
    // Eosinophils crits you; you partially parry the attack, and take 1083 points of Piercing damage.
    // Eosinophils crits you; you partially block the attack, and take 1185 points of Piercing damage.
    E_ATTACK_PARTIAL: new EventParser(
        "E_ATTACK_PARTIAL",
        `${Monster()} ${Mult("hits", "crits", "glances")} you; you(?:${Group("block", " partially block")})?(?: and)?(?:${Group("parry", " partially parry")})? the attack, and take ${Num("value")} points of ${Word("damage_type")} damage\\.`,
        {
            monster: t("string"),
            multiplier_type: t("string"),
            parry: t("boolean").optional(),
            block: t("boolean").optional(),
            value: t("number"),
            damage_type: t("string"),
        }
    ),
    // You partially block and parry the attack from Peerlesssss2 Katana.
    // You block and partially parry the attack from Runick Fountain.
    E_MISS: new EventParser(
        "E_MISS",
        `You (?:${Group("partial_block", "partially ")})?block and (?:${Group("partial_parry", "partially ")})?parry the attack(?: from ${Monster()})?\\.`,
        {
            partial_block: t("boolean").optional(),
            partial_parry: t("boolean").optional(),
            monster: t('string').optional(),
        }
    ),
    E_MISS_2: new EventParser(
        "E_MISS_2",
        `You ${Group('multiplier_type', "block|parry")} the attack(?: from ${Monster()})?\\.`,
        {
            multiplier_type: t('string'),
            monster: t('string').optional(),
        }
    ),
    E_MISS_3: new EventParser(
        "E_MISS_3",
        `${Monster()} vigorously whiffs at a shadow, missing you completely\\.`,
        {
            monster: t("string"),
        }
    ),
    E_MISS_4: new EventParser(
        "E_MISS_4",
        `You evade the attack from ${Monster()}\\.`,
        {
            monster: t("string"),
        }
    ),
    // You partially block and parry the attack from Peerlesssss2 Katana.
    // You block and partially parry the attack from Runick Fountain.
    E_MISS_5: new EventParser(
        "E_MISS_5",
        `You (?:${Group("partial_block", "partially ")})?block and (?:${Group("partial_resist", "partially ")})?resist the attack(?: from ${Monster()})?\\.`,
        {
            partial_block: t("boolean").optional(),
            partial_resist: t("boolean").optional(),
            monster: t('string').optional(),
        }
    ),
    E_S_ABSORB: new EventParser(
        "E_S_ABSORB",
        `${Monster()} ${Group("verb","casts|uses")} ${Words("name")}, but it is ${Mult("absorb")}ed\\. You gain ${Word("mp")} points of mana.`,
        {
            monster: t("string"),
            verb: t("string"),
            name: t("string"),
            multiplier_type: t("string"),
            mp: t("number"),
        }
    ),
    E_S_MISS: new EventParser(
        "E_S_MISS",
        `${Monster()} ${Group("verb","casts|uses")} ${Words("name")} in the general direction of a shadow, missing you completely.`,
        {
            monster: t("string"),
            verb: t("string"),
            name: t("string"),
        }
    ),
    E_S_MISS_2: new EventParser(
        "E_S_MISS_2",
        `${Monster()} ${Group("verb","casts|uses")} ${Words("name")}, but misses the attack\\.`,
        {
            monster: t("string"),
            verb: t("string"),
            name: t("string"),
        }
    ),
    // P-killer casts kore ha bokuno oinarisanda, which glances! You resist the attack, and take 1062 Holy damage.
    E_SPELL_HIT: new EventParser(
        "E_SPELL_HIT",
        `${Monster()} casts ${Words("spell")}, which ${Mult("glances", "crits", "hits")}! You (?:${Group("block", "partially block ")})?(?:and )?(?:${Group("resist", "resist ")})?(?:the attack, and )?take ${Num("value")} ${Word("damage_type")} damage\\.`,
        {
            monster: t("string"),
            spell: t("string"),
            multiplier_type: t("string"),
            block: t("boolean").optional(),
            resist: t("boolean").optional(),
            value: t("number"),
            damage_type: t("string"),
        }
    ),
    E_SKILL_HIT: new EventParser(
        "E_SKILL_HIT",
        `${Monster()} uses ${Words("skill")}, which ${Mult("glances", "crits", "hits")}! You (?:${Group("block", "partially block ")})?(?:and )?(?:${Group("parry", "partially parry ")})?(?:the attack, and )?take ${Num("value")} ${Word("damage_type")} damage\\.`,
        {
            monster: t("string"),
            skill: t("string"),
            multiplier_type: t("string"),
            parry: t("boolean").optional(),
            block: t("boolean").optional(),
            value: t("number"),
            damage_type: t("string"),
        }
    ),

    // Effects
    RIDDLE_RESTORE: new EventParser(
        "RIDDLE_RESTORE",
        `Time Bonus: Recovered ${Num("hp")} HP, ${Num("mp")} MP and ${Num("sp")} SP\\.`,
        {
            hp: t("number"),
            mp: t("number"),
            sp: t("number"),
        }
    ),
    EFFECT_RESTORE: new EventParser(
        "EFFECT_RESTORE",
        `${Words("effect")} restores ${Num("value")} points of ${Word("type")}\\.`,
        {
            effect: t("string"),
            value: t("number"),
            type: t("string"),
        }
    ),

    SPIRIT_SHIELD: new EventParser(
        "SPIRIT_SHIELD",
        `Your spirit shield absorbs ${Num("damage")} points of damage from the attack into ${Num("spirit_damage")} points of spirit damage\\.`,
        {
            damage: t("number"),
            spirit_damage: t("number"),
        }
    ),
    SPARK_TRIGGER: new EventParser(
        "SPARK_TRIGGER",
        `Spark of Life saves you from the brink of defeat!`,
        {}
    ),
    DISPEL: new EventParser(
        "DISPEL",
        `The effect ${Words("effect")} was dispelled\\.`,
        {
            effect: t("string"),
        }
    ),
    EFFECT_EXPIRE: new EventParser(
        "EFFECT_EXPIRE",
        `The effect ${Words("effect")} (?:on ${Monster()} )?has worn off\\.`,
        {
            effect: t("string"),
            monster: t("string").optional()
        }
    ),
    SKILL_FAIL: new EventParser(
        "SKILL_FAIL",
        `Insufficient overcharge to use ${Words("skill")}.`,
        {
            skill: t("string")
        }
    ),
    STANCE_FAIL: new EventParser(
        "STANCE_FAIL",
        `Insufficient overcharge or spirit for Spirit Stance.`,
        {
        }
    ),
    // Info
    ROUND_START: new EventParser(
        "ROUND_START",
        `Initializing ${Group("battle_type", ".+?")}(?: \\\(Round ${Num("current")} / ${Num("max")}\\\))? \\.\\.\\.`,
        {
            battle_type: t("string"),
            current: t("number").optional(),
            max: t("number").optional(),
        }
    ),
    ROUND_END: new EventParser(
        "ROUND_END",
        `You are Victorious!`,
        {}
    ),
    DEFEAT: new EventParser(
        "DEFEAT",
        "You have been defeated\\.",
        {}
    ),
    FLEE: new EventParser(
        "FLEE",
        "You have escaped from the battle\\.",
        {}
    ),
    SPAWN: new EventParser(
        "SPAWN",
        `Spawned Monster ${Group("letter", "[A-Z]")}: MID=${Num("mid")} \\\(${Monster()}\\\) LV=${Num("level")} HP=${Num("hp")}`,
        {
            letter: t("string"),
            mid: t("number"),
            monster: t("string"),
            level: t("number"),
            hp: t("number"),
        }
    ),
    MONSTER_DEATH: new EventParser(
        "MONSTER_DEATH",
        `${Monster()} has been defeated\\.`,
        {
            monster: t("string"),
        }
    ),
    RIDDLE_MASTER: new EventParser(
        "RIDDLE_MASTER",
        `The Riddlemaster listens.*`,
        {}
    ),

    GEM: new EventParser(
        "GEM",
        `${Monster()} drops a ${Words("type")} powerup!`,
        {
            monster: t("string"),
            type: t("string"),
        }
    ),
    CREDITS: new EventParser(
        "CREDITS",
        `You gain ${Num("value")} Credits!`,
        {
            value: t("number"),
        }
    ),
    DROP: new EventParser(
        "DROP",
        `${Monster()} dropped \\[${Group("item", ".*")}\\]`,
        {
            monster: t("string"),
            item: t("string"),
        }
    ),
    // Easter 2025
    DROP_EVENT: new EventParser(
        "DROP_EVENT",
        `You found \\[${Group("item", ".*")}\\]`,
        {
            item: t("string"),
        }
    ),
    SOUL_FRAG_DROP: new EventParser(
        "SOUL_FRAG_DROP",
        `You obtained ${Num("count")}x \\[Soul Fragments\\]`,
        {
            count: t("number"),
        }
    ),
    PROFICIENCY: new EventParser(
        "PROFICIENCY",
        `You gain ${Float("value")} points of ${Words("type")}\\.`,
        {
            value: t("number"),
            type: t("string"),
        }
    ),
    EXPERIENCE: new EventParser(
        "EXPERIENCE",
        `You gain ${Num("value")} EXP!`,
        {
            value: t("number"),
        }
    ),
    AUTO_SALVAGE: new EventParser(
        "AUTO_SALVAGE",
        `A traveling salesmoogle salvages it into ${Num("value")}x \\[${Words("item")}\\](?: and ${Num("value2")}x \\[${Words("item2")}\\])?, plus \\[${Num("credits")} Credits\\] for the remains\\.`,
        {
            value: t("number"),
            item: t("string"),
            value2: t("number").optional(),
            item2: t("string").optional(),
            credits: t("number"),
        }
    ),
    AUTO_SELL: new EventParser(
        "AUTO_SELL",
        `A traveling salesmoogle gives you \\[${Num("value")} Credits\\] for it\\.`,
        {
            value: t("number"),
        }
    ),
    CLEAR_BONUS: new EventParser(
        "CLEAR_BONUS",
        `Battle Clear Bonus! \\[\\(?${Words("item")}\\)?\\]`,
        {
            item: t("string"),
        }
    ),
    EXTRA_BONUS: new EventParser(
        "EXTRA_BONUS",
        `Arena Extra Bonus! You obtained ${Num("value")}x \\[${Words("item")}\\]`,
        {
            value: t("number"),
            item: t("string"),
        }
    ),
    TOKEN_BONUS: new EventParser(
        "TOKEN_BONUS",
        `Arena Token Bonus! \\[${Words("item")}\\]`,
        {
            item: t("string"),
        }
    ),
    EVENT_ITEM: new EventParser(
        "EVENT_ITEM",
        `You found a \\[${Words("item")}\\]`,
        {
            item: t("string"),
        }
    ),
    LEVEL_UP: new EventParser(
        "LEVEL_UP",
        `You have reached Level \\\((\d+)\\\)!`,
        {
            level: t("number"),
        }
    ),
    MASTERY_GAIN: new EventParser(
        "MASTERY_GAIN",
        `You gain ${Words("value")} Mastery Point!`,
        {
            value: t("string"),
        }
    ),
    POTENCY_GAIN: new EventParser(
        "POTENCY_GAIN",
        `The equipment's potential has increased by ${Num("value")} points!`,
        {
            value: t("number"),
        }
    ),
    ENCHANT_GAIN: new EventParser(
        "ENCHANT_GAIN",
        `Unlocked innate potential: ${Words("value")}`,
        {
            value: t("string"),
        }
    ),
    DAWN: new EventParser(
        "DAWN",
        `With the light of a new dawn, your experience in all things increases.`,
        {}
    ),
    YGGDRASIL: new EventParser(
        "YGGDRASIL",
        `A shimmering light is pulsating from Yggdrasil...`,
        {}
    ),
    MB_USAGE: new EventParser(
        "MB_USAGE",
        `Used: ${Group("value", ".*")}`,
        {
            value: t("string"),
        }
    ),
    JPX_TURN_DIVIDER: new EventParser("JPX_TURN_DIVIDER", `-+`, {}),
    JPX_ROUND_DIVIDER: new EventParser("JPX_ROUND_DIVIDER", `\\++`, {}),
} as const

export const _ALL_PARSERS = Object.values(PARSERS)

// Run most likely parsers first
const parserFrequency = {
    DEBUFF: 13619,
    E_MISS: 11264,
    P_ATTACK: 10311,
    P_ATTACK_2: 10311,
    SPAWN: 8383,
    MONSTER_DEATH: 8383,
    P_MELEE: 6326,
    P_SKILL: 6326,
    E_BASIC: 5235,
    DROP: 4580,
    EFFECT_RESTORE: 4316,
    COOLDOWN_EXPIRE: 2065,
    SPIRIT_SHIELD: 1274,
    ROUND_START: 1000,
    ROUND_END: 1000,
    EXPERIENCE: 1000,
    CURE_RESTORE: 958,
    E_MISS_2: 851,
    E_MISS_3: 851,
    E_SKILL_MISS: 851,
    E_SKILL_MISS_2: 851,
    P_BUFF: 640,
    RESIST: 558,
    P_ITEM: 465,
    ITEM_RESTORE: 413,
    E_SKILL_SUCCESS: 374,
    DEBUFF_EXPIRE: 125,
    AUTO_SELL: 117,
    DISPEL: 96,
    SPARK_TRIGGER: 81,
    PROFICIENCY: 29,
    E_ABSORB: 26,
    RIDDLE_MASTER: 14,
    RIDDLE_RESTORE: 14,
    GEM: 1,
    CREDITS: 1,
    P_SPIKE_SHIELD: 1,
    EXPLOSION: 1,
} as Record<string, number>

_ALL_PARSERS
    .sort(
        (a, b) =>
            (parserFrequency[a.name] ?? 0) - (parserFrequency[b.name] ?? 0),
    )
    .reverse()

type _P = typeof PARSERS
