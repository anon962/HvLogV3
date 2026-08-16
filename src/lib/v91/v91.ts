import {
    findNext,
    InferCollectionType,
    L,
    last,
    range,
    sort,
    zip,
} from "myutils"
import { LogEntries, LogEntry } from "../db/dbN"
import { summarizeItemDrops } from "../stats/dropStats"
import { summarizeItemUsage } from "../stats/itemUsageStats"
import { MetaSummary, parseBattleType } from "../stats/metaStats"
import { DetailsSummary, MonsterSummary } from "../stats/summary"
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
} from "../constants"
import { EventGrammar, filterEvents, takeEvents } from "../utils/eventGrammar"
import { _ALL_PARSERS, v91N } from "./_parsers"
import { _summarizeCombat } from "./_summarizeCombat"
import { _summarizeMonsters } from "./_summarizeMonsters"

export const v91 = {
    ALL_PARSERS: _ALL_PARSERS,
    summarizeDetails: (entries: LogEntries<v91N.HvEvent>): DetailsSummary => {
        entries = _parseScans(entries)

        const partition = partitionLog(entries)

        const meta = _summarizeMeta(entries, partition)

        const { hasDupeError, ...combat } = _summarizeCombat(entries, partition)
        meta.errors.dupes ||= hasDupeError
        meta.errors.unknownSequence ||= partition.unknown.length > 0

        const details = {
            meta,
            drops: _summarizeItemDrops(entries),
            usage: summarizeItemUsage(
                entries,
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

        return details
    },
    summarizeMonsters: (entries: LogEntries<v91N.HvEvent>): MonsterSummary => {
        const partition = partitionLog(entries)
        const monsters = _summarizeMonsters(entries, partition)
        return monsters
    },
}

function _summarizeMeta(
    entries: LogEntries<v91N.HvEvent>,
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
        eventCount: entries.length,
        enchants: [],
        errors: {
            ...battleTypeErrors,
            parsing: entries.some((x) => x.type === "error"),
            dupes: false,
            unknownSequence: false,
        },
    }

    function getBattleType(completionType: MetaSummary["completionType"]) {
        const starts = filterEvents(entries, ["ROUND_START"])
        const ends = filterEvents(entries, ["ROUND_END"])

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
                        ? ends.length !== starts.length
                        : ends.length !== starts.length - 1
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
                    "fail",
                    "scan",
                    "defend",
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
        const evs = filterEvents(entries, null)

        // Find ROUND_END
        const endMarkers = new Set(["ROUND_END", "DEFEAT", "FLEE"] as const)

        // prettier-ignore
        const cond =
            (ev: v91N.HvEvent): ev is v91N.HvEventMap[InferCollectionType<typeof endMarkers>] =>
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

function _summarizeItemDrops(entries: LogEntries<v91N.HvEvent>) {
    return summarizeItemDrops(
        entries,
        (ev: v91N.HvEvent) => {
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
                            count: ev.value,
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
                            key: ev.type,
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

function partitionLog(entries: LogEntries<v91N.HvEvent>): v91.LogPartition {
    const actionKeys = [
        "cast",
        "item",
        "attack",
        "skill",
        "stance",
        "fail",
        "scan",
        "defend",
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

        const result = takeEvents(ACTION_GRAMMAR, entries, logIdx, rootRef)
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
            const nextSeqStart = entries[lastEvent.logIdx + 1]
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
    for (let logIdx = 0; logIdx < entries.length; logIdx += 1) {
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
            seq = pushSequencedEvents("start", logIdx, [
                { refs: ["start"] },
                { refs: ["enemy"] },
            ])
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

        const x = entries[logIdx]
        if (!seq && x.type === "event") {
            const pp = (xs: any[]) => (xs ? xs.map((x) => x.event) : null)
            // L.debug(
            //     "context for unknown",
            //     logIdx,
            //     // @ts-ignore
            //     entries[logIdx].event,
            //     pp(prevSeq),
            //     pp(entries.slice(logIdx, logIdx + 30)),
            // )
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
        L.warn("Unknowns in log partition", partition.unknown)
    }

    const errors = entries.flatMap((x, logIdx) =>
        x.type === "error" ? [{ logIdx, ...x }] : [],
    )
    if (errors.length > 0) {
        L.error("Parser errors", errors)
    }

    if (parseTimes) {
        for (const [k, x] of Object.entries(parseTimes)) {
            L.debug(
                // @ts-ignore
                `Partitioned ${k} in ${Math.round(10 * (x.t / x.n)) / 10}ms (${x.n})`,
            )
        }
    }

    return partition
}

type TEvent = v91N.HvEvent["event_type"]

type AG = typeof ACTION_GRAMMAR
type AGKeys<
    TKey extends keyof AG = keyof AG,
    TIdx extends number = 0,
> = AG[TKey][TIdx]["keys"][number]
type P_HIT = AGKeys<"hit">

export namespace v91 {
    export type PartitionEntry<T extends TEvent = TEvent> = {
        event: v91N.HvEvent & { event_type: T }
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
        fail: Array<PartitionSequence<AGKeys<"fail", 0>, never>>
        scan: Array<PartitionSequence<AGKeys<"scan", 0>, AGKeys<"scan", 1>>>
        defend: Array<PartitionSequence<AGKeys<"defend", 0>, never>>
        unknown: PartitionEntry[][]
    }
    export type LogPartitionEntry<T extends string> = {
        event: v91N.HvEvent & { event_type: T }
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
                "DISPEL",
                "P_EXPLOSION",
                "P_CURE_RESTORE",
                // "P_NAMED_HIT",
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
            keys: [
                "P_ATTACK",
                "P_MELEE_PARRY",
                "P_MELEE_MISS",
                "P_ARCANE_BLOW",
            ],
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
            refs: ["hit"],
            keys: ["P_NAMED_HIT", "P_OFFHAND", "P_OFFHAND_MISS"],
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
                "MONSTER_DEATH",
                "YGGDRASIL_BUFF_2",
                "YGGDRASIL_BUFF_3",
                "YGGDRASIL_BUFF_4",
                "YGGDRASIL_BUFF_5",
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
                "P_STANCE_END",
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
                "YGGDRASIL_HEAL",
                "YGGDRASIL_BUFF_2",
                "YGGDRASIL_BUFF_3",
                "YGGDRASIL_BUFF_4",
                "YGGDRASIL_BUFF_5",
                "GEM",
                "SPARK_FAIL",
                "DEFEAT",
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
                "P_DEBUFF_EXPIRE",
                // Status effects cause damage outside of enemy attack phase
                // Ripened Soul hits Emerald Giant for 14646 damage.
                "P_NAMED_HIT_2",
                "P_DRAIN",
                "MONSTER_DEATH",
                "YGGDRASIL_BUFF_2",
                "YGGDRASIL_BUFF_3",
                "YGGDRASIL_BUFF_4",
                "YGGDRASIL_BUFF_5",
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
                // Ygg buffing other mobs with Absorbing Ward
                "YGGDRASIL",
                "YGGDRASIL_BUFF",
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
                "DAWN",
                "REPAIR",
                "REPAIR_2",
                "CHARM_WEAR",
                "MB_USAGE",
                "JPX_TURN_DIVIDER",
                "JPX_ROUND_DIVIDER",
                // There's probably a final phase that happens at after turn end + round end?
                "P_STANCE_END",
            ],
            repeat: {
                min: 0,
                max: 50,
            },
        },
    ],
    fail: [
        {
            keys: [
                "SKILL_FAIL",
                "STANCE_FAIL",
                "CAST_FAIL",
                "ITEM_FAIL",
                "ATTACK_FAIL",
                "ATTACK_FAIL_2",
            ],
            repeat: { min: 0, max: 10 },
        },
    ],
    flee: [
        {
            // Round start grammar can consume the Fleeing buff but whatever
            keys: ["P_BUFF_EFFECT"],
            repeat: { min: 0, max: 1 },
        },
        {
            keys: ["FLEE"],
        },
    ],
    scan: [
        { keys: ["SCAN_1"] },
        {
            keys: [
                "SCAN_2",
                "SCAN_3",
                "SCAN_4",
                "SCAN_5",
                "SCAN_6",
                "SCAN_7",
                "SCAN_8",
                "SCAN_9",
                "SCAN_10",
                "SCAN_11",
                "SCAN_12",
                "SCAN_13",
            ],
            repeat: {
                min: 1,
                max: 20,
            },
        },
    ],
    defend: [
        {
            keys: ["P_DEFEND"],
        },
    ],
} as const satisfies EventGrammar<v91N.HvEvent["event_type"]>

function _parseScans(
    entries: LogEntries<v91N.HvEvent>,
): LogEntries<v91N.HvEvent> {
    const SCAN_EVENTS = new Set([
        "SCAN_1",
        "SCAN_2",
        "SCAN_3",
        "SCAN_4",
        "SCAN_5",
        "SCAN_6",
        "SCAN_7",
        "SCAN_8",
        "SCAN_9",
        "SCAN_10",
        "SCAN_11",
        "SCAN_12",
        "SCAN_13",
    ])

    const isScanEvent = (x?: LogEntry<v91N.HvEvent>) =>
        x && x.type === "event" && SCAN_EVENTS.has(x.event.event_type)

    // Log lines are normally newest first but scans span multiple lines and are oldest first (when submitting this is reversed)
    // Anyways this finds and flips the scan events to make parse grammar easier
    // Also trainer name in scan is always an error (not parseable without seeing nearby lines in log)
    // So parse that here
    for (let idx = 1; idx < entries.length; idx++) {
        const startIdx = idx
        const start = entries[startIdx]
        if (!isScanEvent(start)) {
            continue
        }

        const scanEntries = [start]
        while (true) {
            const next = entries[idx + 1]
            const next2 = entries[idx + 2]
            if (isScanEvent(next)) {
                scanEntries.push(next)
                idx += 1
            } else if (
                next2.type === "event" &&
                next2.event.event_type === "SCAN_2"
            ) {
                scanEntries.push({
                    type: "event",
                    event: {
                        event_type: "SCAN_3",
                        trainer: next.type === "error" ? next.line : null,
                    },
                })
                idx += 1
            } else {
                break
            }
        }

        scanEntries.reverse()
        for (const idx of range(scanEntries.length)) {
            entries[startIdx + idx] = scanEntries[idx]
        }
    }

    return entries
}
