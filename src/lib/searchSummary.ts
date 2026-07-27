import { FinanceSummary, summarizeFinances } from "./stats/dropStats"
import { MetaSummary } from "./stats/metaStats"
import { DetailsSummary } from "./detailsSummary"
import { CombatSummary } from "./stats/combatStats"

export interface SearchSummary {
    meta: MetaSummary
    finances: FinanceSummary
    equips: string[]
    style: CombatSummary["style"]
}

const EQUIP_SUMMARY_PATT = /^(?:Magnificent|Legendary|Peerless).*$/

export function summarizeSearchStats(
    details: DetailsSummary,
    prices: Record<string, number>,
): SearchSummary {
    const equips: SearchSummary["equips"] = []

    const finances = summarizeFinances(
        details.meta,
        details.drops,
        details.usage,
        prices,
    )

    for (const x of Object.values(details.drops)) {
        if (x.isEquip && EQUIP_SUMMARY_PATT.test(x.key)) {
            equips.push(x.key)
        }
    }

    return {
        meta: details.meta,
        finances,
        equips,
        style: details.combat.style,
    }
}
