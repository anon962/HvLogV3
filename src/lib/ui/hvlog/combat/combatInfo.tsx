import { CompleteLog } from "@/lib/logDb"
import { CombatSummary } from "@/lib/stats/combatStats"
import { sortBy } from "@/lib/utils/miscUtils"
import { sum } from "radash"
import { useLog } from "../../logContext"
import { TallyTable, TallyTableProps } from "../tallyTable"

export function CombatInfo({ log }: { log: CompleteLog }) {
    const { combatUsage: usage } = useLog(log, {
        combatUsage: true,
    })

    console.log(usage)
    return <div className="p-8">{CombatUsageTableWrapper(usage)}</div>
}

function CombatUsageTableWrapper(usage: CombatSummary) {
    let rows = [] as CombatUsageTable["rows"]

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
                        case "Offense":
                            return !!cast.offense
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
        })
    }

    rows = sortBy(rows, [
        { fn: (r) => r.value.count },
        { fn: (r) => r.label, reverse: true },
    ]).reverse()

    const columns: CombatUsageTable["columns"] = [
        { label: "Casts", get: (x) => x.count },
    ]
    const subColumns: CombatUsageTable["subColumns"] = [
        { label: "Spell", get: (x) => x.label, align: "left" },
        { label: "Casts", get: (x) => x.count },
    ]

    return (
        <TallyTable
            label="Casts"
            rows={rows}
            columns={columns}
            subColumns={subColumns}
        />
    )
}

type CombatUsageTable = TallyTableProps<
    { count: number },
    { label: string; count: number }
>
