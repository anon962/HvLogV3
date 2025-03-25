import { LogAnalysis } from "@/lib/statsDb"
import { sort, sum } from "radash"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../shadcn/table"
import { LogWithAnalysis } from "./main"

export function DropStats(props: { log: LogWithAnalysis }) {
    const drops = summarizeItemDrops(props.log.analysis)
    const usage = summarizeItemUsage(props.log.analysis)

    return (
        <div className="drop-stats h-full overflow-auto flex flex-col gap-12">
            {IncomeSummaryTable(drops)}
            {UsageSummaryTable(props.log.analysis, usage)}
        </div>
    )
}

function IncomeSummaryTable(
    drops: ReturnType<typeof summarizeItemDrops>
) {
    let rows = Object.entries(drops).map(
        ([name, { xs, description }]) => {
            const count = sum(xs, (x) => x.count)
            const value = sum(xs, (x) => x.value)
            return { name, count, value, description }
        }
    )
    rows = sort(rows, (x) => x.value, true)

    const totalValue = sum(Object.values(rows).map((x) => x.value))
    const totalCount = sum(Object.values(rows).map((x) => x.count))

    return (
        <section className="summary-section">
            <h1>Income</h1>
            <Table className="summary-table w-auto border rounded-md">
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-bold">
                            Category
                        </TableHead>
                        <TableHead className="text-right font-bold">
                            Value
                        </TableHead>
                        <TableHead className="text-right font-bold">
                            Count
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((x) => (
                        <TableRow>
                            <TableCell
                                className=""
                                title={x.description}
                            >
                                {x.name}
                            </TableCell>
                            <TableCell className="text-right">
                                {formatNumber(x.value)}
                            </TableCell>
                            <TableCell className="text-right">
                                {x.count >= 1000
                                    ? formatNumber(x.count)
                                    : x.count}
                            </TableCell>
                        </TableRow>
                    ))}

                    <TableRow className="border-t-2 font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">
                            {formatNumber(totalValue)}
                        </TableCell>
                        <TableCell className="text-right">
                            {totalCount >= 1000
                                ? formatNumber(totalCount)
                                : totalCount}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </section>
    )
}

function summarizeItemDrops(anal: LogAnalysis) {
    const init = (description: string) => ({
        xs: [] as Array<{
            count: number
            value: number
            logIdx: number
        }>,
        description,
    })
    const cats = {
        Artifacts: init("Precursor Artifacts"),
        Consumables: init([...CONSUMABLES].join(", ")),
        Credits: init("Credits"),
        Crystals: init("Crystals"),
        Figurines: init("Figurines"),
        Materials: init([...MATERIALS].join(", ")),
        Other: init(""),
        Shards: init([...SHARDS].join(", ")),
        Trophies: init([...TROPHIES].join(", ")),
    } as const

    const take = (
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

    const otherItems = new Set<string>()

    for (let [key, xs] of Object.entries(anal.drops)) {
        const k = key as any
        const ps = PRICES as any

        if (ARTIFACTS.has(k)) {
            cats.Artifacts.xs.push(...take(xs, ps[k]))
        } else if (CONSUMABLES.has(k)) {
            cats.Consumables.xs.push(...take(xs, ps[k]))
        } else if (
            k === "autosell" ||
            k === "credits" ||
            k === "Credits"
        ) {
            console.log("here", xs)
            cats.Credits.xs.push(...take(xs, 1, true))
        } else if (key.startsWith("Crystal of ")) {
            cats.Crystals.xs.push(...take(xs, PRICES["Crystal"]))
        } else if (k.includes("Figurine")) {
            cats.Figurines.xs.push(...take(xs, PRICES["Figurine"]))
        } else if (MATERIALS.has(k)) {
            cats.Materials.xs.push(...take(xs, ps[k]))
        } else if (SHARDS.has(k)) {
            cats.Shards.xs.push(...take(xs, ps[k]))
        } else if (TROPHIES.has(k)) {
            cats.Trophies.xs.push(...take(xs, ps[k]))
        } else if (["experience", "proficiency"].includes(k)) {
        } else {
            console.log(xs, k, ps[k])
            cats.Other.xs.push(...take(xs, ps[k] ?? 0))
            otherItems.add(k)
        }
    }

    cats.Other.description = [...otherItems].join(", ")

    return cats
}

function UsageSummaryTable(
    anal: LogAnalysis,
    usage: ReturnType<typeof summarizeItemUsage>
) {
    let rows = Object.values(usage).map(
        ({ label, description, uses }) => {
            const count = uses.length
            const value = sum(uses, (x) => x.value)
            return { label, count, value, description }
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
        description: "",
    })

    rows = sort(rows, (x) => x.value, true)

    const totalValue = sum(Object.values(rows).map((x) => x.value))
    const totalCount = sum(Object.values(rows).map((x) => x.count))

    return (
        <section className="summary-section">
            <h1>Expenses</h1>
            <Table className="summary-table w-auto border rounded-md">
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-bold">
                            Category
                        </TableHead>
                        <TableHead className="text-right font-bold">
                            Value
                        </TableHead>
                        <TableHead className="text-right font-bold">
                            Count
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((x) => (
                        <TableRow>
                            <TableCell
                                className=""
                                title={x.description}
                            >
                                {x.label}
                            </TableCell>
                            <TableCell className="text-right">
                                {formatNumber(x.value)}
                            </TableCell>
                            <TableCell className="text-right">
                                {x.count >= 1000
                                    ? formatNumber(x.count)
                                    : x.count}
                            </TableCell>
                        </TableRow>
                    ))}

                    <TableRow className="border-t-2 font-bold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">
                            {formatNumber(totalValue)}
                        </TableCell>
                        <TableCell className="text-right">
                            {totalCount >= 1000
                                ? formatNumber(totalCount)
                                : totalCount}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </section>
    )
}

