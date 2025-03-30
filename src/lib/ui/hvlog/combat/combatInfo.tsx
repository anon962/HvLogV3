import { CompleteLog } from "@/lib/logDb"
import { CombatSummary } from "@/lib/stats/combatStats"
import { avg, setDefault, sortBy } from "@/lib/utils/miscUtils"
import { sum } from "radash"
import { useLog } from "../../logContext"
import { TallyTable, TallyTableProps } from "../tallyTable"

export function CombatInfo({ log }: { log: CompleteLog }) {
    const { combatUsage: usage } = useLog(log, {
        combatUsage: true,
    })

    return (
        <div className="combat-info p-8">
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
            className="casts max-w-[30rem]"
        />
    )
}

type OffensiveTableData = TallyTableProps<{
    damage: number
    damageLethal: number
    resistRate: number
    killRate: number
    hitRate: number
    hitCount: number
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
                    const effects = castsForSpell.flatMap(
                        (cast) => cast.spell ?? []
                    )

                    const damageEffects = effects
                        .filter((effect) => !effect.kill)
                        .map((effect) => effect.value)
                    const damage = avg(damageEffects)

                    const lethalCasts = effects
                        .filter((effect) => effect.kill)
                        .map((effect) => effect.value)
                    const damageLethal = avg(lethalCasts)

                    const resist = avg(
                        effects.map((effect) => effect.resist)
                    )

                    const misses = effects.filter((x) => x.miss)

                    const hitCount = avg(
                        castsForSpell.map(
                            (cast) => (cast.spell ?? []).length
                        )
                    )

                    rows.push({
                        label,
                        value: {
                            damage,
                            damageLethal,
                            hitRate: misses.length / effects.length,
                            resistRate: resist,
                            killRate:
                                lethalCasts.length / effects.length,
                            hitCount,
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
                    }>
                >

                const attacks = casts[0]?.[1] ?? []
                for (const x of attacks) {
                    const { primary, secondary } = x.melee!
                    setDefault(groupedByName, primary.name, []).push({
                        value: primary.value,
                        miss: primary.miss,
                        kill: primary.kill,
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
                        })
                    }
                }

                for (const [label, effects] of Object.entries(
                    groupedByName
                )) {
                    const damageEffects = effects
                        .filter((effect) => !effect.kill)
                        .map((effect) => effect.value)
                    const damage = avg(damageEffects)

                    const lethalCasts = effects
                        .filter((effect) => effect.kill)
                        .map((effect) => effect.value)
                    const damageLethal = avg(lethalCasts)

                    const misses = effects.filter((x) => x.miss)

                    rows.push({
                        label,
                        value: {
                            damage,
                            damageLethal,
                            hitRate: misses.length / effects.length,
                            resistRate: 0,
                            killRate:
                                lethalCasts.length / effects.length,
                            hitCount: 1,
                        },
                    })
                }
                break
            case "Passive Attacks":
                for (const [spell, castsForSpell] of casts) {
                    const effects = castsForSpell.flatMap(
                        (cast) => cast.spell ?? []
                    )

                    const damageEffects = effects
                        .filter((effect) => !effect.kill)
                        .map((effect) => effect.value)
                    const damage = avg(damageEffects)

                    const lethalCasts = effects
                        .filter((effect) => effect.kill)
                        .map((effect) => effect.value)
                    const damageLethal = avg(lethalCasts)

                    rows.push({
                        label: spell,
                        value: {
                            damage,
                            damageLethal,
                            hitRate: 0,
                            resistRate: 0,
                            killRate:
                                lethalCasts.length / effects.length,
                            hitCount: 1,
                        },
                    })
                }
                break
        }
    }

    rows = sortBy(rows, [{ fn: (r) => r.value.damage }]).reverse()

    const columns: OffensiveTableData["columns"] = [
        { label: "Damage (non-lethal)", get: (x) => x.damage },
        { label: "Damage (lethal)", get: (x) => x.damageLethal },
        {
            label: "Kill Rate",
            get: (x) => x.killRate,
            format: (x) => `${Math.round(x * 100)}%`,
        },
        {
            label: "Resist Rate",
            get: (x) => x.resistRate,
            format: (x) => `${Math.round(x)}%`,
        },
        {
            label: "Hit Rate",
            get: (x) => x.hitRate,
            format: (x) => `${Math.round(x * 100)}%`,
        },
        {
            label: "# Targets",
            get: (x) => x.hitCount,
            format: (x) => `${Math.round(x * 10) / 10}`,
        },
    ]

    return (
        <TallyTable
            label="Casts"
            rows={rows}
            columns={columns}
            className="offensive max-w-[60rem]"
        />
    )
}
