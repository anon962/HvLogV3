import { CombatSummary } from "@/lib/stats/combatStats"
import { DetailsSummary } from "@/lib/detailsSummary"
import { formatNumber } from "@/lib/utils/miscUtils"
import { sort, sortBy, sum } from "myutils"
import { useEffect, useRef } from "react"
import { TallyTable, TallyTableProps } from "../../tallyTable"
import { ActionChart } from "./actionChart"
import { HealChart } from "./healChart"
import { IndexMap } from "@/lib/stats/indexMap"

export function CombatInfo({
    details,
    indexMap,
}: {
    details: DetailsSummary
    indexMap: IndexMap
}) {
    return (
        <div className="combat-info p-8 overflow-auto h-full flex flex-col gap-12">
            <div className="flex gap-8">
                {MiscTable(details)}
                {ActionTable(details)}
            </div>

            {DamageTable(details)}

            {details.combat.critMults.length > 0 ? CritTable(details) : null}

            <div className="flex gap-8">
                {HealTable(details)}
                {DebuffTable(details)}
            </div>

            {DamageTakenTable(details)}

            <ActionChartWrapper details={details} indexMap={indexMap} />
            <HealChartWrapper details={details} indexMap={indexMap} />
        </div>
    )
}

type CastTableData = TallyTableProps<
    { count: number; countRound: number },
    { label: string; count: number; countRound: number; uptime: number }
>

function ActionTable({ meta, combat }: DetailsSummary) {
    let rows = [] as CastTableData["rows"]

    const roundCount = meta.round?.end ?? 1
    for (const action of [
        { label: "Heals", data: combat.heal, showSub: true },
        { label: "Buffs", data: combat.buff, showSub: true },
        { label: "Debuffs", data: combat.debuff, showSub: true },
        { label: "Spells", data: combat.spell, showSub: true },
        { label: "Attacks", data: combat.attack, showSub: false },
        { label: "Skills", data: combat.skill, showSub: true },
    ]) {
        const binned = sortBy(
            Object.values(action.data).map((xs) => ({
                label: xs.key,
                count: xs.events.logIdx.length,
                countRound: xs.events.logIdx.length / roundCount,
                uptime:
                    xs.key in combat.downtime
                        ? (roundCount - (combat.downtime[xs.key] ?? 0)) /
                          roundCount
                        : -1,
            })),
            [{ fn: (r) => r.count }, { fn: (r) => r.label, reverse: true }],
        ).reverse()

        // setTimeout(() => {
        //     for (const x of Object.values(action.data)) {
        //         for (const logIdx of x.events.logIdx) {
        //             if (!ti.has(logIdx) || logIdx in blame) {
        //                 console.error(
        //                     action.label,
        //                     x,
        //                     !ti.has(logIdx),
        //                     blame[logIdx],
        //                 )
        //             }
        //             if (!(logIdx in blame)) {
        //                 blame[logIdx] = x
        //             }
        //         }
        //     }
        // })

        rows.push({
            label: action.label,
            value: {
                count: sum(binned.map((d) => d.count)),
                countRound: sum(binned.map((d) => d.countRound)),
            },
            subValues: action.showSub ? binned : undefined,
            selectable: action.showSub ? binned.length > 0 : false,
            disabled: binned.length === 0,
        })
    }

    {
        const otherActions = []
        for (const { label, count } of [
            {
                label: "Scan",
                count: combat.scan.logIdx.length,
            },
            {
                label: "Flee",
                count: meta.completionType === "flee" ? 1 : 0,
            },
            {
                label: "Defend",
                count: combat.defend.logIdx.length,
            },
            {
                label: "Fails",
                count: combat.fail.logIdx.length,
            },
        ]) {
            if (count > 0) {
                otherActions.push({
                    label,
                    count,
                    countRound: count / roundCount,
                    uptime: -1,
                })
            }
        }

        rows.push({
            label: "Other",
            value: {
                count: sum(otherActions.map((x) => x.count)),
                countRound: sum(otherActions.map((x) => x.count)) / roundCount,
            },
            subValues: otherActions.length > 0 ? otherActions : undefined,
            selectable: otherActions.length > 0,
            disabled: otherActions.length === 0,
        })
    }

    // if (group.label === "Times Sparked" && subRows.length) {
    //     subRows[0].label = "Spark of Life"
    // }

    rows = sortBy(rows, [
        { fn: (r) => r.value.count },
        { fn: (r) => r.label, reverse: true },
    ]).reverse()

    const columns: CastTableData["columns"] = [
        { label: "Turns", get: (x) => x.count },
        {
            label: "Per Round",
            get: (x) => x.countRound,
            formatTotal: (x) => x.toFixed(1),
        },
    ]
    const subColumns: CastTableData["subColumns"] = [
        { label: "Spell", get: (x) => x.label, align: "left" },
        { label: "Turns", get: (x) => x.count },
        { label: "Per Round", get: (x) => x.countRound },
        {
            label: "Uptime",
            get: (x) => x.uptime,
            format: ((x: number) => (x >= 0 ? fmtPercentage(x) : "-")) as any,
            tooltip: (
                <span>
                    Percentage of rounds that were started with this action
                    ready.
                </span>
            ),
        },
    ]

    return (
        <TallyTable
            label="Actions"
            rows={rows}
            columns={columns}
            subColumns={subColumns}
            className="casts w-max"
            // hideTotal
        />
    )
}

