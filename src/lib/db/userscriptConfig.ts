import { newContext } from "myutils"
import { useEffect, useState } from "react"
import { LogDb } from "./db"
import { DbN } from "./dbN"
import { runUserscriptTasks } from "./userscriptTasks"

export const USERSCRIPT_CONFIG = newContext(() => {
    const [value, setValue] = useState({
        config: DEFAULT_USERSCRIPT_CONFIG(),
        ready: false,
    })

    window.HV_LOG.userscriptConfig = value.config

    useEffect(() => {
        ;(async () => {
            const config = await loadUserscriptConfig()
            setValue({
                config,
                ready: true,
            })
        })()
    }, [])

    useEffect(() => {
        return DbN.listenIdbEvent((ev, { isSameTab }) => {
            if (ev.type !== "hvlog_config_change") {
                return
            }
            if (isSameTab) {
                return
            }

            setValue({ config: ev.config, ready: true })
            saveUserscriptConfig(ev.config)
        })
    })

    useEffect(() => {
        return runUserscriptTasks({
            config: value.config,
            setConfig: (update) =>
                setValue((curr) => ({
                    ...curr,
                    config: {
                        ...curr.config,
                        ...update,
                    },
                })),
        })
    }, [value])

    return {
        value,
        setValue: (update) => {
            setValue((curr) => {
                let next
                if (typeof update === "function") {
                    next = update(curr)
                } else {
                    next = curr
                }
                saveUserscriptConfig(next.config)
                return next
            })
        },
    }
})

export const DEFAULT_USERSCRIPT_CONFIG = () => ({
    prices: {
        updatedAt: "2026-08-14T01:01:01.001Z",
        persistent: PERSISTENT_PRICES() as DbN.Prices,
        isekai: ISEKAI_PRICES() as DbN.Prices,
    },
    hvdataUploadMode: "default" as "default" | "disabled" | "manual" | "auto",
    priceSource: "default" as "default" | "hvdata" | "none", // | fapspreader"
    detailsEquipFilter: "default" as "magnificent" | "legendary" | "peerless",
    samePageLoad: "default" as "default" | "always" | "never",
    defaultLogWorld: "default" as "default" | "persistent" | "isekai",
})

export type UserscriptConfig = ReturnType<typeof DEFAULT_USERSCRIPT_CONFIG>

export async function loadUserscriptConfig(): Promise<UserscriptConfig> {
    const db = new LogDb({ world: "persistent" })

    const fromDb = await db.get("kv", "config")
    if (fromDb) {
        return {
            ...DEFAULT_USERSCRIPT_CONFIG(),
            ...fromDb,
        }
    }

    const config = DEFAULT_USERSCRIPT_CONFIG()
    await db.put("kv", config, "config")
    DbN.broadcastIdbEvent({
        type: "hvlog_config_change",
        config,
    })

    return config
}
export async function saveUserscriptConfig(update: UserscriptConfig) {
    const db = new LogDb({ world: "persistent" })
    await db.put("kv", update, "config")
    DbN.broadcastIdbEvent({
        type: "hvlog_config_change",
        config: { ...update },
    })
}

