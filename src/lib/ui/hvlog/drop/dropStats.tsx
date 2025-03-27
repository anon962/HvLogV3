import { CompleteLog } from "@/lib/logDb"
import { filterEvents } from "@/lib/statExtractors"
import { LogAnalysis } from "@/lib/statsDb"
import { formatNumber } from "@/lib/utils/miscUtils"
import { alphabetical, max, range, sum } from "radash"
import { useEffect, useRef } from "react"
import { PRICES } from "../../constants"
import { EventSummary } from "../eventSummary"
import { LogWithAnalysis } from "../main"
import { TallyTable, TallyTableRow } from "../tallyTable"
import { IncomeChart } from "./incomeChart"

export function DropStats(props: { log: LogWithAnalysis }) {
    const drops = summarizeItemDrops(props.log.analysis)
    const usage = summarizeItemUsage(props.log.analysis)

    let staminaUsage = (props.log.analysis.round?.end ?? 1) / 50
    if (props.log.analysis.battleType?.name === "Grindfest") {
        staminaUsage += 1
    }

    return (
        <div className="drop-stats h-full overflow-auto flex flex-col">
            <div className="overview">
                {CalculationPreview(drops, usage, staminaUsage)}
                {EquipSummary(props.log.log)}
            </div>

            <hr className="my-12" />

            <div className="income-expense">
                {IncomeSummaryTable(drops)}
                {UsageSummaryTable(usage, staminaUsage)}
            </div>

            <hr className="my-12" />

            {DropChart(props.log.log, drops, usage)}
        </div>
    )
}

function CalculationPreview(
    dropSummary: DropEventSummary,
    usageSummary: DropEventSummary,
    staminaUsage: number
) {
    const totalIncome = sum(
        Object.values(dropSummary.data).flatMap((xs) => xs),
        (x) => x.value
    )
    let totalExpenses =
        sum(
            Object.values(usageSummary.data).flatMap((xs) => xs),
            (x) => x.value
        ) +
        (staminaUsage * PRICES["Energy Drink"]) / 10

    const net = totalIncome - totalExpenses
    const netClass = net > 0 ? "text-green-300" : "text-red-300"
    const netStr = (net > 0 ? "+" : "") + formatNumber(net) + "c"

    const incomeStr = "+" + formatNumber(totalIncome) + "c"
    const expenseStr = "-" + formatNumber(totalExpenses) + "c"
    const maxLength = max([
        netStr.length,
        incomeStr.length,
        expenseStr.length,
    ])

    const divider =
        [...range(maxLength - 1)].map(() => "=").join("") +
        "==========="

    return (
        <pre
            className="w-max px-2 grid gap-x-4 text-right"
            style={{
                gridTemplateColumns: "max-content max-content",
            }}
        >
            <span className="">Income:</span>
            <span className="text-green-300">{incomeStr}</span>

            <span className="">Expenses:</span>
            <span className="text-red-300">{expenseStr}</span>

            {/* <span></span> */}
            <span className="col-span-2">{divider}</span>

            <span className="">Net:</span>
            <span className={netClass}>{netStr}</span>
        </pre>
    )
}

function IncomeSummaryTable(
    summary: ReturnType<typeof summarizeItemDrops>
) {
    const acc = Object.fromEntries(
        summary.groups.map((grp) => [
            grp.label,
            {
                label: grp.label,
                count: 0,
                value: 0,
                subRows: [] as TallyTableRow[],
            },
        ])
    )

    const rows = Object.values(summary.data).reduce((acc, xs) => {
        const count = sum(xs, (x) => x.count)
        const value = sum(xs, (x) => x.value)

        const group = summary.groups.find((grp) => grp.has(xs[0].key))
        if (!group) {
            return acc
        }

        acc[group.label].count += count
        acc[group.label].value += value
        acc[group.label].subRows!.push({
            label: xs[0].key,
            count,
            value,
        })

        return acc
    }, acc)

    return (
        <TallyTable
            label="Income"
            rows={Object.values(rows)}
            sectionClass="income"
        />
    )
}