type DamageTableData = TallyTableProps<{
    count: number
    hitCount: number
    hitCountAvg: number
    damage: number
    hitRate: number
    critRate: number | null
    killRate: number
    failRate: number | null
    resistRate: number | null
    glanceRate: number | null
    parryRate: number | null
}>

function DamageTable({ combat }: DetailsSummary) {
    const hitData = [] as Array<{
        name: string
        count: number
        hitCount: number
        damage: number
        crits?: number
        kills: number
        fails: number
        glances?: number
        resists?: number
        parries?: number
    }>
    for (const k of Object.keys(combat) as Array<keyof CombatSummary>) {
        switch (k) {
            case "spell": {
                hitData.push(
                    ...Object.values(combat.spell).map((s) => {
                        return {
                            name: s.key,
                            count: s.events.logIdx.length,
                            hitCount: sum(s.events.hitCount),
                            damage: sum(s.events.value),
                            crits: sum(s.events.crit),
                            kills: sum(s.events.kill),
                            fails:
                                sum(s.events.miss) +
                                sum(s.events.resist) +
                                sum(s.events.absorb),
                            glances: sum(s.events.glance),
                            resists: sum(s.events.partialResist),
                        }
                    }),
                )
                break
            }
            case "passiveAttack":
                hitData.push(
                    ...Object.values(combat.passiveAttack).map((xs) => {
                        return {
                            name: xs.key,
                            count: xs.events.logIdx.length,
                            hitCount: xs.events.logIdx.length,
                            damage: sum(xs.events.damage),
                            kills: sum(xs.events.kill),
                            fails: xs.events.damage.filter((dmg) => dmg === 0)
                                .length,
                        }
                    }),
                )
                break
            case "skill":
                hitData.push(
                    ...Object.values(combat.skill).map(({ key, events }) => {
                        return {
                            name: key,
                            count: events.logIdx.length,
                            hitCount: sum(events.hitCount),
                            damage: sum(events.value),
                            crits: sum(events.crit),
                            kills: sum(events.kill),
                            fails: 0,
                        }
                    }),
                )
                break
            case "attack": {
                hitData.push(
                    ...Object.values(combat.attack).map(({ key, events }) => {
                        return {
                            name: key,
                            count: events.logIdx.length,
                            hitCount: sum(events.hitCount),
                            damage: sum(events.value),
                            crits: sum(events.crit),
                            kills: sum(events.kill),
                            fails: sum(events.parry),
                            glances: sum(events.glance),
                            parries: sum(events.partialParry),
                        }
                    }),
                )
                break
            }
        }
    }

    const rows: DamageTableData["rows"] = sort(
        hitData.flatMap((x) => {
            let hitRate = 1
            hitRate -= x.fails / x.hitCount
            if (x.fails !== undefined) {
                hitRate -= x.fails / x.hitCount
            }
            if (x.glances !== undefined) {
                hitRate -= x.glances / x.hitCount
            }
            if (x.resists !== undefined) {
                hitRate -= x.resists / x.hitCount
            }
            if (x.parries !== undefined) {
                hitRate -= x.parries / x.hitCount
            }

            // Hard to tell if a cast that was always fully resisted is a spell or debuff
            // So just assume the more likely case of debuff when zero damage
            if (x.damage === 0) {
                return []
            }

            return [
                {
                    label: x.name,
                    value: {
                        count: x.count,
                        hitCount: x.hitCount,
                        hitCountAvg: x.hitCount / x.count,
                        damage: x.damage / x.hitCount,
                        hitRate,
                        critRate:
                            x.crits !== undefined ? x.crits / x.hitCount : null,
                        killRate: x.kills / x.hitCount,
                        failRate:
                            x.fails !== undefined ? x.fails / x.hitCount : null,
                        glanceRate:
                            x.glances !== undefined
                                ? x.glances / x.hitCount
                                : null,
                        resistRate:
                            x.resists !== undefined
                                ? x.resists / x.hitCount
                                : null,
                        parryRate:
                            x.parries !== undefined
                                ? x.parries / x.hitCount
                                : null,
                    },
                },
            ]
        }),
        (r) => r.value.damage * r.value.hitCount,
        true,
    )

    const totalDamage = rows.reduce(
        (acc, r) => acc + r.value.damage * r.value.hitCount,
        0,
    )

    const hasParries = hitData.some((x) => "parries" in x)
    const hasResists = hitData.some((x) => "resists" in x)

    const columnsMaybe: Array<DamageTableData["columns"][number] | null> = [
        {
            label: "Dmg",
            get: (x) => x.damage,
            format: (x) => {
                if (x >= 10_000) {
                    return `${(x / 1000).toFixed(0)}k`
                } else if (x >= 1_000) {
                    return `${(x / 1000).toFixed(1)}k`
                } else {
                    return formatNumber(x)
                }
            },
            tooltip: <span>Average damage per monster hit.</span>,
        },
        {
            label: "Count",
            get: (x) => x.count,
        },
        {
            label: "Weight",
            get: (x) => (x.damage * x.hitCount) / totalDamage,
            format: fmtPercentage,
            tooltip: <span>Percentage of total damage.</span>,
        },
        {
            label: "Target Count",
            get: (x) => x.hitCountAvg,
            format: (x) => `${x.toFixed(1)}`,
            tooltip: <span>Average number of monsters hit per cast.</span>,
        },
        {
            label: "Kill Rate",
            get: (x) => x.killRate,
            format: fmtPercentage,
            tooltip: <span>Percentage of hits that killed the target.</span>,
        },
        {
            label: "Crit Rate",
            get: (x) => x.critRate ?? -1,
            format: fmtPercentage,
        },
        // {
        //     label: "Success Rate",
        //     get: (x) => x.hitRate,
        //     format: fmtPercentage,
        //     tooltip: <span>Percentage of hits that dealt full damage.</span>,
        // },
        {
            label: "Fail Rate",
            get: (x) => x.failRate ?? -1,
            format: fmtPercentage,
            tooltip: (
                <span>
                    Percentage of hits that dealt zero damage.
                    <br />
                    (Failed both accuracy rolls or both parry / resist rolls)
                </span>
            ),
        },
        {
            label: "Glance Rate",
            get: (x) => x.glanceRate ?? -1,
            format: fmtPercentage,
        },
        hasResists
            ? {
                  label: "Partial Resists",
                  get: (x) => x.resistRate ?? -1,
                  format: fmtPercentage,
                  //   tooltip: (
                  //       <span>
                  //           Percentage of spell hits that were partially resisted.
                  //           <br />
                  //           (Failed 1 of 2 rolls.)
                  //       </span>
                  //   ),
              }
            : null,
        hasParries
            ? {
                  label: "Partial Parries",
                  get: (x) => x.parryRate ?? -1,
                  format: fmtPercentage,
                  //   tooltip: (
                  //       <span>
                  //           Percentage of hits that were partially parried.
                  //           <br />
                  //           (Failed 1 of 2 rolls.)
                  //       </span>
                  //   ),
              }
            : null,
    ]

    const columns = columnsMaybe.filter((x) => x !== null)

    return (
        <TallyTable
            label="Damage"
            rows={rows}
            columns={columns}
            className="offensive"
            rowStyle={{
                gridTemplateColumns: `minmax(20ch, 1fr) repeat(${columns.length}, minmax(6ch, 1fr))`,
            }}
            hideTotal
        />
    )
}

