import { findNext, last, sort, zip } from "myutils"
import { EventGrammar, filterEvents, takeEvents } from "../eventGrammar"
import { CompleteLog } from "../logDb/schema"
import { summarizeItemDrops } from "../stats/dropStats"
import { summarizeItemUsage } from "../stats/itemUsageStats"
import { MetaSummary, parseBattleType } from "../stats/metaStats"
import {
    BUBBLE_VASE,
    CONSUMABLES,
    DEBUG,
    HEALTH_ITEMS,
    MANA_ITEMS,
    MATERIALS,
    SCROLLS,
    SHARDS,
    SPIRIT_ITEMS,
    TROPHIES,
} from "../ui/constants"
import { InferCollectionType } from "myutils"
import { _ALL_PARSERS, v91 as parsers } from "./_parsers"
import { _summarizeCombatUsage } from "./_summarizeCombatUsage"

export const v91 = {
    ALL_PARSERS: _ALL_PARSERS,
    summarize: (log: CompleteLog<parsers.HvEvent>) => {
        const partition = partitionLog(log)

        const meta = _summarizeMeta(log, partition)

        const { hasDupeError, ...combat } = _summarizeCombatUsage(
            log,
            partition,
        )
        meta.errors.dupes ||= hasDupeError

        return {
            meta,
            drops: _summarizeItemDrops(log),
            usage: summarizeItemUsage(
                log,
                (ev) =>
                    ev.event_type === "P_ITEM_OR_SKILL"
                        ? [{ key: ev.name, count: 1 }]
                        : [],
                {
                    "Gum & Vase": BUBBLE_VASE,
                    Scrolls: SCROLLS,
                    "Health Items": HEALTH_ITEMS,
                    "Mana Items": MANA_ITEMS,
                    "Spirit Items": SPIRIT_ITEMS,
                    "Last Elixir": new Set(["Last Elixir"]),
                },
            ),
            combat,
        }
    },
}

function _summarizeMeta(
    log: CompleteLog<parsers.HvEvent>,
    partition: v91.LogPartition,
): MetaSummary {
    const completionType = getCompletionType()
    const {
        battleType,
        errors: battleTypeErrors,
        round,
    } = getBattleType(completionType)

    return {
        completionType,
        battleType,
        round,
        roundIndices: getRoundIndices(),
        turnIndices: getTurnIndices(),
        eventCount: log.entries.length,
        enchants: [],
        errors: {
            ...battleTypeErrors,
            dupes: false,
            parsing: log.entries.some((x) => x.type === "error"),
        },
    }

    function getBattleType(completionType: MetaSummary["completionType"]) {
        const starts = filterEvents(log.entries, ["ROUND_START"])
        const ends = filterEvents(log.entries, ["ROUND_END"])

        const battleType = starts[0]?.battle_type
            ? parseBattleType(starts[0].battle_type)
            : null

        let roundMax = starts[0]?.max ? starts[0].max : null

        const roundEnds = starts
            .map((ev) => ev.current)
            .filter((x) => x !== null)
        let roundEnd = roundEnds.length ? Math.max(...roundEnds) : null

        const inconsistentBattleTypes = starts
            .slice(1)
            .some((ev) => ev.battle_type !== starts[0].battle_type)

        return {
            battleType,
            round:
                roundMax && roundEnd
                    ? {
                          max: roundMax,
                          end: roundEnd,
                      }
                    : null,
            errors: {
                inconsistentBattleTypes,
                missingStart:
                    starts.length === 0 || starts.length < ends.length,
                missingEnd: completionType
                    ? completionType === "finish"
                        ? ends.length === starts.length
                        : ends.length === starts.length - 1
                    : false,
            },
        }
    }

    function getTurnIndices() {
        return sort(
            (
                [
                    "cast",
                    "item",
                    "attack",
                    "skill",
                    "stance",
                    "skillError",
                    // "unknown",
                    // "start",
                    // "end",
                    // "enemy",
                    // "hit",
                ] as const
            ).flatMap((key) => partition[key].map((seq) => seq[0].logIdx)),
            (x) => x,
        )
    }

    function getRoundIndices() {
        return partition.start
            .map((seq) => ({
                logIdx: seq[0].logIdx,
                roundIdx: seq[0].event.current ?? 1,
            }))
            .reduce(
                (acc, x) => {
                    acc[x.roundIdx] = x.logIdx
                    return acc
                },
                {} as Record<number, number>,
            )
    }

    function getCompletionType(): MetaSummary["completionType"] {
        const evs = filterEvents(log.entries, null)

        // Find ROUND_END
        const endMarkers = new Set(["ROUND_END", "DEFEAT", "FLEE"] as const)

        // prettier-ignore
        const cond =
            (ev: parsers.HvEvent): ev is parsers.HvEventMap[InferCollectionType<typeof endMarkers>] =>
                endMarkers.has(ev.event_type as any)

        const [end, _] = findNext(evs, cond, {
            reverse: true,
            breakOn: (ev) => ev.event_type === "ROUND_START",
        })

        switch (end?.event_type) {
            case "ROUND_END":
                return "finish"
            case "FLEE":
                return "flee"
            case "DEFEAT":
                return "die"
            default:
                return null
        }
    }
}