// prettier-ignore
export const PERSISTENT_PRICES = () => ({"Abstract Art of Bicycles": 9800.0, "Abstract Art of Bridges": 8750.0, "Abstract Art of Busses": 17900.0, "Abstract Art of Crosswalks": 8200.0, "Abstract Art of Fire Hydrants": 12900.0, "Abstract Art of Motorcycles": 15000.0, "Abstract Art of Staircases": 6300.0, "Abstract Art of Tractors": 12000.0, "Abstract Art of Traffic Lights": 9000.0, "Abstract Wire Sculpture": 5900000.0, "Aether Shard": 416.0, "Aggravating Spelling Error": 135333.0, "AI-Based Captcha Solver": 1300000.0, "Ancient Blueberry": 117250.0, "Ancient Kiwi": 90000.0, "Ancient Lemon": 191000.0, "Ancient Mulberry": 127333.0, "Ancient Orange": 100500.0, "Ancient Plum": 116429.0, "Ancient Porn Stash": 20000000.0, "Ancient Strawberry": 100750.0, "Angel Bunny Figurine": 11500.0, "Annoying Dog": 232000.0, "Annoying Gun": 565000.0, "Apple Bloom Figurine": 12550.0, "Applejack Figurine": 12500.0, "Artist CG Category Button": 97200.0, "ASHPD Portal Gun": 150000.0, "Asian Porn Category Button": 101000.0, "Assorted Coins": 413333.0, "AuroraCoin": 500000.0, "Barrel": 580000.0, "Bath Salts": 393333.0, "Berry Punch Figurine": 11850.0, "BFG9000": 655000.0, "Big Macintosh Figurine": 12000.0, "Binding of Balance": 13109.0, "Binding of Dampening": 3600.0, "Binding of Deflection": 177.0, "Binding of Destruction": 2000.0, "Binding of Fenrir": 222.0, "Binding of Focus": 7301.0, "Binding of Freyr": 190.0, "Binding of Friendship": 1978.0, "Binding of Heimdall": 230.0, "Binding of Isaac": 1970.0, "Binding of Mjolnir": 175.0, "Binding of Negation": 5269.0, "Binding of Niflheim": 151.0, "Binding of Protection": 3457.0, "Binding of Slaughter": 3432.0, "Binding of Stoneskin": 282.0, "Binding of Surtr": 168.0, "Binding of the Barrier": 1000.0, "Binding of the Cheetah": 3285.0, "Binding of the Curse-weaver": 243.0, "Binding of the Demon-fiend": 172.0, "Binding of the Earth-walker": 99.0, "Binding of the Elementalist": 706.0, "Binding of the Fire-eater": 80.0, "Binding of the Fleet": 2887.0, "Binding of the Fox": 4580.0, "Binding of the Frost-born": 80.0, "Binding of the Heaven-sent": 169.0, "Binding of the Nimble": 1000.0, "Binding of the Owl": 4858.0, "Binding of the Ox": 1100.0, "Binding of the Raccoon": 905.0, "Binding of the Spirit-ward": 80.0, "Binding of the Thrice-blessed": 80.0, "Binding of the Thunder-child": 80.0, "Binding of the Turtle": 1000.0, "Binding of the Wind-waker": 80.0, "Binding of Warding": 2120.0, "Black T-Shirt": 2672.0, "Blue Chicken Figurine": 198333.0, "Blue Vaccine Vial": 45675.0, "Bon-Bon Figurine": 11600.0, "Broken Glasses": 1126.0, "Bronze Coupon": 10467.0, "Bubble-Gum": 3210.0, "Bunny Girl: Black Fishnet Stockings": 5083.0, "Bunny Girl: Black High Heels": 5083.0, "Bunny Girl: Black Latex Gloves": 5067.0, "Bunny Girl: Black Latex Top": 5286.0, "Bunny Girl: Black Underwear": 72000.0, "Bunny Girl: Choker and Bowtie": 23422.0, "Bunny-Girl Costume": 1151.0, "Bunny Girl: Fluffy Ear Headband": 5300.0, "Bunny Girl: White Fluffy Tail": 5350.0, "Caffeinated Candy": 35480.0, "Chainsaw Chain": 358000.0, "Chainsaw Fuel": 451000.0, "Chainsaw Guide Bar": 199000.0, "Chainsaw Oil": 960596.0, "Chainsaw Repair Guide": 895000.0, "Chainsaw Safety Manual": 30000000.0, "Cheerilee Figurine": 11900.0, "Coin Collector's Guide": 4950000.0, "Collector's Catalyst Cabinet": 382000.0, "CoreCare Starter Kit": 9950000.0, "Core Carrying Bag": 22670.0, "Core Display Stand": 28800.0, "Core LED Illumination": 39000.0, "Core Maintenance Set": 44600.0, "Core Ornament Set": 44000.0, "Core Wall-Mount Display": 29600.0, "Coruscating Catalyst (Final Edition)": 5050.0, "Cosplay Category Button": 500000.0, "Crystal Jiggy": 20000000.0, "Crystalline Galanthus": 20000000.0, "Crystallized Phazon": 219684.0, "Crystal of Corruption": 1.07, "Crystal of Cunning": 1.1, "Crystal of Devotion": 1.05, "Crystal of Finesse": 1.51, "Crystal of Flames": 1.05, "Crystal of Fortitude": 1.53, "Crystal of Frost": 1.05, "Crystal of Knowledge": 1.07, "Crystal of Lightning": 1.07, "Crystal of Swiftness": 1.09, "Crystal of Tempest": 1.03, "Crystal of Vigor": 1.19, "Crystal Snowman": 136000.0, "Dalek Voicebox": 607.0, "Daring Do Figurine": 11959.0, "DarkCoin": 1000000.0, "Decorative Pony Sled": 15000000.0, "Defense Matrix Modulator": 894.0, "Delicate Flower": 745000.0, "Derpy Hooves Figurine": 11900.0, "Diluted Catalyst (Final Edition)": 5067.0, "Dinosaur Egg": 620000.0, "Doctor Whooves Figurine": 11300.0, "DogeCoin": 112000.0, "Doujinshi Category Button": 91000.0, "Easter Egg: A": 20000000.0, "Easter Egg: E": 24000000.0, "Easter Egg: F": 20000000.0, "Easter Egg: K": 20000000.0, "Easter Egg: N": 20000000.0, "Easter Egg: S": 22000000.0, "Energy Cell": 182.0, "Energy Drink": 72191.0, "Exasperating Spelling Error": 101500.0, "Faux Rainbow Mane Cap": 20000000.0, "Featherweight Shard": 78.0, "Fiber-Optic Tree of Harmony": 2000000.0, "Fiber-Optic Xmas Tree": 20000000.0, "Fire Keeper Soul": 2660000.0, "Flame Thrower": 1700000.0, "FlappyCoin": 3000000.0, "Flower Vase": 1932.0, "Fluffle Puff Figurine": 11350.0, "Fluttershy Figurine": 12933.0, "Galling Spelling Error": 500000.0, "Game CG Category Button": 101000.0, "Gift Pony": 17500000.0, "Gleaming Snowflake": 20000000.0, "Glinting Snowflake": 11200000.0, "Glittering Snowflake": 4000000.0, "Gold Coupon": 640000.0, "Golden One-Bit Coin": 20000000.0, "Grammar Nazi Armband": 494000.0, "Greater Aether Charm": 37200.0, "Greater Annihilator Charm": 4560.0, "Greater Archmage Charm": 388000.0, "Greater Butcher Charm": 96625.0, "Greater Capacitor Charm": 60781.0, "Greater Cold-proof Charm": 355.0, "Greater Cold Strike Charm": 1334.0, "Greater Dark-proof Charm": 715.0, "Greater Dark Strike Charm": 7100.0, "Greater Economizer Charm": 29050.0, "Greater Fatality Charm": 18050.0, "Greater Featherweight Charm": 14100.0, "Greater Fire-proof Charm": 1430.0, "Greater Fire Strike Charm": 2455.0, "Greater Hollowforged Charm": 38000.0, "Greater Holy-proof Charm": 1380.0, "Greater Holy Strike Charm": 8700.0, "Greater Juggernaut Charm": 270445.0, "Greater Lightning-proof Charm": 1021.0, "Greater Lightning Strike Charm": 1660.0, "Greater Overpower Charm": 100250.0, "Greater Penetrator Charm": 222000.0, "Greater Spellweaver Charm": 324000.0, "Greater Swiftness Charm": 45400.0, "Greater Voidseeker Charm": 100000.0, "Greater Wind-proof Charm": 575.0, "Greater Wind Strike Charm": 1667.0, "Green Chicken Figurine": 91500.0, "Green Ponyfeather": 20000000.0, "Green Vaccine Vial": 40200.0, "Gummy Figurine": 11300.0, "Happy Pills": 827.0, "Health Draught": 1.03, "Health Elixir": 50.0, "Health Potion": 18.02, "Hearth Warming Lantern": 8800000.0, "Heart Locket": 700000.0, "High-Grade Cloth": 3657.0, "High-Grade Leather": 74.0, "High-Grade Metals": 575.0, "High-Grade Wood": 1174.0, "Hinamatsuri Doll": 1132.0, "Hoarded Canned Goods": 746667.0, "Hoarded Disinfecting Wipes": 30367.0, "Hoarded Dried Pasta": 25867.0, "Hoarded Face Masks": 199000.0, "Hoarded Hand Sanitizer": 30400.0, "Hoarded Powdered Milk": 148500.0, "Hoarded Toilet Paper": 199000.0, "Holographic Rainbow Projector": 18900000.0, "Holy Hand Grenade of Antioch": 608.0, "Idol Fan Starter Pack": 570000.0, "Image Set Category Button": 111000.0, "Indigo Chicken Figurine": 500000.0, "Indigo Ponyfeather": 20000000.0, "Indigo Vaccine Vial": 58375.0, "Infuriating Spelling Error": 400000.0, "Infusion of Darkness": 131.0, "Infusion of Divinity": 115.0, "Infusion of Flames": 65.0, "Infusion of Frost": 52.0, "Infusion of Lightning": 148.0, "Infusion of Storms": 159.0, "Iridium Sprinkler": 72000.0, "Irking Spelling Error": 202000.0, "Iron Heart": 595000.0, "Kevlar Charm Pouch": 28331.0, "Last Elixir": 664.0, "Legendary Armor Core": 4855.0, "Legendary Staff Core": 20000.0, "Legendary Weapon Core": 15787.0, "Lesser Aether Charm": 3165.0, "Lesser Annihilator Charm": 308.0, "Lesser Archmage Charm": 2857.0, "Lesser Butcher Charm": 2400.0, "Lesser Capacitor Charm": 4944.0, "Lesser Cold-proof Charm": 145.0, "Lesser Cold Strike Charm": 96.0, "Lesser Dark-proof Charm": 103.0, "Lesser Dark Strike Charm": 201.0, "Lesser Economizer Charm": 3750.0, "Lesser Fatality Charm": 915.0, "Lesser Featherweight Charm": 2045.0, "Lesser Fire-proof Charm": 285.0, "Lesser Fire Strike Charm": 76.0, "Lesser Hollowforged Charm": 204.0, "Lesser Holy-proof Charm": 57.0, "Lesser Holy Strike Charm": 201.0, "Lesser Juggernaut Charm": 8076.0, "Lesser Lightning-proof Charm": 88.0, "Lesser Lightning Strike Charm": 100.0, "Lesser Overpower Charm": 1657.0, "Lesser Penetrator Charm": 4224.0, "Lesser Spellweaver Charm": 3682.0, "Lesser Swiftness Charm": 1598.0, "Lesser Voidseeker Charm": 1493.0, "Lesser Wind-proof Charm": 63.0, "Lesser Wind Strike Charm": 103.0, "LiteCoin": 158000.0, "Lock of Blue Hair": 608.0, "Low-Grade Cloth": 15.0, "Low-Grade Leather": 17.0, "Low-Grade Metals": 58.0, "Low-Grade Wood": 97.0, "Lyra Heartstrings Figurine": 12500.0, "Mana Draught": 3.25, "Mana Elixir": 193.0, "Mana Potion": 72.23, "ManBearPig Tail": 608.0, "Manga Category Button": 90750.0, "Marten Pelt": 500455.0, "Mayan Desk Calendar": 5000000.0, "Mid-Grade Cloth": 886.0, "Mid-Grade Leather": 50.0, "Mid-Grade Metals": 250.0, "Mid-Grade Wood": 357.0, "Misc Category Button": 500000.0, "Mithra's Flower": 607.0, "Mithril Charm Pouch": 1138889.0, "Monster Chow": 7.24, "Monster Cuisine": 12.95, "Monster Edibles": 18.19, "Museum Ticket": 850000.0, "Mysterious Box": 99999999.0, "Mysterious Tooth": 312000.0, "Non-H Category Button": 101000.0, "Noodly Appendage": 29201.0, "Octavia Figurine": 12067.0, "Orange Chicken Figurine": 500000.0, "Orange Ponyfeather": 15000000.0, "Orange Vaccine Vial": 20400.0, "PeerCoin": 1000000.0, "Pegasopolis Emblem": 2560000.0, "Pinkie Pie Figurine": 12250.0, "Plague Mask": 2060000.0, "Platinum Coupon": 1040000.0, "Potato Battery": 7500000.0, "Pot of Gold": 855000.0, "Precursor Artifact": 4665.0, "Precursor Smoothie Blender": 4900000.0, "Princess Celestia Figurine": 12000.0, "Princess Luna Figurine": 12300.0, "Railgun": 725000.0, "Rainbow Dash Figurine": 12250.0, "Rainbow Egg": 50000000.0, "Rainbow Smoothie": 330000.0, "Raptor Jesus": 916842.0, "Rarity Figurine": 12050.0, "Red Chicken Figurine": 500000.0, "Red Ponyfeather": 9000000.0, "Red Vaccine Vial": 198333.0, "Regular Catalyst (Final Edition)": 5091.0, "Reindeer Antlers": 745000.0, "Repurposed Actuator": 20115.0, "Riling Spelling Error": 131000.0, "Robo Rabbit Head": 31000.0, "Robust Catalyst (Final Edition)": 5092.0, "Sapling": 2170.0, "Scintillating Snowflake": 14773121.0, "Scootaloo Figurine": 12200.0, "Scrap Cloth": 91.0, "Scrap Leather": 91.0, "Scrap Metal": 91.0, "Scrap Wood": 91.0, "Scroll of Absorption": 16.0, "Scroll of Life": 61.0, "Scroll of Protection": 73.0, "Scroll of Shadows": 32.0, "Scroll of Swiftness": 35.0, "Scroll of the Avatar": 205.0, "Scroll of the Gods": 82.0, "Search Engine Carburetor": 17900.0, "Search Engine Crankshaft": 8425.0, "Search Engine Distributor": 7575.0, "Search Engine Manifold": 9850.0, "Search Engine Oil Filter": 36200.0, "Search Engine Piston": 8000.0, "Search Engine Spark Plug": 78500.0, "Search Engine Valve": 39600.0, "Search Engine Water Pump": 9850.0, "Sense of Self-Satisfaction": 7650000.0, "Server Chassis": 300000.0, "Server CPU Module": 1000000.0, "Server Hard Drive": 980100.0, "Server Motherboard": 130000.0, "Server Network Card": 500000.0, "Server Power Supply": 1000000.0, "Server RAM Module": 980000.0, "Shade Fragment": 2071.0, "Shark-Mounted Laser": 1500000.0, "Shimmering Present": 10000000.0, "Shimmering Snowflake": 18000000.0, "Silk Charm Pouch": 755.0, "Silver Coupon": 54438.0, "Six-Lock Box": 1200000.0, "Small Nuke": 1700000.0, "Smart Bomb": 500000.0, "Snowflake Bunny Girl Figure": 630000.0, "Solstice Gift": 25000000.0, "Sparkling Snowflake": 20000000.0, "Spirit Draught": 15.91, "Spirit Elixir": 455.0, "Spirit Potion": 67.4, "Spitfire Figurine": 12050.0, "Star Compass": 535000.0, "Sweetie Belle Figurine": 12013.0, "Tenbora's Box": 6020000.0, "Tesla Coil": 1240000.0, "Trixie Figurine": 12100.0, "Twilight Sparkle Figurine": 12550.0, "Twinkling Snowflake": 3000000.0, "Unicorn Horn": 6111.0, "USB ASIC Miner": 860000.0, "Vaccine Certificate": 1200000.0, "VertCoin": 930000.0, "Vexing Spelling Error": 153667.0, "Vibrant Catalyst (Final Edition)": 5050.0, "Vintage Paper Tag": 40000000.0, "Vinyl Scratch Figurine": 14050.0, "Violet Chicken Figurine": 500000.0, "Violet Ponyfeather": 20000000.0, "Violet Vaccine Vial": 39175.0, "Voidseeker Shard": 392.0, "Vorpal Blade Hilt": 20000000.0, "VPS Hosting Coupon": 481000.0, "Western Category Button": 101000.0, "Wirts Leg": 80000000.0, "Wispy Catalyst (Final Edition)": 7438.0, "World Seed": 5065.0, "Yellow Chicken Figurine": 98000.0, "Yellow Ponyfeather": 20000000.0, "Yellow Vaccine Vial": 34250.0, "Zecora Figurine": 12350.0, "Credits": 1, "Chaos Token": 466.5})
// prettier-ignore
export const ISEKAI_PRICES = () => ({"Aether Shard": 101.0, "Black T-Shirt": 2500.0, "Broken Glasses": 1276.0, "Bubble-Gum": 14678.0, "Bunny-Girl Costume": 1284.0, "Crystallized Phazon": 8907.0, "Dalek Voicebox": 631.0, "Defense Matrix Modulator": 100.0, "Energy Cell": 200.0, "Featherweight Shard": 612.0, "Flower Vase": 12348.0, "Greater Aether Charm": 8050.0, "Greater Annihilator Charm": 1810.0, "Greater Archmage Charm": 85750.0, "Greater Butcher Charm": 97750.0, "Greater Capacitor Charm": 17100.0, "Greater Cold-proof Charm": 500.0, "Greater Cold Strike Charm": 1380.0, "Greater Dark-proof Charm": 522.0, "Greater Dark Strike Charm": 3052.0, "Greater Economizer Charm": 34000.0, "Greater Fatality Charm": 5861.0, "Greater Featherweight Charm": 17550.0, "Greater Fire-proof Charm": 313.0, "Greater Fire Strike Charm": 929.0, "Greater Hollowforged Charm": 21000.0, "Greater Holy-proof Charm": 222.0, "Greater Holy Strike Charm": 6400.0, "Greater Juggernaut Charm": 94300.0, "Greater Lightning-proof Charm": 246.0, "Greater Lightning Strike Charm": 1970.0, "Greater Overpower Charm": 49981.0, "Greater Penetrator Charm": 227500.0, "Greater Spellweaver Charm": 112000.0, "Greater Swiftness Charm": 10700.0, "Greater Voidseeker Charm": 79375.0, "Greater Wind-proof Charm": 298.0, "Greater Wind Strike Charm": 956.0, "Health Draught": 24.38, "Health Elixir": 450.0, "Health Potion": 49.36, "High-Grade Cloth": 2039.0, "High-Grade Leather": 155.0, "High-Grade Metals": 1830.0, "High-Grade Wood": 321.0, "Hinamatsuri Doll": 1284.0, "Holy Hand Grenade of Antioch": 631.0, "Infusion of Darkness": 36.0, "Infusion of Divinity": 54.0, "Infusion of Flames": 38.0, "Infusion of Frost": 49.0, "Infusion of Lightning": 85.0, "Infusion of Storms": 65.0, "Kevlar Charm Pouch": 57500.0, "Legendary Armor Core": 4426.0, "Legendary Staff Core": 19900.0, "Legendary Weapon Core": 19344.0, "Lesser Aether Charm": 58.0, "Lesser Annihilator Charm": 22.0, "Lesser Archmage Charm": 132.0, "Lesser Butcher Charm": 1160.0, "Lesser Capacitor Charm": 154.0, "Lesser Cold-proof Charm": 10.0, "Lesser Cold Strike Charm": 13.0, "Lesser Dark-proof Charm": 10.0, "Lesser Dark Strike Charm": 71.0, "Lesser Economizer Charm": 1833.0, "Lesser Fatality Charm": 30.0, "Lesser Featherweight Charm": 48.0, "Lesser Fire-proof Charm": 10.0, "Lesser Fire Strike Charm": 10.0, "Lesser Hollowforged Charm": 270.0, "Lesser Holy-proof Charm": 10.0, "Lesser Holy Strike Charm": 13.0, "Lesser Juggernaut Charm": 554.0, "Lesser Lightning-proof Charm": 15.0, "Lesser Lightning Strike Charm": 10.0, "Lesser Overpower Charm": 486.0, "Lesser Penetrator Charm": 1490.0, "Lesser Spellweaver Charm": 24.0, "Lesser Swiftness Charm": 109.0, "Lesser Voidseeker Charm": 1375.0, "Lesser Wind-proof Charm": 10.0, "Lesser Wind Strike Charm": 17.0, "Lock of Blue Hair": 633.0, "Low-Grade Cloth": 19.0, "Low-Grade Leather": 27.0, "Low-Grade Metals": 37.0, "Low-Grade Wood": 46.0, "Mana Draught": 49.62, "Mana Elixir": 993.0, "Mana Potion": 99.58, "ManBearPig Tail": 633.0, "Mid-Grade Cloth": 263.0, "Mid-Grade Leather": 229.0, "Mid-Grade Metals": 288.0, "Mid-Grade Wood": 882.0, "Mithra's Flower": 632.0, "Mithril Charm Pouch": 915000.0, "Noodly Appendage": 15509.0, "Repurposed Actuator": 4154.0, "Sapling": 2503.0, "Scrap Cloth": 98.0, "Scrap Leather": 98.0, "Scrap Metal": 100.0, "Scrap Wood": 81.0, "Scroll of Absorption": 21.0, "Scroll of Life": 207.0, "Scroll of Protection": 246.0, "Scroll of Shadows": 89.0, "Scroll of Swiftness": 67.0, "Scroll of the Avatar": 708.0, "Scroll of the Gods": 442.0, "Shade Fragment": 718.0, "Silk Charm Pouch": 1166.0, "Spirit Draught": 49.76, "Spirit Elixir": 988.0, "Spirit Potion": 99.5, "Unicorn Horn": 3900.0, "Voidseeker Shard": 1726.0, "World Seed": 83.0, "Credits": 1})