type MiscTableData = TallyTableProps<{
    value: string
}>

function MiscTable({ combat, meta }: DetailsSummary) {
    const sparkCount = combat.spark["Spark of Life"]?.events.logIdx.length ?? 0
    const ponyCount = combat.riddlemaster["Ponies"]?.events.logIdx.length ?? 0

    const gems = Object.values(combat)
        .flatMap((cat) => Object.values(cat))
        .filter((x) => x?.key?.includes(" Gem"))
        .map((x) => ({
            label: x.key,
            value: x.events.logIdx.length,
        }))
    const rows: MiscTableData["rows"] = [
        {
            label: "Rounds",
            value: {
                value: meta.round?.end
                    ? `${meta.round.end} / ${meta.round.max}`
                    : "1 / ???",
            },
        },
        {
            label: "Turns",
            value: {
                value: formatNumber(meta.turnIndices.length),
            },
        },
        {
            label: "SoL Triggers",
            value: {
                value: formatNumber(sparkCount),
            },
            disabled: sparkCount === 0,
        },
        {
            label: "Riddlemasters",
            value: {
                value: formatNumber(ponyCount),
            },
            disabled: ponyCount === 0,
        },
        {
            label: "Gems",
            value: {
                value: formatNumber(sum(gems.map((x) => x.value))),
            },
            subValues: gems,
            disabled: gems.length === 0,
            selectable: gems.length > 0,
        },
    ]

    const columns: MiscTableData["columns"] = [
        {
            label: "Value",
            get: (x) => 0,
            format: (_, x) => x.value, // this is awful
        },
    ]
    const subColumns: MiscTableData["subColumns"] = [
        { label: "Name", get: (x) => x.label, align: "left" },
        { label: "Count", get: (x) => x.value },
    ]

    return (
        <TallyTable
            label="Misc"
            rows={rows}
            columns={columns}
            subColumns={subColumns}
            className="misc w-max"
            hideTotal
        />
    )
}

