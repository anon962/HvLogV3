import { CompleteLog } from "@/lib/logDb"
import { CombatSummary } from "@/lib/stats/combatStats"
import {
    avg,
    formatNumber,
    setDefault,
    sortBy,
} from "@/lib/utils/miscUtils"
import { sum } from "radash"
import { useStats } from "../../logStatsContext"
import { TallyTable, TallyTableProps } from "../tallyTable"

export function CombatInfo({ log }: { log: CompleteLog }) {
    const { combatUsage: usage } = useStats(log, {
        combatUsage: true,
    })
    console.log(usage)

    return (
        <div className="combat-info p-8 overflow-auto h-full">
            {CastTable(usage)}

            {OffensiveTable(usage)}
        </div>
    )
}

type CastTableData = TallyTableProps<
    { count: number },
    { label: string; count: number }
>

function CastTable(usage: CombatSummary) {
    let rows = [] as CastTableData["rows"]

    const castsForGroup = (group: CombatSummary["groups"][number]) =>
        Object.entries(usage.data).flatMap(([spell, allCasts]) =>
            allCasts.length && group.has(allCasts[0])
                ? [[spell, allCasts] as const]
                : []
        )

    for (const group of usage.groups) {
        if (
            group.label === "Passive Heals" ||
            group.label === "Times Sparked"
        ) {
            continue
        }

        let subValues = castsForGroup(group).flatMap(
            ([spell, castsForSpell]) => {
                const count = castsForSpell.filter((cast) => {
                    switch (group.label) {
                        case "Spells":
                            return !!cast.spell
                        case "Debuffs":
                            return !!cast.debuff
                        case "Heals":
                            return !!cast.heal
                        case "Buffs":
                            return !!cast.buff
                        case "Passive Heals":
                            return !!cast.effectHeals
                        case "Times Sparked":
                            return !!cast.spark
                        case "Melee Attacks":
                            return !!cast.melee
                        case "Passive Attacks":
                            return !!cast.passiveAttack
                    }
                }).length

                if (count === 0) {
                    return []
                }

                return [
                    {
                        label: spell,
                        count,
                    },
                ]
            }
        )

        // if (group.label === "Times Sparked" && subRows.length) {
        //     subRows[0].label = "Spark of Life"
        // }

        subValues = sortBy(subValues, [
            { fn: (r) => r.count },
            { fn: (r) => r.label, reverse: true },
        ]).reverse()

        rows.push({
            label: group.label,
            value: {
                count: sum(subValues, (r) => r.count),
            },
            subValues,
            selectable: subValues.length > 0,
            disabled: subValues.length === 0,
        })
    }

    rows = sortBy(rows, [
        { fn: (r) => r.value.count },
        { fn: (r) => r.label, reverse: true },
    ]).reverse()

    const columns: CastTableData["columns"] = [
        { label: "Turns", get: (x) => x.count },
    ]
    const subColumns: CastTableData["subColumns"] = [
        { label: "Spell", get: (x) => x.label, align: "left" },
        { label: "Turns", get: (x) => x.count },
    ]

    return (
        <TallyTable
            label="Actions"
            rows={rows}
            columns={columns}
            subColumns={subColumns}
            className="casts w-max"
            hideTotal
        />
    )
}

type OffensiveTableData = TallyTableProps<{
    damage: number
    damageRaw: number
    resistRate: number
    killRate: number
    hitRate: number
    hitCount: number
    hitCountAvg: number
    castCount: number
    critRate: number
}>