function _summarizeItemDrops(log: CompleteLog<parsers.HvEvent>) {
    return summarizeItemDrops(
        log,
        (ev: parsers.HvEvent) => {
            switch (ev.event_type) {
                case "AUTO_SALVAGE": {
                    const xs = [
                        {
                            key: ev.item,
                            count: ev.value,
                            isEquip: false,
                        } as const,
                    ]
                    xs.push({
                        key: "Credits",
                        count: ev.credits,
                        isEquip: false,
                    } as const)

                    if (ev.item2 && ev.value2) {
                        xs.push({
                            key: ev.item2,
                            count: ev.value2,
                            isEquip: false,
                        } as const)
                    }
                    return xs
                }
                case "AUTO_SELL": {
                    return [
                        {
                            key: "autosell",
                            priceKey: "Credits",
                            count: ev.value,
                            isEquip: false,
                        },
                    ]
                }
                case "CLEAR_BONUS": {
                    return [
                        {
                            key: ev.item,
                            count: 1,
                            isEquip: true,
                        },
                    ]
                }
                case "EXTRA_BONUS": {
                    return [
                        {
                            key: ev.item,
                            count: ev.value,
                            isEquip: true,
                        },
                    ]
                }
                case "CREDITS": {
                    return [
                        {
                            key: "Credits",
                            count: 1,
                            isEquip: false,
                        },
                    ]
                }
                case "DROP_EVENT": {
                    const item = extractNameCount(ev.item)
                    if (item) {
                        return [
                            {
                                key: item[0],
                                count: item[1],
                                isEquip: false,
                            },
                        ]
                    } else {
                        return [
                            {
                                key: ev.item,
                                count: 1,
                                isEquip: true,
                            },
                        ]
                    }
                }
                case "DROP": {
                    const item = extractNameCount(ev.item)
                    if (item) {
                        return [
                            {
                                key: item[0],
                                count: item[1],
                                isEquip: false,
                            },
                        ]
                    } else {
                        return [
                            {
                                key: ev.item,
                                count: 1,
                                isEquip: true,
                            },
                        ]
                    }
                }
                case "EVENT_ITEM": {
                    const [name, count] = extractNameCount(ev.item)!
                    return [
                        {
                            key: name,
                            count,
                            isEquip: false,
                        },
                    ]
                }
                case "EXPERIENCE": {
                    return [
                        {
                            key: "experience",
                            count: ev.value,
                            isEquip: false,
                        },
                    ]
                }
                case "PROFICIENCY": {
                    return [
                        {
                            key: "proficiency",
                            count: ev.value,
                            isEquip: false,
                        },
                    ]
                }
                case "SOUL_FRAG_DROP": {
                    return [
                        {
                            key: "Soul Fragment",
                            count: ev.count,
                            isEquip: false,
                        },
                    ]
                }
                case "TOKEN_BONUS": {
                    return [
                        {
                            key: ev.item,
                            count: 1,
                            isEquip: false,
                        },
                    ]
                }
                default:
                    return []
            }

            function extractNameCount(text: string) {
                let name, count

                const m = text.match(/(\d+)x? (.*)/)
                if (m) {
                    count = parseInt(m[1])
                    name = m[2]
                    return [name, count] as const
                } else {
                    return null
                }
            }
        },
        {
            Artifacts: new Set(["Precursor Artifact"]),
            Credits: new Set(["credits", "Credits", "autosell"]),
            Consumables: CONSUMABLES,
            Materials: MATERIALS,
            Shards: SHARDS,
            Trophies: TROPHIES,
            Crystals: (x) => x.name.startsWith("Crystal of "),
            Figurine: (x) => x.name.includes("Figurine"),
            Equips: (x) => x.isEquip,
        },
    )
}