type DebuffTableData = TallyTableProps<{
    count: number
    hitCount: number
    hitCountAvg: number
    hitRate: number
    missRate: number
    partialResistRate: number
    resistRate: number
}>

function DebuffTable({ combat }: DetailsSummary) {
    const rows: DebuffTableData["rows"] = sort(
        Object.values(combat.debuff).map((xs) => {
            // Debuffs can "hit" AND partial resist (reduced duration)
            const castCount = xs.events.logIdx.length
            const hitCount = sum(xs.events.hitCount)
            const partialResists = sum(xs.events.partialResistCount)
            const resists = sum(xs.events.resistCount)
            const misses = sum(xs.events.missCount)
            const targetCount = hitCount + misses + resists

            return {
                label: xs.key,
                value: {
                    count: castCount,
                    hitCount,
                    hitCountAvg: targetCount / castCount,
                    hitRate: (targetCount - resists - misses) / castCount,
                    partialResistRate: partialResists / targetCount,
                    resistRate: resists / targetCount,
                    missRate: misses / targetCount,
                },
                selectable: false,
                disabled: false,
            }
        }),
        (r) => r.value.count,
    )

    const columns: DebuffTableData["columns"] = [
        {
            label: "Casts",
            get: (x) => x.count,
        },
        {
            label: "Target Count",
            get: (x) => x.hitCountAvg,
            format: (x) => `${x.toFixed(1)}`,
            tooltip: (
                <span>
                    Average number of monsters hit per cast (including partial
                    resists).
                </span>
            ),
        },
        // {
        //     label: "Misses",
        //     get: (x) => x.missRate,
        //     format: (x) => `${(100 * x).toFixed(2)}%`,
        // },
        {
            label: "Partial\nResists",
            get: (x) => x.partialResistRate,
            format: (x) => `${(100 * x).toFixed(2)}%`,
        },
        {
            label: "Resists",
            get: (x) => x.resistRate,
            format: (x) => `${(100 * x).toFixed(2)}%`,
        },
    ]

    return rows.length ? (
        <TallyTable
            label="Debuffs"
            rows={rows}
            columns={columns}
            className="debuffs w-max max-w-[50%]"
            hideTotal
        />
    ) : (
        <></>
    )
}

