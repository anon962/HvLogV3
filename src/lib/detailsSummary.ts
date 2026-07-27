import { CombatSummary } from "./stats/combatStats"
import { DropSummary } from "./stats/dropStats"
import { ItemUsageSummary } from "./stats/itemUsageStats"
import { MetaSummary } from "./stats/metaStats"

export interface DetailsSummary {
    meta: MetaSummary
    drops: DropSummary
    usage: ItemUsageSummary
    combat: CombatSummary
    monsters: Record<string, number>
}