function summarizeItemDrops(anal: LogAnalysis) {
    const summary: DropEventSummary = {
        data: {},
        groups: [
            newDropEventGroup(
                "Artifacts",
                new Set(["Precursor Artifact"])
            ),
            newDropEventGroup("Consumables", CONSUMABLES),
            newDropEventGroup(
                "Credits",
                new Set(["credits", "Credits", "autosell"])
            ),
            newDropEventGroup("Materials", MATERIALS),
            newDropEventGroup("Shards", SHARDS),
            newDropEventGroup("Trophies", TROPHIES),
        ],
    }

    const crystalKeys = new Set<string>()
    const figurineKeys = new Set<string>()
    const otherKeys = new Set<string>()

    const mapDrops = (
        key: string,
        x: LogAnalysis["drops"][string],
        mult: number,
        asSingle?: boolean
    ) =>
        x.entries.map((entry) => {
            if (!asSingle) {
                return {
                    key,
                    count: entry.count,
                    value: mult * entry.count,
                    logIdx: entry.logIdx,
                }
            } else {
                return {
                    key,
                    count: 1,
                    value: mult * entry.count,
                    logIdx: entry.logIdx,
                }
            }
        })

    for (let [key, xs] of Object.entries(anal.drops)) {
        const k = key as any
        const ps = PRICES as any

        if (ARTIFACTS.has(k)) {
            summary.data[k] = mapDrops(k, xs, ps[k])
        } else if (CONSUMABLES.has(k)) {
            summary.data[k] = mapDrops(k, xs, ps[k])
        } else if (
            k === "autosell" ||
            k === "credits" ||
            k === "Credits"
        ) {
            summary.data[k] = mapDrops(k, xs, 1, true)
        } else if (key.startsWith("Crystal of ")) {
            summary.data[k] = mapDrops(k, xs, PRICES["Crystal"])
            crystalKeys.add(k)
        } else if (k.includes("Figurine")) {
            summary.data[k] = mapDrops(k, xs, PRICES["Figurine"])
            figurineKeys.add(k)
        } else if (MATERIALS.has(k)) {
            summary.data[k] = mapDrops(k, xs, ps[k])
        } else if (SHARDS.has(k)) {
            summary.data[k] = mapDrops(k, xs, ps[k])
        } else if (TROPHIES.has(k)) {
            summary.data[k] = mapDrops(k, xs, ps[k])
        } else if (["experience", "proficiency"].includes(k)) {
        } else {
            summary.data[k] = mapDrops(k, xs, ps[k] ?? 0)
            otherKeys.add(k)
        }
    }

    summary.groups.push(newDropEventGroup("Crystals", crystalKeys))
    summary.groups.push(newDropEventGroup("Figurines", figurineKeys))
    summary.groups.push(newDropEventGroup("Other", otherKeys))

    return summary
}

function UsageSummaryTable(
    summary: ReturnType<typeof summarizeItemUsage>,
    staminaUsage: number
) {
    const acc = Object.fromEntries(
        summary.groups.map((grp) => [
            grp.label,
            {
                label: grp.label,
                count: 0,
                value: 0,
                subRows: [] as TallyTableRow[],
            },
        ])
    )

    const rows = Object.values(summary.data).reduce((acc, xs) => {
        const count = sum(xs, (x) => x.count)
        const value = sum(xs, (x) => x.value)

        const group = summary.groups.find((grp) => grp.has(xs[0].key))
        if (!group) {
            return acc
        }

        acc[group.label].count += count
        acc[group.label].value += value
        acc[group.label].subRows!.push({
            label: xs[0].key,
            count,
            value,
        })

        return acc
    }, acc)

    rows["stamina"] = {
        label: "Stamina",
        count: staminaUsage,
        value: (staminaUsage * PRICES["Energy Drink"]) / 10,
        subRows: [],
    }

    return (
        <TallyTable
            label="Expenses"
            rows={Object.values(rows)}
            sectionClass="expenses"
        />
    )
}

function summarizeItemUsage(anal: LogAnalysis): DropEventSummary {
    const summary: DropEventSummary = {
        data: {},
        groups: [
            newDropEventGroup("Gum & Vase", BUBBLE_VASE),
            newDropEventGroup("Scrolls", SCROLLS),
            newDropEventGroup("Health Items", HEALTH_ITEMS),
            newDropEventGroup("Mana Items", MANA_ITEMS),
            newDropEventGroup("Spirit Items", SPIRIT_ITEMS),
            newDropEventGroup(
                "Last Elixir",
                new Set(["Last Elixir"])
            ),
        ],
    }

    const mapUses = (
        key: string,
        logIdxs: LogAnalysis["itemUsage"][string],
        value: number
    ) =>
        logIdxs.map((logIdx) => ({
            key,
            count: 1,
            value: value,
            logIdx,
        }))

    for (let [item, logIdxs] of Object.entries(anal.itemUsage)) {
        const k = item as any
        const ps = PRICES as any

        if (BUBBLE_VASE.has(k)) {
            summary.data[k] = mapUses(k, logIdxs, ps[k])
        } else if (SCROLLS.has(k)) {
            summary.data[k] = mapUses(k, logIdxs, ps[k])
        } else if (HEALTH_ITEMS.has(k)) {
            summary.data[k] = mapUses(k, logIdxs, ps[k])
        } else if (MANA_ITEMS.has(k)) {
            summary.data[k] = mapUses(k, logIdxs, ps[k])
        } else if (SPIRIT_ITEMS.has(k)) {
            summary.data[k] = mapUses(k, logIdxs, ps[k])
        } else if (item === "Last Elixir") {
            summary.data[k] = mapUses(
                k,
                logIdxs,
                PRICES["Last Elixir"]
            )
        }
    }

    return summary
}

