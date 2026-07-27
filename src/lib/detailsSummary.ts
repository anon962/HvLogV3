import { CombatSummary } from "./stats/combatStats"
import { DropSummary, FinanceSummary } from "./stats/dropStats"
import { IndexMap } from "./stats/indexMap"
import { ItemUsageSummary } from "./stats/itemUsageStats"
import { MetaSummary } from "./stats/metaStats"

export interface DetailsSummary {
    meta: MetaSummary
    drops: DropSummary
    usage: ItemUsageSummary
    combat: CombatSummary

    finances: FinanceSummary
    indexMap: IndexMap
}