type HealTableData = TallyTableProps<
    {
        count: number
        value: number
    },
    {
        label: string
        count: number
        value: number
    }
>

function HealTable({ combat }: DetailsSummary) {
    const newRow = (label: string) =>
        ({
            label,
            disabled: false,
            selectable: true,
            value: {
                count: 0,
                value: 0,
            },
            subValues: [],
        }) as HealTableData["rows"][number]

    const rowMap = {
        hpA: newRow("HP (active)"),
        hpP: newRow("HP (passive)"),
        mpA: newRow("MP (active)"),
        mpP: newRow("MP (passive)"),
        spA: newRow("SP (active)"),
        spP: newRow("SP (passive)"),
    } as const

    function add(
        type: keyof typeof rowMap,
        label: string,
        count: number,
        value: number,
    ) {
        rowMap[type].subValues!.push({
            label,
            count,
            value,
        })
        rowMap[type].value.count += count
        rowMap[type].value.value += value
    }

    for (const [type, key, data] of [
        ["hpA", "health", combat.heal],
        ["mpA", "magic", combat.heal],
        ["spA", "spirit", combat.heal],
        ["hpP", "health", combat.passiveHeal],
        ["mpP", "magic", combat.passiveHeal],
        ["spP", "spirit", combat.passiveHeal],
    ] as const) {
        for (const source of Object.values(data)) {
            if (source.events[key].some((v) => v > 0)) {
                add(
                    type,
                    source.key,
                    source.events.logIdx.length,
                    sum(source.events[key]),
                )
            }
        }
    }

    const rows = Object.values(rowMap)
    for (const row of rows) {
        row.disabled = row.subValues!.length === 0
        row.selectable = row.subValues!.length > 0
        row.subValues = sort(row.subValues!, (r) => r.value, true)
    }

    const columns: HealTableData["columns"] = [
        {
            label: "Value",
            get: (x) => x.value,
            // opt out of k/m/b units
            format: (x) => formatNumber(x),
        },
        {
            label: "Count",
            get: (x) => x.count,
        },
    ]

    const subColumns: HealTableData["subColumns"] = [
        {
            label: "Name",
            get: (x) => x.label,
        },
        {
            label: "Value",
            get: (x) => x.value,
        },
        {
            label: "Count",
            get: (x) => x.count,
        },
    ]

    return (
        <TallyTable
            label="Heals"
            rows={rows}
            columns={columns}
            subColumns={subColumns}
            className="heals w-max"
            hideTotal
        />
    )
}