function summarizeItemUsage(anal: LogAnalysis) {
    const init = (label: string, description: string) => ({
        label,
        description,
        uses: [] as Array<{
            value: number
            logIdx: number
        }>,
    })
    const cats = {
        bv: init("Gum & Vase", [...BUBBLE_VASE].join(", ")),
        scrolls: init("Scrolls", [...SCROLLS].join(", ")),
        health: init("Health Items", [...HEALTH_ITEMS].join(", ")),
        mana: init("Mana Items", [...MANA_ITEMS].join(", ")),
        spirit: init("Spirit Items", [...SPIRIT_ITEMS].join(", ")),
        last: init("Last Elixir", "Last Elixir"),
    } as const

    const mapUses = (
        logIdxs: LogAnalysis["itemUsage"][string],
        value: number
    ) =>
        logIdxs.map((logIdx) => ({
            value: value,
            logIdx,
        }))

    for (let [item, logIdxs] of Object.entries(anal.itemUsage)) {
        const k = item as any
        const ps = PRICES as any

        if (BUBBLE_VASE.has(k)) {
            cats.bv.uses.push(...mapUses(logIdxs, ps[k]))
        } else if (SCROLLS.has(k)) {
            cats.scrolls.uses.push(...mapUses(logIdxs, ps[k]))
        } else if (HEALTH_ITEMS.has(k)) {
            cats.health.uses.push(...mapUses(logIdxs, ps[k]))
        } else if (MANA_ITEMS.has(k)) {
            cats.mana.uses.push(...mapUses(logIdxs, ps[k]))
        } else if (SPIRIT_ITEMS.has(k)) {
            cats.spirit.uses.push(...mapUses(logIdxs, ps[k]))
        } else if (item === "Last Elixir") {
            cats.last.uses.push(
                ...mapUses(logIdxs, PRICES["Last Elixir"])
            )
        }
    }

    return cats
}

function formatNumber(x: number) {
    const digits = [...Math.trunc(x).toString()]
        .reverse()
        .reduce((acc, digit, idx) => {
            if (idx % 3 === 0 && idx > 0) {
                acc.push(",")
            }

            acc.push(digit)

            return acc
        }, [] as string[])

    return digits.reverse().join("")
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
