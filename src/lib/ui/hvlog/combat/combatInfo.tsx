import { CompleteLog } from "@/lib/logDb"
import { CombatSummary } from "@/lib/stats/combatStats"
import { sum } from "radash"
import { useLog } from "../../logContext"
import { CountTable, CountTableRow } from "../countTable"

export function CombatInfo({ log }: { log: CompleteLog }) {
    const { combatUsage: usage } = useLog(log, {
        combatUsage: true,
    })

    console.log(usage)
    return <div className="p-8">{CombatUsageTable(usage)}</div>
}

function CombatUsageTable(usage: CombatSummary) {
    const rows = [] as CountTableRow[]

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

        const subRows = castsForGroup(group).flatMap(
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

        rows.push({
            label: group.label,
            count: sum(subRows, (r) => r.count),
            subRows,
        })
    }

    return <CountTable label="Overview" rows={Object.values(rows)} />
}