function DropChart(
    log: CompleteLog,
    dropSummary: DropEventSummary,
    usageSummary: DropEventSummary
) {
    const chart = new IncomeChart(log, dropSummary, usageSummary)
    const el = chart.render()

    const container = useRef<HTMLDivElement>(null)

    useEffect(() => {
        el.remove()
        container?.current?.appendChild(el)
        return () => el.remove()
    }, [el, container.current])

    return <div ref={container} className="w-full flex"></div>
}

function EquipSummary(log: CompleteLog) {
    const evs = alphabetical(
        filterEvents(log, ["DROP"]).filter((ev) =>
            GOOD_EQUIPS.some((patt) => ev.item.match(patt))
        ),
        (ev) => ev.item
    )

    const els = evs.map((ev) => (
        <li className="list-disc">{ev.item}</li>
    ))

    return (
        <div className="equips">
            <h1 className="font-bold">Notable Equips:</h1>

            <ul className="pl-6 font-mono">
                {els.length ? (
                    els
                ) : (
                    <li className="list-disc">(none)</li>
                )}
            </ul>
        </div>
    )
}

function newDropEventGroup<T extends string>(
    label: string,
    keys: Set<T>
): DropEventSummary["groups"][number] {
    return { label, has: (key) => keys.has(key as any) }
}

export type DropEventSummary = EventSummary<
    {
        count: number
        value: number
    },
    (key: string) => boolean,
    string
>

type PriceKey = keyof typeof PRICES

const TROPHIES = new Set<PriceKey>([
    "ManBearPig Tail",
    "Holy Hand Grenade of Antioch",
    "Mithra's Flower",
    "Dalek Voicebox",
    "Lock of Blue Hair",
    "Bunny-Girl Costume",
    "Hinamatsuri Doll",
    "Broken Glasses",
    "Black T-Shirt",
    "Sapling",
    "Unicorn Horn",
    "Noodly Appendage",
])

const MATERIALS = new Set<PriceKey>([
    "Scrap Metal",
    "Scrap Leather",
    "Scrap Cloth",
    "Scrap Wood",
    "Energy Cell",

    "High-Grade Metals",
    "High-Grade Leather",
    "High-Grade Cloth",
    "High-Grade Wood",

    "Mid-Grade Metals",
    "Mid-Grade Leather",
    "Mid-Grade Cloth",
    "Mid-Grade Wood",

    "Low-Grade Metals",
    "Low-Grade Leather",
    "Low-Grade Cloth",
    "Low-Grade Wood",
])

const HEALTH_ITEMS = new Set<PriceKey>([
    "Health Draught",
    "Health Potion",
    "Health Elixir",
])

const MANA_ITEMS = new Set<PriceKey>([
    "Mana Draught",
    "Mana Potion",
    "Mana Elixir",
])

const SPIRIT_ITEMS = new Set<PriceKey>([
    "Spirit Draught",
    "Spirit Potion",
    "Spirit Elixir",
])

const BUBBLE_VASE = new Set<PriceKey>(["Bubble-Gum", "Flower Vase"])

const SCROLLS = new Set<PriceKey>([
    "Infusion of Flames",
    "Infusion of Frost",
    "Infusion of Lightning",
    "Infusion of Storms",
    "Infusion of Darkness",
    "Infusion of Divinity",
    "Scroll of Life",
    "Scroll of Absorption",
    "Scroll of Shadows",
    "Scroll of Swiftness",
    "Scroll of Protection",
    "Scroll of the Gods",
    "Scroll of the Avatar",
])

const CONSUMABLES = new Set<PriceKey>([
    ...HEALTH_ITEMS,
    ...MANA_ITEMS,
    ...SPIRIT_ITEMS,
    ...BUBBLE_VASE,
    ...SCROLLS,

    "Monster Chow",
    "Monster Edibles",
    "Monster Cuisine",
    "Happy Pills",
])

const SHARDS = new Set<PriceKey>([
    "Amnesia Shard",
    "Aether Shard",
    "Featherweight Shard",
    "Voidseeker Shard",
])

const ARTIFACTS = new Set<PriceKey>(["Precursor Artifact"])

const GOOD_EQUIPS = [
    /Peerless/,
    /Legendary/,
    /Magnificent/,
    // /Exquisite/,
    // /Superior/,
    // /Fine/,
    // /Crude/,
]