function partitionLog(log: CompleteLog<parsers.HvEvent>): v91.LogPartition {
    const actionKeys = [
        "cast",
        "item",
        "attack",
        "skill",
        "stance",
        "skillError",
        // "start",
        // "end",
        // "enemy",
        // "hit",
    ] as const

    const partition = actionKeys.reduce(
        (acc, k) => {
            // @ts-ignore
            acc[k] = []
            return acc
        },
        {
            start: [],
            end: [],
            flee: [],
            unknown: [],
            other: [],
        } as any as v91.LogPartition,
    )

    let parseTimes = (DEBUG ? {} : null) as any
    const pushSequencedEvents = (
        actionKey: keyof v91.LogPartition,
        logIdx: number,
        rootRef: any,
    ) => {
        let start, end
        if (parseTimes) start = performance.now()

        const result = takeEvents(ACTION_GRAMMAR, log.entries, logIdx, rootRef)
        if (!result[0]) {
            return null
        }

        let seq = zip(...result).map(([event, logIdx]) => ({
            event: event as any,
            logIdx,
        })) as v91.PartitionSequence<any, any>

        // Cant distinguish between domino procs and rapid attacks (attacks not separated by monster actions / effects)
        // The only tell (afaik) is that domino procs dont trigger Strikes
        // But grammar doesnt support lookaheads so have to hack something in here
        // This doesnt even handle the pathological case of successive one-hit kills because if main hit kills, theres no strike
        if (actionKey === "attack") {
            const firstAttackIdx = seq.findIndex(
                (x) => x.event.event_type === "P_ATTACK",
            )

            let cutIdx = null as number | null
            for (let idx = firstAttackIdx + 2; idx < seq.length; idx++) {
                const prev = seq[idx - 1].event
                if (prev.event_type !== "P_ATTACK") {
                    continue
                }

                const curr = seq[idx].event
                if (curr.event_type !== "P_NAMED_HIT") {
                    continue
                }

                cutIdx = idx - 1
                break
            }

            if (cutIdx !== null) {
                seq = seq.slice(0, cutIdx) as any
            }
        }

        {
            // Also can't distinguish between debuff proc'd by cast and one proc'd by attack
            // (Because debuffs for attack occur before the actual hit lol)
            const lastEvent = last(seq)!
            const nextSeqStart = log.entries[lastEvent.logIdx + 1]
            const nextSeqStartEvent =
                nextSeqStart?.type === "event" ? nextSeqStart.event : null
            if (
                lastEvent.event.event_type === "P_DEBUFF_HIT" &&
                new Set(["P_ATTACK"]).has(nextSeqStartEvent?.event_type ?? "")
            ) {
                seq = seq.slice(0, seq.length - 1) as any
            }
        }

        if (parseTimes) {
            end = performance.now()
            parseTimes[actionKey] = parseTimes[actionKey] ?? { t: 0, n: 0 }
            parseTimes[actionKey].t += end - start!
            parseTimes[actionKey].n += 1
        }

        //  @ts-ignore
        partition[actionKey].push(seq)
        return seq
    }

    let prevSeq: any = null
    for (let logIdx = 0; logIdx < log.entries.length; logIdx += 1) {
        let seq = null
        let _ = null
        let seqAction = null
        for (let actionKey of actionKeys) {
            seq = pushSequencedEvents(actionKey, logIdx, [
                { refs: [actionKey] },
                { refs: ["enemy"] },
            ])
            if (seq) {
                seqAction = actionKey
                break
            }
        }

        if (!seq) {
            seq = pushSequencedEvents("start", logIdx, [{ refs: ["start"] }])
        }
        if (!seq) {
            seq = pushSequencedEvents("end", logIdx, [{ refs: ["end"] }])
        }
        if (!seq) {
            seq = pushSequencedEvents("flee", logIdx, [{ refs: ["flee"] }])
        }

        if (seq) {
            logIdx = last(seq)!.logIdx
        }

        const x = log.entries[logIdx]
        if (!seq && x.type === "event") {
            const pp = (xs: any[]) => (xs ? xs.map((x) => x.event) : null)
            console.debug(
                logIdx,
                // @ts-ignore
                log.entries[logIdx].event,
                pp(prevSeq),
                pp(log.entries.slice(logIdx, logIdx + 30)),
            )
            partition["unknown"].push([
                {
                    logIdx,
                    event: x.event,
                },
            ])
        }

        prevSeq = seq
    }

    if (partition.unknown.length > 0) {
        console.warn("Unknowns in log partition", partition)
    }

    const errors = log.entries.flatMap((x, logIdx) =>
        x.type === "error" ? [{ logIdx, ...x }] : [],
    )
    if (errors.length > 0) {
        console.error("Parser errors", errors)
    }

    if (parseTimes) {
        for (const [k, x] of Object.entries(parseTimes)) {
            console.debug(
                // @ts-ignore
                `Partitioned ${k} in ${Math.round(10 * (x.t / x.n)) / 10}ms (${x.n})`,
            )
        }
    }

    return partition
}

