import { HvEvent, ParserSchema, t } from "./parserSchema"
import { Result, ValueOf } from "./utils/typeUtils"

export function parseLine(
    line: string
): Result<ValueOf<HvEventMap>, string[]> {
    const errors: string[] = []

    for (const parser of ALL_PARSERS) {
        const [result, err] = parser.parse(line)
        if (result !== null) {
            return [result, null]
        } else if (err) {
            errors.push(err.detail)
        }
    }

    return [null, errors]
}

export class EventParser<
    TSchema extends ParserSchema = any,
    TName extends string = string
> {
    patt: RegExp

    constructor(
        public name: TName,
        raw_patt: string,
        public schema: TSchema
    ) {
        this.patt = new RegExp(raw_patt)

        // @todo: move to test
        // this.groupCount =
        //     new RegExp(this.patt.toString() + "|").exec("")!.length -
        //     1
        // if (this.groupCount !== this.types.length)
        //     throw Error(this.name)
    }

    parse(
        line: string
    ): Result<HvEvent<TSchema, TName> | null, ParseError> {
        const match = this.patt.exec(line)
        if (match === null) {
            return [null, null]
        }

        try {
            const result = Object.entries(this.schema).reduce(
                (ev, [k, term]) => {
                    const d = match.groups?.[k]

                    if (d === undefined) {
                        if (!term.isOptional) {
                            throw new Error(
                                `Schema property ${k} for event ${this.name} was not captured in ${this.patt}. Line ${line}`
                            )
                        }

                        // @ts-ignore
                        ev[k] = d
                    } else {
                        let converter
                        switch (term.type) {
                            case "string":
                                converter = String
                                break
                            case "number":
                                converter = Number
                                break
                            case "boolean":
                                converter = Boolean
                                break
                        }

                        // @ts-ignore
                        ev[k] = converter(d)
                        if (
                            converter === Number &&
                            isNaN(ev[k] as any)
                        ) {
                            throw new Error(
                                `NaN for ${k} in event ${this.name} from raw value ${d}. Source ${this.patt.source}. Line ${line}`
                            )
                        }
                    }

                    return ev
                },
                { event_type: this.name } as HvEvent<TSchema, TName>
            )

            return [result, null]
        } catch (e) {
            return [null, { detail: String(e) }]
        }
    }
}

export interface ParseError {
    detail: string
}

const Group = (name: string, patt: string) => `(?<${name}>${patt})`
const Float = (name: string) => Group(name, "\\d+(?:\\.\\d*)?")
const Mult = (...args: string[]) =>
    Group("multiplier_type", args.join("|"))
const Num = (name: string) => Group(name, "\\d+?")
const Word = (name: string) => Group(name, "[\\w\\s\\-]+")
const Words = (name: string) => Group(name, "[\\w\\s\\- ]+")
const Monster = () => Group("monster", "[\\w\\s\\-+]+") // "New Game +" is a valid monster name

const Resist = "(?: \\((?<resist>d+)% resisted\\))?"
const EnemySpell = `${Monster()} ${Group(
    "spell_verb",
    "casts|uses"
)} ${Words("spell")}`

