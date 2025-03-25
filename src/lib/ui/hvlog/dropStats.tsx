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

    return (
        <div className="drop-stats h-full overflow-auto">
            {IncomeSummaryTable(drops)}
        </div>
    )
}

function IncomeSummaryTable(
    drops: ReturnType<typeof summarizeItemDrops>
) {
    let rows = Object.entries(drops).map(([name, items]) => {
        const count = sum(items, (x) => x.count)
        const value = sum(items, (x) => x.value)
        return { name, count, value }
    })
    rows = sort(rows, (x) => x.value, true)

    const totalValue = sum(Object.values(rows).map((x) => x.value))
    const totalCount = sum(Object.values(rows).map((x) => x.count))

    return (
        <Table className="summary-table w-auto">
            <TableHeader>
                <TableRow className="font-bold">
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right pl-4">
                        Value
                    </TableHead>
                    <TableHead className="text-right pl-4">
                        Count
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((x) => (
                    <TableRow>
                        <TableCell className="pr-4">
                            {x.name}
                        </TableCell>
                        <TableCell className="text-right pl-4">
                            {Math.trunc(x.value)}
                        </TableCell>
                        <TableCell className="text-right pl-4">
                            {x.count}
                        </TableCell>
                    </TableRow>
                ))}

                <TableRow className="border-t-2 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">
                        {Math.trunc(totalValue)}
                    </TableCell>
                    <TableCell className="text-right">
                        {totalCount}
                    </TableCell>
                </TableRow>
            </TableBody>
        </Table>
    )
}

function summarizeItemDrops(anal: LogAnalysis) {
    const init = () =>
        [] as Array<{ count: number; value: number; logIdx: number }>
    const cats = {
        Artifacts: init(),
        Consumables: init(),
        Credits: init(),
        Crystals: init(),
        Figurines: init(),
        Materials: init(),
        Other: init(),
        Shards: init(),
        Trophies: init(),
    } as const

    const take = (x: LogAnalysis["drops"][string], mult: number) =>
        x.entries.map((entry) => ({
            count: entry.count,
            value: mult * entry.count,
            logIdx: entry.logIdx,
        }))

    for (let [key, xs] of Object.entries(anal.drops)) {
        const k = key as any
        const ps = PRICES as any

        if (ARTIFACTS.has(k)) {
            cats.Artifacts.push(...take(xs, ps[k]))
        } else if (CONSUMABLES.has(k)) {
            cats.Consumables.push(...take(xs, ps[k]))
        } else if (k === "autosell" || k === "credits") {
            cats.Credits.push(...take(xs, 1))
        } else if (key.startsWith("Crystal of ")) {
            cats.Crystals.push(...take(xs, PRICES["Crystal"]))
        } else if (k.includes("Figurine")) {
            cats.Figurines.push(...take(xs, PRICES["Figurine"]))
        } else if (MATERIALS.has(k)) {
            cats.Materials.push(...take(xs, ps[k]))
        } else if (SHARDS.has(k)) {
            cats.Shards.push(...take(xs, ps[k]))
        } else if (TROPHIES.has(k)) {
            cats.Trophies.push(...take(xs, ps[k]))
        } else if (["experience", "proficiency"].includes(k)) {
        } else {
            cats.Other.push(...take(xs, ps[k] ?? 0))
        }
    }

    return cats
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

    "Bubble-Gum": 15000,
    "Flower Vase": 15000,

    //Infusions/Scrolls
    "Infusion of Flames": 0, // 140,
    "Infusion of Frost": 0, // 140,
    "Infusion of Lightning": 0, // 140,
    "Infusion of Storms": 0, // 265,
    "Infusion of Darkness": 0, // 160,
    "Infusion of Divinity": 0, // 3000,
    "Scroll of Life": 400,
    "Scroll of Absorption": 20,
    "Scroll of Shadows": 200,
    "Scroll of Swiftness": 200,
    "Scroll of Protection": 500,
    "Scroll of the Gods": 580,
    "Scroll of the Avatar": 1300,

    //Food
    "Monster Chow": 0, //3,
    "Monster Edibles": 0, //5,
    "Monster Cuisine": 0, //6,
    "Happy Pills": 0, //550,

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

const CONSUMABLES = new Set<keyof typeof PRICES>([
    "Health Draught",
    "Health Potion",
    "Health Elixir",
    "Mana Draught",
    "Mana Potion",
    "Mana Elixir",
    "Spirit Draught",
    "Spirit Potion",
    "Spirit Elixir",

    "Bubble-Gum",
    "Flower Vase",

    //Infusions/Scrolls
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

    //Food
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
