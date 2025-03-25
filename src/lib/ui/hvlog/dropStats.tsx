import { LogAnalysis } from "@/lib/statsDb"
import { max, range, sum } from "radash"
import { LogWithAnalysis } from "./main"
import { formatNumber, TallyTable } from "./tallyTable"

export function DropStats(props: { log: LogWithAnalysis }) {
    const drops = summarizeItemDrops(props.log.analysis)
    const usage = summarizeItemUsage(props.log.analysis)

    const totalIncome = sum(
        Object.values(drops.data).flatMap((xs) => xs),
        (x) => x.value
    )
    const totalExpenses = sum(
        Object.values(usage.data).flatMap((xs) => xs),
        (x) => x.value
    )

    const net = totalIncome - totalExpenses
    const netClass = net > 0 ? "text-green-300" : "text-red-300"
    const netStr = (net > 0 ? "+" : "-") + formatNumber(net) + "c"

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
        <div className="drop-stats h-full overflow-auto flex flex-col">
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

            <hr className="my-12" />

            <div className="income-expense">
                {IncomeSummaryTable(drops)}
                {UsageSummaryTable(props.log.analysis, usage)}
            </div>
        </div>
    )
}

function IncomeSummaryTable(
    summary: ReturnType<typeof summarizeItemDrops>
) {
    const totals = Object.entries(summary.data).reduce(
        (acc, [key, xs]) => {
            acc[key] = {
                label: key,
                count: sum(xs, (x) => x.count),
                value: sum(xs, (x) => x.value),
            }
            return acc
        },
        {} as any
    )

    let rows = Object.values(summary.groups).map(
        ({ label, title, keys }) => {
            let count = 0
            let value = 0
            const subRows = []

            for (const k of keys) {
                if (!(k in totals)) {
                    continue
                }

                count += totals[k].count
                value += totals[k].value
                subRows.push(totals[k])
            }

            return { label, title, count, value, subRows }
        }
    )

    return (
        <TallyTable
            label="Income"
            rows={rows}
            sectionClass="income"
        />
    )
}