function HealChartWrapper(props: {
    details: DetailsSummary
    indexMap: IndexMap
}) {
    const { meta, combat } = props.details

    const chart = new HealChart(combat, props.indexMap, meta.round?.end ?? 1)
    const el = chart.render()

    const container = useRef<HTMLDivElement>(null)

    useEffect(() => {
        el.remove()
        container?.current?.appendChild(el)
        return () => el.remove()
    }, [el, container.current])

    return (
        <div className="flex flex-col">
            <h1 className="text-base font-bold">Heals</h1>
            <span className="text-sm text-muted-foreground py-1">
                Red tick marks denote Spark of Life triggers.
            </span>

            <div ref={container} className="w-full flex"></div>
        </div>
    )
}

function ActionChartWrapper(props: {
    details: DetailsSummary
    indexMap: IndexMap
}) {
    const { meta, combat } = props.details

    const chart = new ActionChart(
        combat,
        meta,
        meta.round?.end ?? 1,
        props.indexMap,
    )
    const el = chart.render()

    const container = useRef<HTMLDivElement>(null)

    useEffect(() => {
        el.remove()
        container?.current?.appendChild(el)
        return () => el.remove()
    }, [el, container.current])

    return (
        <div className="flex flex-col">
            <h1 className="text-base font-bold">Actions</h1>
            <span className="text-sm text-muted-foreground py-1">
                Averaged over {(meta.round?.end ?? 1) > 300 ? 30 : 10} rounds.
                Red tick marks denote Spark of Life triggers.
            </span>

            <div ref={container} className="w-full flex"></div>
        </div>
    )
}

function fmtPercentage(x: number) {
    if (x < 0) {
        return "-"
    }

    const p = x * 100
    if (p < 0.1) {
        return "0%"
    } else if (p < 10) {
        return `${p.toFixed(1)}%`
    } else {
        return `${p.toFixed(0)}%`
    }
}

type DamageTakenData = TallyTableProps<
    CombatSummary["damageTaken"][string] & {
        damageTotal: number
    },
    {
        label: string
        damageTotal: number
        weight: number
    }
>