function OffensiveTable(usage: CombatSummary) {
    let rows = [] as OffensiveTableData["rows"]

    for (const group of usage.groups) {
        const casts = Object.entries(usage.data).flatMap(
            ([spell, allCasts]) =>
                allCasts.length && group.has(allCasts[0])
                    ? [[spell, allCasts] as const]
                    : []
        )

        switch (group.label) {
            case "Spells":
                for (const [label, castsForSpell] of casts) {
                    const hits = castsForSpell.flatMap(
                        (cast) => cast.spell ?? []
                    )

                    const damage = avg(
                        hits.map((effect) => effect.value)
                    )

                    const rawHits = hits
                        .filter((hit) => !hit.kill)
                        .map(
                            (hit) =>
                                hit.value *
                                (hit.resist ? 100 / hit.resist : 1)
                        )
                    const damageRaw = avg(rawHits)

                    const resistedHits = avg(
                        hits.map((hit) => hit.resist)
                    )

                    const misses = hits.filter((x) => x.miss)

                    const hitCountAvg = avg(
                        castsForSpell.map(
                            (cast) => (cast.spell ?? []).length
                        )
                    )

                    const killCount = hits.filter(
                        (effect) => effect.kill
                    ).length

                    const critCount = hits.filter(
                        (hit) => hit.crit
                    ).length

                    rows.push({
                        label,
                        value: {
                            damage,
                            damageRaw,
                            hitRate: 1 - misses.length / hits.length,
                            resistRate: resistedHits,
                            killRate: killCount / hits.length,
                            hitCount: hits.length,
                            hitCountAvg,
                            castCount: castsForSpell.length,
                            critRate: critCount / hits.length,
                        },
                    })
                }
                break
            case "Melee Attacks":
                const groupedByName = {} as Record<
                    string,
                    Array<{
                        value: number
                        kill: boolean
                        miss: boolean
                        crit: boolean
                    }>
                >

                const attacks = casts[0]?.[1] ?? []
                for (const x of attacks) {
                    const { primary, secondary } = x.melee!
                    setDefault(groupedByName, primary.name, []).push({
                        value: primary.value,
                        miss: primary.miss,
                        kill: primary.kill,
                        crit: primary.crit,
                    })

                    for (const effect of secondary) {
                        setDefault(
                            groupedByName,
                            effect.name,
                            []
                        ).push({
                            value: effect.value,
                            miss: effect.miss,
                            kill: effect.kill,
                            crit: effect.crit,
                        })
                    }
                }

                for (const [label, hits] of Object.entries(
                    groupedByName
                )) {
                    const damage = avg(
                        hits.map((effect) => effect.value)
                    )

                    const rawHits = hits
                        .filter((hit) => !hit.kill)
                        .map((hit) => hit.value)
                    const damageRaw = avg(rawHits)

                    const misses = hits.filter((x) => x.miss)

                    const killCount = hits.filter(
                        (effect) => effect.kill
                    ).length

                    const critCount = hits.filter(
                        (hit) => hit.crit
                    ).length

                    rows.push({
                        label,
                        value: {
                            damage,
                            damageRaw,
                            hitRate: 1 - misses.length / hits.length,
                            resistRate: 0,
                            killRate: killCount / hits.length,
                            hitCount: 1,
                            hitCountAvg: 1,
                            castCount: hits.length,
                            critRate: critCount / hits.length,
                        },
                    })
                }
                break
            case "Passive Attacks":
                for (const [spell, castsForSpell] of casts) {
                    const hits = castsForSpell.flatMap((cast) =>
                        cast.passiveAttack ? [cast.passiveAttack] : []
                    )
                    if (!hits.length) {
                        continue
                    }

                    const damage = avg(
                        hits.map((effect) => effect.value)
                    )

                    const rawHits = hits
                        .filter((hit) => !hit.kill)
                        .map((hit) => hit.value)
                    const damageRaw = avg(rawHits)

                    const killCount = hits.filter(
                        (effect) => effect.kill
                    ).length

                    rows.push({
                        label: spell,
                        value: {
                            damage,
                            damageRaw,
                            hitRate: 1,
                            resistRate: 0,
                            killRate: killCount / hits.length,
                            hitCount: 1,
                            hitCountAvg: 1,
                            castCount: hits.length,
                            critRate: 0,
                        },
                    })
                }
                break
        }
    }

    rows = sortBy(rows, [{ fn: (r) => r.value.damage }]).reverse()

    const columns: OffensiveTableData["columns"] = [
        {
            label: "Dmg",
            get: (x) => x.damage,
            format: (x) => {
                if (x >= 100_000) {
                    return `${(x / 1000).toFixed(0)}k`
                } else if (x >= 1000) {
                    return `${(x / 1000).toFixed(1)}k`
                } else {
                    return formatNumber(x)
                }
            },
            tooltip: (
                <span>
                    Average damage per monster hit
                    <br />
                    <pre>(total_damage / total_monsters_hit)</pre>
                </span>
            ),
        },
        // {
        //     label: "Dmg Raw",
        //     get: (x) => x.damageRaw,
        //     format: (x) => {
        //         if (x >= 100_000) {
        //             return `${(x / 1000).toFixed(0)}k`
        //         } else if (x >= 1000) {
        //             return `${(x / 1000).toFixed(1)}k`
        //         } else {
        //             return formatNumber(x)
        //         }
        //     },
        //     tooltip: (
        //         <span>
        //             Average damage per monster hit,
        //             <br />
        //             before resists and excluding hits that kill the
        //             target
        //         </span>
        //     ),
        // },
        {
            label: "Casts",
            get: (x) => x.castCount,
        },
        {
            label: "Target Count",
            get: (x) => x.hitCountAvg,
            format: (x) => `${x.toFixed(1)}`,
            tooltip: (
                <span>Average number of monsters hit per cast.</span>
            ),
        },
        {
            label: "Kill Rate",
            get: (x) => x.killRate,
            format: (x) => `${Math.round(x * 100)}%`,
            tooltip: (
                <span>
                    Percentage of hits that killed the target.
                </span>
            ),
        },
        {
            label: "Resist Rate",
            get: (x) => x.resistRate,
            format: (x) => `${x.toFixed(1)}%`,
            tooltip: (
                <span>Average damage reduction from resists.</span>
            ),
        },
        {
            label: "Crit Rate",
            get: (x) => x.critRate,
            format: (x) => `${Math.round(x * 100)}%`,
        },
        {
            label: "Miss Rate",
            get: (x) => 1 - x.hitRate,
            format: (x) => `${Math.round(x * 100)}%`,
        },
    ]

    return (
        <TallyTable
            label="Casts"
            rows={rows}
            columns={columns}
            className="offensive max-w-[50rem]"
            hideTotal
        />
    )
}