function summarizeItemDrops(anal: LogAnalysis) {
    const summary: Summary<any> = {
        data: {},
        groups: [
            {
                keys: new Set("Precursor Artifacts"),
                label: "Artifacts",
                title: "",
            },
            {
                keys: CONSUMABLES,
                label: "Consumables",
                title: [...CONSUMABLES].join(", "),
            },
            {
                keys: new Set(["credits", "Credits", "autosell"]),
                label: "Credits",
                title: "",
            },
            {
                keys: MATERIALS,
                label: "Materials",
                title: [...MATERIALS].join(", "),
            },
            {
                keys: SHARDS,
                label: "Shards",
                title: [...SHARDS].join(", "),
            },
            {
                keys: TROPHIES,
                label: "Trophies",
                title: [...TROPHIES].join(", "),
            },
        ],
    }

    const crystals = {
        keys: new Set(),
        label: "Crystals",
        title: "",
    }
    const figurines = {
        keys: new Set(),
        label: "Figurines",
        title: "",
    }
    const other = {
        keys: new Set(),
        label: "Other",
        title: "",
    }
    summary.groups.push(...[crystals, figurines, other])

    const mapDrops = (
        x: LogAnalysis["drops"][string],
        mult: number,
        asSingle?: boolean
    ) =>
        x.entries.map((entry) => {
            if (!asSingle) {
                return {
                    count: entry.count,
                    value: mult * entry.count,
                    logIdx: entry.logIdx,
                }
            } else {
                return {
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
            summary.data[k] = mapDrops(xs, ps[k])
        } else if (CONSUMABLES.has(k)) {
            summary.data[k] = mapDrops(xs, ps[k])
        } else if (
            k === "autosell" ||
            k === "credits" ||
            k === "Credits"
        ) {
            summary.data[k] = mapDrops(xs, 1, true)
        } else if (key.startsWith("Crystal of ")) {
            summary.data[k] = mapDrops(xs, PRICES["Crystal"])
            crystals.keys.add(k)
        } else if (k.includes("Figurine")) {
            summary.data[k] = mapDrops(xs, ps[k])
            figurines.keys.add(k)
        } else if (MATERIALS.has(k)) {
            summary.data[k] = mapDrops(xs, ps[k])
        } else if (SHARDS.has(k)) {
            summary.data[k] = mapDrops(xs, ps[k])
        } else if (TROPHIES.has(k)) {
            summary.data[k] = mapDrops(xs, ps[k])
        } else if (["experience", "proficiency"].includes(k)) {
        } else {
            summary.data[k] = mapDrops(xs, ps[k] ?? 0)
            other.keys.add(k)
        }
    }

    return summary
}

function UsageSummaryTable(
    anal: LogAnalysis,
    summary: ReturnType<typeof summarizeItemUsage>
) {
    const totals = Object.entries(summary.data).reduce(
        (acc, [key, xs]) => {
            acc[key] = {
                label: key,
                count: sum(xs, (x) => x.count),
                value: sum(xs, (x) => x.value),
            }
            return acc
        },
        {} as any
    )

    let rows = Object.values(summary.groups).map(
        ({ label, title, keys }) => {
            let count = 0
            let value = 0
            const subRows = []

            for (const k of keys) {
                if (!(k in totals)) {
                    continue
                }

                count += totals[k].count
                value += totals[k].value
                subRows.push(totals[k])
            }

            return { label, title, count, value, subRows }
        }
    )

    let staminaUsage = (anal.round?.end ?? 1) / 50
    if (anal.battleType?.name === "Grindfest") {
        staminaUsage += 1
    }
    rows.push({
        label: "Stamina",
        count: staminaUsage,
        value: PRICES["Energy Drink"] / 20,
        title: "",
        subRows: [],
    })

    return (
        <TallyTable
            label="Expenses"
            rows={rows}
            sectionClass="expenses"
        />
    )
}

function summarizeItemUsage(anal: LogAnalysis): Summary {
    const summary: Summary<any> = {
        data: {},
        groups: [
            {
                keys: BUBBLE_VASE,
                label: "Gum & Vase",
                title: [...BUBBLE_VASE].join(", "),
            },
            {
                keys: SCROLLS,
                label: "Scrolls",
                title: [...SCROLLS].join(", "),
            },
            {
                keys: HEALTH_ITEMS,
                label: "Health Items",
                title: [...HEALTH_ITEMS].join(", "),
            },
            {
                keys: MANA_ITEMS,
                label: "Mana Items",
                title: [...MANA_ITEMS].join(", "),
            },
            {
                keys: SPIRIT_ITEMS,
                label: "Spirit Items",
                title: [...SPIRIT_ITEMS].join(", "),
            },
            {
                keys: new Set(["Last Elixir"]),
                label: "Last Elixir",
                title: "",
            },
        ],
    }

    const mapUses = (
        logIdxs: LogAnalysis["itemUsage"][string],
        value: number
    ) =>
        logIdxs.map((logIdx) => ({
            count: 1,
            value: value,
            logIdx,
        }))

    for (let [item, logIdxs] of Object.entries(anal.itemUsage)) {
        const k = item as any
        const ps = PRICES as any

        if (BUBBLE_VASE.has(k)) {
            summary.data[k] = mapUses(logIdxs, ps[k])
        } else if (SCROLLS.has(k)) {
            summary.data[k] = mapUses(logIdxs, ps[k])
        } else if (HEALTH_ITEMS.has(k)) {
            summary.data[k] = mapUses(logIdxs, ps[k])
        } else if (MANA_ITEMS.has(k)) {
            summary.data[k] = mapUses(logIdxs, ps[k])
        } else if (SPIRIT_ITEMS.has(k)) {
            summary.data[k] = mapUses(logIdxs, ps[k])
        } else if (item === "Last Elixir") {
            summary.data[k] = mapUses(logIdxs, PRICES["Last Elixir"])
        }
    }

    return summary
}

interface Summary<TKey extends string = string> {
    data: Record<
        TKey,
        Array<{
            count: number
            value: number
            logIdx: number
        }>
    >
    groups: Array<{
        keys: Set<TKey>
        label: string
        title: string
    }>
}

// thanks BattleStats
// https://forums.e-hentai.org/index.php?showtopic=243497
const PRICES = {
    //Special
    Crystal: 20500 / 12000,
    "Precursor Artifact": 20000,
    Figurine: 16000,
    "Amnesia Shard": 8800,
    "Aether Shard": 2300,
    "Featherweight Shard": 75,
    "Voidseeker Shard": 75,
    "Energy Drink": 117_000,

    //Trophies
    "ManBearPig Tail": 2100,
    "Holy Hand Grenade of Antioch": 2100,
    "Mithra's Flower": 2100,
    "Dalek Voicebox": 2100,
    "Lock of Blue Hair": 2100,
    "Bunny-Girl Costume": 4000,
    "Hinamatsuri Doll": 4000,
    "Broken Glasses": 4000,
    "Black T-Shirt": 12800,
    Sapling: 9500,
    "Unicorn Horn": 13600,
    "Noodly Appendage": 43000,

    //Draughts/Potions/Elixirs
    "Health Draught": 1,
    "Health Potion": 30,
    "Health Elixir": 350,
    "Mana Draught": 4,
    "Mana Potion": 90,
    "Mana Elixir": 500,
    "Spirit Draught": 15,
    "Spirit Potion": 90,
    "Spirit Elixir": 900,
    "Last Elixir": 900,

    "Bubble-Gum": 15000,
    "Flower Vase": 15000,

    //Infusions/Scrolls
    "Infusion of Flames": 140,
    "Infusion of Frost": 140,
    "Infusion of Lightning": 140,
    "Infusion of Storms": 265,
    "Infusion of Darkness": 160,
    "Infusion of Divinity": 3000,
    "Scroll of Life": 400,
    "Scroll of Absorption": 20,
    "Scroll of Shadows": 200,
    "Scroll of Swiftness": 200,
    "Scroll of Protection": 500,
    "Scroll of the Gods": 580,
    "Scroll of the Avatar": 1300,

    //Food
    "Monster Chow": 3,
    "Monster Edibles": 5,
    "Monster Cuisine": 6,
    "Happy Pills": 550,

    //Materials
    "Scrap Metal": 89,
    "Scrap Leather": 89,
    "Scrap Cloth": 89,
    "Scrap Wood": 89,
    "Energy Cell": 180,

    "High-Grade Metals": 300,
    "High-Grade Leather": 100,
    "High-Grade Cloth": 13000,
    "High-Grade Wood": 3000,

    "Mid-Grade Metals": 100,
    "Mid-Grade Leather": 50,
    "Mid-Grade Cloth": 400,
    "Mid-Grade Wood": 200,

    "Low-Grade Metals": 10,
    "Low-Grade Leather": 10,
    "Low-Grade Cloth": 10,
    "Low-Grade Wood": 10,

    //Tokens
    Blood: 0,
    Chaos: 0,
    Soul: 0,
}

const TROPHIES = new Set<keyof typeof PRICES>([
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

const MATERIALS = new Set<keyof typeof PRICES>([
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

const HEALTH_ITEMS = new Set<keyof typeof PRICES>([
    "Health Draught",
    "Health Potion",
    "Health Elixir",
])

const MANA_ITEMS = new Set<keyof typeof PRICES>([
    "Mana Draught",
    "Mana Potion",
    "Mana Elixir",
])

const SPIRIT_ITEMS = new Set<keyof typeof PRICES>([
    "Spirit Draught",
    "Spirit Potion",
    "Spirit Elixir",
])

const BUBBLE_VASE = new Set<keyof typeof PRICES>([
    "Bubble-Gum",
    "Flower Vase",
])

const SCROLLS = new Set<keyof typeof PRICES>([
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

const CONSUMABLES = new Set<keyof typeof PRICES>([
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

const SHARDS = new Set<keyof typeof PRICES>([
    "Amnesia Shard",
    "Aether Shard",
    "Featherweight Shard",
    "Voidseeker Shard",
])

const ARTIFACTS = new Set<keyof typeof PRICES>(["Precursor Artifact"])