export const PARSERS = {
    // Actions
    PLAYER_ATTACK: new EventParser(
        "PLAYER_ATTACK",
        `${Words("spell")} ${Mult(
            "hits",
            "crits",
            "blasts"
        )} (?!you)${Monster()} for ${Num("value")} (?:${Word(
            "damage_type"
        )} )?damage\\.?`,
        {
            spell: t("string"),
            multiplier_type: t("string"),
            monster: t("string"),
            damage_type: t("string").optional(),
            value: t("number"),
        }
    ),
    PLAYER_MISS: new EventParser(
        "PLAYER_MISS",
        `${Monster()} ${Mult("parries")} your attack.`,
        {
            monster: t("string"),
            multiplier_type: t("string"),
        }
    ),
    PLAYER_ITEM: new EventParser(
        "PLAYER_ITEM",
        `You use ${Words("item")}\\.`,
        {
            item: t("string"),
        }
    ),
    PLAYER_SKILL: new EventParser(
        "PLAYER_SKILL",
        `You cast ${Words("spell")}\\.`,
        { spell: t("string") }
    ),
    PLAYER_DODGE: new EventParser(
        "PLAYER_DODGE",
        `You ${Mult(
            "evade",
            "parry"
        )} the attack from ${Monster()}\\.`,
        {
            multiplier_type: t("string"),
            monster: t("string"),
        }
    ),

    ENEMY_BASIC: new EventParser(
        "ENEMY_BASIC",
        `${Monster()} ${Mult("hits", "crits")} you for ${Num(
            "value"
        )} ${Word("damage_type")} damage\\.`,
        {
            monster: t("string"),
            multiplier_type: t("string"),
            value: t("number"),
            damage_type: t("string"),
        }
    ),
    ENEMY_SKILL_ABSORB: new EventParser(
        "ENEMY_SKILL_ABSORB",
        `${EnemySpell}, but is ${Mult("absorb")}ed\\. You gain ${Word(
            "mp"
        )} Magic Points.`,
        {
            monster: t("string"),
            spell_verb: t("string"),
            spell: t("string"),
            multiplier_type: t("string"),
            mp: t("number"),
        }
    ),
    ENEMY_SKILL_MISS: new EventParser(
        "ENEMY_SKILL_MISS",
        `${EnemySpell}\\. You ${Mult(
            "evade",
            "parry"
        )} the attack\\.`,
        {
            monster: t("string"),
            spell_verb: t("string"),
            spell: t("string"),
            multiplier_type: t("string"),
        }
    ),
    ENEMY_SKILL_SUCCESS: new EventParser(
        "ENEMY_SKILL_SUCCESS",
        `${EnemySpell}, and ${Mult("hits", "crits")} you for ${Num(
            "value"
        )} ${Word("damage_type")} damage${Resist}\\.?`,
        {
            monster: t("string"),
            spell_verb: t("string"),
            spell: t("string"),
            multiplier_type: t("string"),
            value: t("number"),
            damage_type: t("string"),
            resist: t("number").optional(),
        }
    ),

    // Effects
    PLAYER_BUFF: new EventParser(
        "PLAYER_BUFF",
        `You gain the effect ${Words("effect")}\\.`,
        { effect: t("string") }
    ),
    RIDDLE_RESTORE: new EventParser(
        "RIDDLE_RESTORE",
        `Time Bonus: Recovered ${Num("hp")} HP, ${Num(
            "mp"
        )} MP and ${Num("sp")} SP\\.`,
        {
            hp: t("number"),
            mp: t("number"),
            sp: t("number"),
        }
    ),
    EFFECT_RESTORE: new EventParser(
        "EFFECT_RESTORE",
        `${Words("effect")} restores ${Num("value")} points of ${Word(
            "type"
        )}\\.`,
        {
            effect: t("string"),
            value: t("number"),
            type: t("string"),
        }
    ),
    ITEM_RESTORE: new EventParser(
        "ITEM_RESTORE",
        `Recovered ${Num("value")} points of ${Word("type")}\\.`,
        { value: t("number"), type: t("string") }
    ),
    CURE_RESTORE: new EventParser(
        "CURE_RESTORE",
        `You are healed for ${Num("value")} Health Points\\.`,
        {
            value: t("number"),
        }
    ),

    SPIRIT_SHIELD: new EventParser(
        "SPIRIT_SHIELD",
        `Your spirit shield absorbs ${Num(
            "damage"
        )} points of damage from the attack into ${Num(
            "spirit_damage"
        )} points of spirit damage\\.`,
        {
            damage: t("number"),
            spirit_damage: t("number"),
        }
    ),
    SPARK_TRIGGER: new EventParser(
        "SPARK_TRIGGER",
        `Your Spark of Life restores you from the brink of defeat\\.`,
        {}
    ),
    DISPEL: new EventParser(
        "DISPEL",
        `The effect ${Words("effect")} was dispelled\\.`,
        {
            effect: t("string"),
        }
    ),
    COOLDOWN_EXPIRE: new EventParser(
        "COOLDOWN_EXPIRE",
        `Cooldown expired for ${Words("spell")}`,
        {
            spell: t("string"),
        }
    ),
    BUFF_EXPIRE: new EventParser(
        "DEBUFF_EXPIRE",
        `The effect ${Words("effect")} has expired\\.`,
        {
            effect: t("string"),
        }
    ),
    RESIST: new EventParser(
        "RESIST",
        `${Monster()} resists your spell\\.`,
        {
            monster: t("string"),
        }
    ),
    DEBUFF: new EventParser(
        "DEBUFF",
        `${Monster()} gains the effect ${Words("name")}\\.`,
        {
            monster: t("string"),
            name: t("string"),
        }
    ),
    DEBUFF_EXPIRE: new EventParser(
        "DEBUFF_EXPIRE",
        `The effect ${Words(
            "effect"
        )} on ${Monster()} has expired\\.`,
        {
            effect: t("string"),
            monster: t("string"),
        }
    ),

    // Info
    ROUND_START: new EventParser(
        "ROUND_START",
        `Initializing ${Group(
            "battle_type",
            "[\\w\\s\\d#]+"
        )} \\\(Round ${Num("current")} / ${Num("max")}\\\) \\.\\.\\.`,
        {
            battle_type: t("string"),
            current: t("number"),
            max: t("number"),
        }
    ),
    ROUND_END: new EventParser(
        "ROUND_END",
        `You are Victorious!`,
        {}
    ),
    FLEE: new EventParser(
        "FLEE",
        "You have escaped from the battle\\.",
        {}
    ),
    SPAWN: new EventParser(
        "SPAWN",
        `Spawned Monster ${Group("letter", "[A-Z]")}: MID=${Num(
            "mid"
        )} \\\(${Monster()}\\\) LV=${Num("level")} HP=${Num("hp")}`,
        {
            letter: t("string"),
            mid: t("number"),
            monster: t("string"),
            level: t("number"),
            hp: t("number"),
        }
    ),
    DEATH: new EventParser(
        "DEATH",
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
        `A traveling salesmoogle salvages it into ${Num(
            "value"
        )}x \\[${Words("item")}\\]`,
        {
            value: t("number"),
            item: t("string"),
        }
    ),
    AUTO_SELL: new EventParser(
        "AUTO_SELL",
        `A traveling salesmoogle gives you \\[${Num(
            "value"
        )} Credits\\] for it\\.`,
        {
            value: t("number"),
        }
    ),
    CLEAR_BONUS: new EventParser(
        "CLEAR_BONUS",
        `Battle Clear Bonus! \\[${Words("item")}\\]`,
        {
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

    MB_USAGE: new EventParser(
        "MB_USAGE",
        `Used: ${Group("value", ".*")}`,
        {
            value: t("string"),
        }
    ),
} as const

export const ALL_PARSERS = Object.values(PARSERS)

// Run most likely parsers first
const parserFrequency = {
    DEBUFF: 13619,
    PLAYER_DODGE: 11264,
    PLAYER_ATTACK: 10311,
    SPAWN: 8383,
    DEATH: 8383,
    PLAYER_SKILL: 6326,
    ENEMY_BASIC: 5235,
    DROP: 4580,
    EFFECT_RESTORE: 4316,
    COOLDOWN_EXPIRE: 2065,
    SPIRIT_SHIELD: 1274,
    ROUND_START: 1000,
    ROUND_END: 1000,
    EXPERIENCE: 1000,
    CURE_RESTORE: 958,
    ENEMY_SKILL_MISS: 851,
    PLAYER_BUFF: 640,
    RESIST: 558,
    PLAYER_ITEM: 465,
    ITEM_RESTORE: 413,
    ENEMY_SKILL_SUCCESS: 374,
    DEBUFF_EXPIRE: 125,
    AUTO_SELL: 117,
    DISPEL: 96,
    SPARK_TRIGGER: 81,
    PROFICIENCY: 29,
    ENEMY_SKILL_ABSORB: 26,
    RIDDLE_MASTER: 14,
    RIDDLE_RESTORE: 14,
    GEM: 1,
    CREDITS: 1,
} as Record<string, number>

ALL_PARSERS.sort(
    (a, b) =>
        (parserFrequency[a.name] ?? 0) -
        (parserFrequency[b.name] ?? 0)
).reverse()

type _P = typeof PARSERS
export type HvEventMap = {
    [K in keyof _P]: HvEvent<_P[K]["schema"], _P[K]["name"]>
}