type TEvent = parsers.HvEvent["event_type"]

type AG = typeof ACTION_GRAMMAR
type AGKeys<
    TKey extends keyof AG = keyof AG,
    TIdx extends number = 0,
> = AG[TKey][TIdx]["keys"][number]
type P_HIT = AGKeys<"hit">

export namespace v91 {
    export type PartitionEntry<T extends TEvent = TEvent> = {
        event: parsers.HvEvent & { event_type: T }
        logIdx: number
    }

    export type PartitionSequence<
        TRoot extends TEvent = TEvent,
        TEffect extends TEvent = TEvent,
    > = [PartitionEntry<TRoot>, ...PartitionEntry<TEffect | AGKeys<"enemy">>[]]

    export type LogPartition = {
        cast: Array<
            PartitionSequence<AGKeys<"cast", 0>, AGKeys<"cast", 1> | P_HIT>
        >
        attack: Array<
            PartitionSequence<
                AGKeys<"attack", 0> | AGKeys<"attack", 1>,
                AGKeys<"attack", 2> | AGKeys<"attack", 3> | P_HIT
            >
        >
        skill: Array<
            PartitionSequence<AGKeys<"skill", 0>, AGKeys<"skill", 1> | P_HIT>
        >
        stance: Array<PartitionSequence<AGKeys<"stance", 0>, never>>
        item: Array<PartitionSequence<AGKeys<"item", 0>, AGKeys<"item", 1>>>
        start: Array<PartitionSequence<AGKeys<"start", 0>, AGKeys<"start", 1>>>
        end: Array<PartitionSequence<AGKeys<"end", 0>, AGKeys<"end", 1>>>
        flee: Array<PartitionSequence<AGKeys<"flee", 0>, AGKeys<"flee", 1>>>
        skillError: Array<PartitionSequence<AGKeys<"skillError", 0>, never>>
        unknown: PartitionEntry[][]
    }
    export type LogPartitionEntry<T extends string> = {
        event: parsers.HvEvent & { event_type: T }
        logIdx: number
    }
}

