import { sort, ValueOf } from "myutils"
import { BaseHvEvent, EventParser, t } from "../eventParser"

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
    P_ABSORB: new EventParser(
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
    // Dark Strike hits Tryuu, causing 822 additional points of Dark damage.
    P_NAMED_HIT: new EventParser(
        "P_NAMED_HIT",
        `${Words("name")} ${CritMult()}${Mult("hits", "crits", "glances")} (?!you)${Monster()}, (?:${Group("partial_parry", "which partially parries, ")})?causing ${Num("value")} (?:additional )?points of (?:${Word("damage_type")} )?damage\\.`,
        {
            name: t("string"),
            crit_mult: t("number").optional(),
            multiplier_type: t("string"),
            monster: t("string"),
            partial_parry: t("boolean").optional(),
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
    // Your offhand attack glances Luminous Giant, which parries, causing 1 points of Void damage.
    P_OFFHAND: new EventParser(
        "P_OFFHAND",
        `Your offhand attack ${CritMult()}${Mult("glances", "hits", "crits")} ${Monster()}, (?:${Group("partial_parry", "which partially parries, ")})?(?:${Group("parry", "which parries, ")})?causing ${Num("value")} points of ${Word("damage_type")} damage\\.`,
        {
            crit_mult: t("number").optional(),
            multiplier_type: t('string'),
            monster: t("string"),
            partial_parry: t("boolean").optional(),
            parry: t("boolean").optional(),
            value: t("number"),
            damage_type: t("string"),
        }
    ),
    P_OFFHAND_MISS: new EventParser(
        "P_OFFHAND_MISS",
        `${Monster()} evades your offhand attack\\.`,
        {
            monster: t("string"),
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
    // This is separate from P_NAMED_HIT to help our jank ass parser
    // (specifically because staff attacks arent preceded by P_ATTACK)
    // Arcane Blow glances Ikuta Minami, which partially parries, causing 1246 points of Crushing damage
    // Arcane Blow glances Tryuu, causing 2879 points of Crushing damage.
    P_ARCANE_BLOW: new EventParser(
        "P_ARCANE_BLOW",
        `Arcane Blow ${CritMult()}${Mult("hits", "crits", "glances")} ${Monster()}, (?:${Group("parry", "which partially parries, ")})?causing ${Num("value")} (?:additional )?points of (?:${Word("damage_type")} )?damage\\.`,
        {
            crit_mult: t("number").optional(),
            multiplier_type: t("string"),
            monster: t("string"),
            partial_parry: t("boolean").optional(),
            value: t("number"),
            damage_type: t("string").optional(),
        }
    ),
    // Same deal as arcane blow
    P_DEFEND: new EventParser(
        "P_DEFEND",
        `You gain the effect Defending\\.`,
        {}
    ),
    // Scanning Peerlesssss2 Leather... HP: 228843 / 229060 MP: 19% SP: 22%
    SCAN_1: new EventParser(
        "SCAN_1",
        `Scanning ${Monster()}... HP: ${Num("hp_min")} / ${Num("hp_max")} MP: ${Num("mp_perc")}% SP: ${Num("sp_perc")}%`,
        {
            monster: t("string"),
            hp_min: t("number"),
            hp_max: t("number"),
            mp_perc: t("number"),
            sp_perc: t("number"),
        }
    ),
    SCAN_2: new EventParser(
        "SCAN_2",
        `Monster Trainer:`,
        {}
    ),
    // sssss2
    SCAN_3: new EventParser(
        "SCAN_3",
        `placeholder_for_trainer`,
        { trainer: t("string").optional() }
    ),
    SCAN_4: new EventParser(
        "SCAN_4",
        `Monster Class:`,
        {}
    ),
    // Dragonkin, Power Level 2250
    SCAN_5: new EventParser(
        "SCAN_5",
        `${Words("class")}, Power Level ${Num("pl")}`,
        {
            class: t("string"),
            pl: t("number"),
        }
    ),
    SCAN_6: new EventParser(
        "SCAN_6",
        `Melee Attack:`,
        {
        }
    ),
    // Piercing; Accuracy 339.0 (30.9% hit chance against player)
    SCAN_7: new EventParser(
        "SCAN_7",
        `${Words("type")}; Accuracy ${Float("accuracy")} \\(${Float("hit_chance")}% hit chance against player\\)`,
        {
            type: t("string"),
            accuracy: t("number"),
            hit_chance: t("number"),
        }
    ),
    SCAN_8: new EventParser(
        "SCAN_8",
        `Avoidance:`,
        {}
    ),
    // Evade 934.0 (29.6% base chance vs player attack, 12.9% base chance vs player magic)
    SCAN_9: new EventParser(
        "SCAN_9",
        `Evade ${Float("evade")} \\(${Float("phys_chance")}% base chance vs player attack, ${Float("magic_chance")}% base chance vs player magic\\)`,
        {
            evade: t("number"),
            phys_chance: t("number"),
            magic_chance: t("number"),
        }
    ),
    SCAN_10: new EventParser(
        "SCAN_10",
        `Intercept:`,
        {}
    ),
    // Parry 1250 (39.9% base chance vs player attack) Resist 1250 (8.6% base chance vs player magic)
    SCAN_11: new EventParser(
        "SCAN_11",
        `Parry ${Float("parry")} \\(${Float("phys_chance")}% base chance vs player attack\\) Resist ${Float("resist")} \\(${Float("magic_chance")}% base chance vs player magic\\)`,
        {
            parry: t("number"),
            phys_chance: t("number"),
            resist: t("number"),
            magic_chance: t("number"),
        }
    ),
    SCAN_12: new EventParser(
        "SCAN_12",
        `Resists:`,
        {}
    ),
    // Fire:+35%Cold:+0%Elec:+35%Wind:+10%Holy:+62%Dark:+37%Crushing:+25%Slashing:+25%Piercing:+0%
    SCAN_13: new EventParser(
        "SCAN_13",
        `Fire:\\+${Float("fire")}%Cold:\\+${Float("cold")}%Elec:\\+${Float("elec")}%Wind:\\+${Float("wind")}%Holy:\\+${Float("holy")}%Dark:\\+${Float("dark")}%Crushing:\\+${Float("crushing")}%Slashing:\\+${Float("slashing")}%Piercing:\\+${Float("piercing")}%`,
        {
            fire: t("number"),
            cold: t("number"),
            elec: t("number"),
            wind: t("number"),
            holy: t("number"),
            dark: t("number"),
            crushing: t("number"),
            slashing: t("number"),
            piercing: t("number"),
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
    YGGDRASIL: new EventParser(
        "YGGDRASIL",
        `A shimmering light is pulsating from Yggdrasil...`,
        {}
    ),
    // Yggdrasil casts Healing Roots, healing Real Life for 12 points of health.
    YGGDRASIL_HEAL: new EventParser(
        "YGGDRASIL_HEAL",
        `Yggdrasil casts Healing Roots, healing ${Monster()} for ${Num('value')} points of health.`,
        {
            monster: t('string'),
            value: t('number')
        }
    ),
    // Verdandi gains the effect Absorbing Ward.
    YGGDRASIL_BUFF: new EventParser(
        "YGGDRASIL_BUFF",
        `${Monster()} gains the effect Absorbing Ward\\.`,
        {
            monster: t("string"),
        }
    ),
    YGGDRASIL_BUFF_2: new EventParser(
        "YGGDRASIL_BUFF_2",
        `${Monster()} gains the effect Fury of the Sisters\\.`,
        {
            monster: t("string"),
        }
    ),
    YGGDRASIL_BUFF_3: new EventParser(
        "YGGDRASIL_BUFF_3",
        `${Monster()} gains the effect Lamentations of the Future\\.`,
        {
            monster: t("string"),
        }
    ),
    YGGDRASIL_BUFF_4: new EventParser(
        "YGGDRASIL_BUFF_4",
        `${Monster()} gains the effect Wails of the Present\\.`,
        {
            monster: t("string"),
        }
    ),
    YGGDRASIL_BUFF_5: new EventParser(
        "YGGDRASIL_BUFF_5",
        `${Monster()} gains the effect Screams of the Past\\.`,
        {
            monster: t("string"),
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
    SPARK_FAIL: new EventParser(
        "SPARK_FAIL",
        `Spark of Life fails due to insufficient Spirit!`,
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
        {}
    ),
    CAST_FAIL: new EventParser(
        "CAST_FAIL",
        `Cooldown is still pending for (${Words('spell')}).`,
        {
            spell: t('string')
        }
    ),
    ITEM_FAIL: new EventParser(
        "ITEM_FAIL",
        `Slot is currently not usable.`,
        {}
    ),
    ATTACK_FAIL: new EventParser(
        "ATTACK_FAIL",
        `Stop beating dead ponies.`,
        {}
    ),
    ATTACK_FAIL_2: new EventParser(
        "ATTACK_FAIL_2",
        `Stop kicking the dead horse.`,
        {}
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
    REPAIR: new EventParser(
        "REPAIR",
        `Your ${Words("equip")} is low on energy, and should be repaired soon.`,
        {
            equip: t("string")
        }
    ),
    REPAIR_2: new EventParser(
        "REPAIR_2",
        `Your ${Words('equip')} is damaged, and should be repaired soon.`,
        {
            equip: t("string")
        }
    ),
    // The Juggernaut Charm) on your Legendary Radiant Phase Cap of Heimdall is wearing out, and should be replaced.
    CHARM_WEAR: new EventParser(
        "CHARM_WEAR",
        `The ${Words("charm")} Charm\\)? on your ${Words("equip")} is wearing out, and should be replaced.`,
        {
            charm: t("string"),
            equip: t("string")
        }
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

// ~~Run most likely parsers first~~
// Override run order
const parserFrequency = {
    P_NAMED_HIT: -1,
    ARCANE_BLOW: 99,
    P_OFFHAND: 99,

    P_DEBUFF_HIT: -1,
    YGGDRASIL_BUFF: 99,
    YGGDRASIL_BUFF_2: 99,
    YGGDRASIL_BUFF_3: 99,
    YGGDRASIL_BUFF_4: 99,
    YGGDRASIL_BUFF_5: 99,

    P_BUFF_EFFECT: -1,
    P_DEFEND: 99,
} as Record<string, number>
export const _ALL_PARSERS = sort(
    Object.values(PARSERS),
    (p) => parserFrequency[p.name] ?? 0,
    true,
)

type _P = typeof PARSERS