function DamageTakenTable({ meta, combat }: DetailsSummary) {
    const rows: DamageTakenData["rows"] = sort(
        Object.entries(combat.damageTaken).map(([k, v]) => {
            const totalForSource = sum(Object.values(v.types))

            return {
                label: k,
                value: {
                    ...v,
                    damageTotal: totalForSource,
                },
                subValues: sort(
                    Object.entries(v.types).map(([k, v]) => ({
                        label: k,
                        damageTotal: v,
                        weight: v / totalForSource,
                    })),
                    (r) => r.damageTotal,
                    true,
                ),
                selectable: true,
            }
        }),
        (r) => r.value.damageTotal,
        true,
    )

    const damageTotalTotal = sum(rows.map((r) => r.value.damageTotal))

    // const hasParries = rows.some(
    //     (r) => (r.value.partialParries || r.value.parries || 0) > 0,
    // )
    const hasParries = true
    const hasBlocks = rows.some(
        (r) => (r.value.partialBlocks || r.value.blocks || 0) > 0,
    )

    const columns: Array<DamageTakenData["columns"][number] | null> = [
        {
            label: "Per Round",
            get: (x) => x.damageTotal / (meta.round?.end ?? 1),
            format: (x) => {
                if (x >= 10_000) {
                    return `${(x / 1000).toFixed(0)}k`
                } else if (x >= 1_000) {
                    return `${(x / 1000).toFixed(1)}k`
                } else {
                    return formatNumber(x)
                }
            },
            tooltip: <span>Average damage taken per round.</span>,
        },
        {
            label: "Per Hit",
            get: (x) => x.damageTotal / x.hitCount,
            format: (x) => {
                if (x >= 10_000) {
                    return `${(x / 1000).toFixed(0)}k`
                } else if (x >= 1_000) {
                    return `${(x / 1000).toFixed(1)}k`
                } else {
                    return formatNumber(x)
                }
            },
            tooltip: <span>Average damage taken per hit.</span>,
        },
        {
            label: "Hits",
            get: (x) => x.hitCount,
        },
        {
            label: "Weight",
            get: (v) => v.damageTotal / damageTotalTotal,
            format: fmtPercentage,
            tooltip: <span>Percentage of total damage taken.</span>,
        },
        {
            label: "C.",
            get: (x) => x.crits / x.hitCount,
            format: fmtPercentage,
            tooltip: <span>Critical hits.</span>,
        },
        {
            label: "G.",
            get: (x) => x.glances / x.hitCount,
            format: fmtPercentage,
            tooltip: <span>Glances.</span>,
        },
        {
            label: "E.",
            get: (x) => x.evades / x.hitCount,
            format: fmtPercentage,
            tooltip: <span>Evades.</span>,
        },
        hasParries
            ? {
                  label: "P.P.",
                  get: (x) =>
                      x.partialParries ? x.partialParries / x.hitCount : -1,
                  format: fmtPercentage,
                  tooltip: <span>Partial parries.</span>,
              }
            : null,
        hasParries
            ? {
                  label: "P.",
                  get: (x) => (x.parries ? x.parries / x.hitCount : -1),
                  format: fmtPercentage,
                  tooltip: <span>Parries.</span>,
              }
            : null,
        hasBlocks
            ? {
                  label: "P.B.",
                  get: (x) =>
                      x.partialBlocks ? x.partialBlocks / x.hitCount : -1,
                  format: fmtPercentage,
                  tooltip: <span>Partial blocks.</span>,
              }
            : null,
        hasBlocks
            ? {
                  label: "B.",
                  get: (x) => (x.blocks ? x.blocks / x.hitCount : -1),
                  format: fmtPercentage,
                  tooltip: <span>Blocks.</span>,
              }
            : null,
        {
            label: "P.R.",
            get: (x) => (x.partialResists ? x.partialResists / x.hitCount : -1),
            format: fmtPercentage,
            tooltip: <span>Partial Resists.</span>,
        },
        {
            label: "R.",
            get: (x) => (x.resists ? x.resists / x.hitCount : -1),
            format: fmtPercentage,
            tooltip: <span>Resists.</span>,
        },
        {
            label: "W.",
            get: (x) => (x.whiffs ? x.whiffs / x.hitCount : -1),
            format: fmtPercentage,
            tooltip: <span>Whiffs.</span>,
        },
        // {
        //     label: "Absorbs",
        //     get: (x) => (x.absorbs ? x.absorbs / x.hitCount : -1),
        //     format: fmtPercentage,
        // },
    ]

    const subColumns: DamageTakenData["subColumns"] = [
        {
            label: "Type",
            get: (v) => v.label,
        },
        {
            label: "Total",
            get: (v) => v.damageTotal,
            // @ts-ignore
            format: (v: number) => {
                if (v >= 10_000) {
                    return `${(v / 1000).toFixed(0)}k`
                } else if (v >= 1_000) {
                    return `${(v / 1000).toFixed(1)}k`
                } else {
                    return formatNumber(v)
                }
            },
        },
        {
            label: "Weight",
            get: (v) => v.weight,
            // @ts-ignore
            format: fmtPercentage,
        },
    ]

    return rows.length ? (
        <TallyTable
            label="Damage Taken"
            rows={rows}
            columns={columns.filter((col) => col !== null)}
            subColumns={subColumns}
            className="damage-taken max-w-full overflow-x-auto text-sm!"
            hideTotal
        />
    ) : (
        <></>
    )
}

type CritData = TallyTableProps<{
    count: number
}>
function CritTable({ combat }: DetailsSummary) {
    const totalCrits = sum(combat.critMults.map((x) => x.count))
    const rows: CritData["rows"] = combat.critMults.map(({ count }, idx) => ({
        label: `${idx + 1}-Crit`,
        value: {
            count,
        },
    }))
    const columns: CritData["columns"] = [
        {
            label: "Count",
            get: (v) => v.count,
        },
        {
            label: "Frequency",
            get: (v) => v.count / totalCrits,
            format: fmtPercentage,
        },
    ]
    return (
        <TallyTable
            label="Melee Crits"
            rows={rows}
            columns={columns}
            className="crits max-w-[20em]"
            hideTotal
        />
    )
}