const ACTION_GRAMMAR = {
    cast: [
        { keys: ["P_CAST"] },
        {
            refs: ["hit"],
            keys: [
                "P_SPELL_MISS",
                "P_SPELL_RESIST",
                "P_ABSORB",
                "P_BUFF_EFFECT",
                "P_EXPLOSION",
                "P_CURE_RESTORE",
                "P_NAMED_HIT",
                "P_NAMED_HIT_2",
            ],
            repeat: {
                min: 1,
                max: 50,
            },
        },
    ],
    attack: [
        // Melee debuffs can show up just before the actual hit
        {
            keys: ["P_DEBUFF_HIT"],
            repeat: {
                min: 0,
                max: 3,
            },
        },
        {
            keys: ["P_ATTACK", "P_MELEE_PARRY", "P_MELEE_MISS"],
        },
        {
            refs: ["hit"],
            keys: [
                "P_ATTACK",
                "P_MELEE_PARRY",
                "P_MELEE_MISS",
                // "P_NAMED_HIT_2",
            ],
            repeat: {
                min: 0,
                max: 50,
            },
        },
        {
            keys: ["P_NAMED_HIT", "P_OFFHAND"],
            repeat: {
                min: 0,
                max: 50,
            },
        },
    ],
    skill: [
        {
            keys: ["P_ITEM_OR_SKILL"],
        },
        {
            refs: ["hit"],
            // @todo: what does absorb look like for skills?
            keys: ["P_ABSORB", "P_MERCY"],
            repeat: {
                min: 0,
                max: 50,
            },
        },
    ],
    stance: [
        {
            keys: ["P_STANCE_START"],
        },
    ],
    item: [
        {
            keys: ["P_ITEM_OR_SKILL"],
        },
        {
            keys: ["P_BUFF_EFFECT", "P_ITEM_RESTORE", "DISPEL"],
            repeat: {
                min: 1,
                max: 50,
            },
        },
    ],
    hit: [
        {
            keys: [
                "P_HIT",
                "P_DEBUFF_HIT",
                "P_DEBUFF_RESIST",
                // "P_DEBUFF_MISS",
                "MONSTER_DEATH",
                "GEM",
                // Channeling
                "P_BUFF_EFFECT",
            ],
        },
    ],
    enemy: [
        {
            keys: [
                "P_COUNTER",
                "P_SPIKE_SHIELD",
                "SPIRIT_SHIELD",
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
                "MONSTER_DEATH",
                "GEM",
                // Spike shields can debuff
                "P_DEBUFF_HIT",
                // Spark + Cloak of the Fallen buff
                "SPARK_TRIGGER",
                "P_BUFF_EFFECT",
            ],
            repeat: {
                min: 0,
                max: 50,
            },
        },
        {
            keys: [
                "EFFECT_RESTORE",
                "EFFECT_EXPIRE",
                "P_STANCE_END",
                "P_CD_EXPIRE",
                // Status effects cause damage outside of enemy attack phase
                // Ripened Soul hits Emerald Giant for 14646 damage.
                "P_NAMED_HIT_2",
                "P_DRAIN",
                "MONSTER_DEATH",
                "GEM",
            ],
            repeat: {
                min: 0,
                max: 50,
            },
        },
    ],
    start: [
        {
            keys: ["ROUND_START"],
        },
        {
            keys: [
                "SPAWN",
                "RIDDLE_MASTER",
                "RIDDLE_RESTORE",
                "P_BUFF_EFFECT",
                "P_STANCE_END",
            ],
            repeat: {
                min: 1,
                max: 50,
            },
        },
    ],
    end: [
        {
            keys: ["ROUND_END"],
        },
        {
            keys: [
                "CREDITS",
                "DROP",
                "DROP_EVENT",
                "SOUL_FRAG_DROP",
                "PROFICIENCY",
                "EXPERIENCE",
                "AUTO_SALVAGE",
                "AUTO_SELL",
                "CLEAR_BONUS",
                "EXTRA_BONUS",
                "TOKEN_BONUS",
                "EVENT_ITEM",
                "LEVEL_UP",
                "MASTERY_GAIN",
                "POTENCY_GAIN",
                "ENCHANT_GAIN",
                "MB_USAGE",
                "JPX_TURN_DIVIDER",
                "JPX_ROUND_DIVIDER",
                "DEFEAT",
            ],
            repeat: {
                min: 1,
                max: 50,
            },
        },
    ],
    skillError: [
        { keys: ["SKILL_FAIL", "STANCE_FAIL"], repeat: { min: 0, max: 10 } },
    ],
    flee: [
        {
            keys: ["P_BUFF_EFFECT"],
        },
        {
            keys: ["FLEE"],
        },
    ],
} as const satisfies EventGrammar<parsers.HvEvent["event_type"]>
