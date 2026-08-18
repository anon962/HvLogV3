import {
    AsyncLock,
    batched,
    enumerate,
    L,
    pluralfy,
    sleep,
    throttle,
} from "myutils"
import { compressZstd, decompressZstd } from "../utils/miscUtils"
import { LogDb } from "./db"
import { UserscriptConfig } from "./userscriptConfig"
import { DbN } from "./dbN"
import { LogSourceN } from "./logSourceN"
import { EquipPageN } from "../ui/hvlog/equipsPage"

type TaskOpts = {
    config: UserscriptConfig
    setConfig: (config: Partial<UserscriptConfig>) => void
    logSource: LogSourceN.Protocol
}
type PollOpts = TaskOpts & {
    cancel: boolean
}

export function runUserscriptTasks(opts: TaskOpts) {
    const optsResolved = {
        ...opts,
        cancel: false,
    }

    pollPrices(optsResolved)
    compressLogs(optsResolved)
    tallyEquips(optsResolved)

    return () => {
        optsResolved.cancel = true
    }
}

function isIdle() {
    return [
        () => !document.querySelector("#textlog tbody"),
        () => !document.querySelector("#riddlemaster"),
    ].every((check) => check())
}

// #region pollPrices
async function pollPrices(opts: PollOpts) {
    const DELAY = 86400 * 1000

    const source =
        opts.config.priceSource === "default"
            ? "hvdata"
            : opts.config.priceSource
    if (source === "none") {
        return
    }

    await opts.logSource.ainit

    while (!opts.cancel) {
        if (!isIdle()) {
            await sleep(5 * 60 * 1000)
            continue
        }

        const now = new Date()
        const updatedAt = new Date(opts.config.prices.updatedAt)
        const rem = updatedAt.getTime() + DELAY - now.getTime()
        if (rem > 0) {
            L.info(
                `Sleeping ${(rem / 1000).toFixed(0)}s before price fetch from ${source}`,
            )
            await sleep(rem + 50)
            continue
        } else {
            L.info(`Fetching prices from ${source}`)
        }

        const update: UserscriptConfig["prices"] = {
            updatedAt: now.toISOString(),
            persistent: {},
            isekai: {},
        }
        switch (source) {
            case "hvdata":
                try {
                    for (const world of ["persistent", "isekai"] as const) {
                        const resp = await fetch(
                            `https://hvdata.gisadan.dev/api/fapspreader.json?is_isekai=${world === "isekai" ? 1 : 0}`,
                        )
                        if (!resp.ok) {
                            throw new Error(`${resp.status} ${resp.statusText}`)
                        }
                        const prices = await resp.json()
                        opts.config.prices[world] = prices
                    }
                } catch (e) {
                    L.error(e)
                    await sleep(5 * 60 * 3000)
                    continue
                }
                break
            // case "fapspreader":
            //     try {
            //         for (const world of ["persistent", "isekai"] as const) {
            //             const resp = await fetch(
            //                 `https://market.fapspreader.com/api/items?is_isekai=${world === "isekai" ? 1 : 0}`,
            //             )
            //             if (!resp.ok) {
            //                 throw new Error(`${resp.status} ${resp.statusText}`)
            //             }
            //             const data: any[] = await resp.json()

            //             const prices = {}
            //             for (const { name, sparkline, batch_size } of data) {
            //                 const batchPrice = last(sparkline as number[])
            //                 if (!batchPrice) {
            //                     continue
            //                 }

            //                 opts.config.prices[world][name] =
            //                     batchPrice / batch_size
            //             }

            //             opts.config.prices[world] = prices
            //         }
            //     } catch (e) {
            //         L.error(e)
            //         await sleep(5 * 60 * 3000)
            //         continue
            //     }
            //     break
        }
        opts.setConfig({
            prices: update,
        })
        return
    }
}
// #endregion

// #region compressLogs
export const COMPRESS_LOCK = new AsyncLock()
async function compressLogs(opts: PollOpts) {
    const DELAY = 60 * 60 * 1000
    const COMPRESSION_LEVEL = 10

    const dbP = await new LogDb({ world: "persistent" }).connect()
    const dbI = await new LogDb({ world: "isekai" }).connect()

    while (!opts.cancel) {
        if (!isIdle()) {
            await sleep(5 * 60 * 1000)
            continue
        }

        const lock = await COMPRESS_LOCK.acquire()
        const stats = {
            sizeRaw: 0,
            sizeComp: 0,
            logCount: 0,
        }

        for (const [db, world] of [
            [dbP, "persistent"],
            [dbI, "isekai"],
        ] as const) {
            const conn = await db.conn
            const ids = new Set(await conn.getAllKeys("logsMeta"))
            const done =
                (await db.get("kv", "compressDone")) ?? new Set<string>()

            const missing = ids.difference(done)
            if (missing.size === 0) {
                continue
            }

            let idx = -1
            const [status, cancelStatus] = throttle({
                fn: () =>
                    L.info(
                        `Compressing ${idx} / ${missing.size} ${world} log${pluralfy(missing.size)}`,
                    ),
                interval: 5000,
            })

            for (const id of missing) {
                stats.logCount += 1
                idx += 1
                status()

                const log = await db.get("logsRaw", id)
                if (!log) {
                    L.error("Log has meta entry but no raw. Ruh roh?")
                    done.add(id)
                    continue
                }
                if (!log.raw) {
                    if (log.raw_c) {
                        L.error(`Tried to compress already-compressed log`)
                    } else {
                        L.error(`Log missing raw data`)
                    }
                    done.add(id)
                    continue
                }

                const bytes = new TextEncoder().encode(log.raw)
                const bytesCompressed = await compressZstd({
                    x: log.raw,
                    level: COMPRESSION_LEVEL,
                    pool: true,
                })
                stats.sizeRaw += bytes.byteLength
                stats.sizeComp += bytesCompressed.byteLength

                await db.put("logsRaw", {
                    ...log,
                    compressed: COMPRESSION_LEVEL,
                    raw: null,
                    raw_c: bytesCompressed,
                })
            }

            await db.put("kv", done, "compressDone")
            cancelStatus()
        }

        if (stats.logCount > 0) {
            const sizeRaw = stats.sizeRaw / 1024 / 1024
            const sizeComp = stats.sizeComp / 1024 / 1024
            L.info(
                `Compressed ${stats.logCount} logs (${sizeRaw.toFixed(2)} MiB -> ${sizeComp.toFixed(2)} MiB)`,
            )
        }

        lock.release()
        await sleep(DELAY)
    }
}
// #endregion

// #region tallyEquips
const TALLY_LOCK = new AsyncLock()
async function tallyEquips(opts: PollOpts) {
    const DELAY = 60 * 60 * 1000
    const BATCH_SIZE = 25

    const dbP = await new LogDb({ world: "persistent" }).connect()
    const dbI = await new LogDb({ world: "isekai" }).connect()

    while (!opts.cancel) {
        if (!isIdle()) {
            await sleep(5 * 60 * 1000)
            continue
        }

        const lock = await TALLY_LOCK.acquire()

        const stats = {
            logCount: 0,
        }

        type EquipTally = DbN.IdbSchema["kv"]["equipTally"]
        const init: () => EquipTally = () => ({
            version: LogDb.parserVersion,
            done: new Set(),
            equips: new Uint8Array(),
            pending: false,
        })
        let equipTally = (await dbP.get("kv", "equipTally")) ?? init()

        if (!equipTally || equipTally.version < LogDb.parserVersion) {
            equipTally = init()
        }

        let equips: EquipPageN.IdbStorage
        if (equipTally.equips.byteLength > 0) {
            const decompressed = await decompressZstd({ x: equipTally.equips })
            const text = await new Blob([decompressed]).text()
            equips = JSON.parse(text)
        } else {
            equips = {
                id: [],
                name: [],
                battleTypeId: [],
                battleTypeCategory: [],
                battleTypeCategoryValue: [],
                roundMax: [],
                date: [],
                isBonus: [],
                world: [],
            }
        }

        for (const [db, world] of [
            [dbP, "persistent"],
            [dbI, "isekai"],
        ] as const) {
            const conn = await db.conn
            const ids = new Set(await conn.getAllKeys("logsMeta"))
            const missing = [...ids.difference(equipTally.done)]

            if (missing.length === 0) {
                continue
            }

            if (equipTally.done.size === 0) {
                equipTally.pending = true
                await dbP.put("kv", equipTally, "equipTally")
            }

            stats.logCount += missing.length

            let sampleIdx = 0
            const [status, cancelStatus] = throttle({
                fn: () =>
                    L.info(
                        `Generating equip tally (${sampleIdx} / ${missing.length} / ${world})`,
                    ),
                interval: 5000,
            })

            for (const batch of batched([...missing], BATCH_SIZE)) {
                for (const id of batch) {
                    sampleIdx += 1
                    status()

                    const meta = await opts.logSource.fetchMeta(id)
                    const details = await opts.logSource.fetchDetails(id)

                    for (const [idx, x] of enumerate(
                        Object.values(details.drops),
                    )) {
                        if (!x.isEquip) {
                            continue
                        }

                        equips.id.push(`${id}_${idx}`)
                        equips.name.push(x.name)
                        equips.battleTypeId.push(
                            details.meta.battleType?.id ?? null,
                        )
                        equips.battleTypeCategory.push(
                            details.meta.battleType?.category ?? null,
                        )
                        equips.battleTypeCategoryValue.push(
                            details.meta.battleType?.categoryValue ?? null,
                        )
                        equips.roundMax.push(details.meta.round?.max ?? null)
                        equips.date.push(meta.startedAt)
                        equips.isBonus.push(x.isBonus)
                        equips.world.push(meta.world)

                        equipTally.done.add(id)
                    }
                }

                cancelStatus()

                equipTally.equips = await compressZstd({
                    x: JSON.stringify(equips),
                    level: 10,
                    pool: true,
                })
                await dbP.put("kv", equipTally, "equipTally")

                L.info(
                    `Saved equip tally (total: ${equips.id.length} equips / ${equipTally.done.size} logs / ${(equipTally.equips.byteLength / 1024 / 1024).toFixed(2)} MiB compressed)`,
                )
            }
        }

        if (equipTally.pending) {
            equipTally.pending = false
            await dbP.put("kv", equipTally, "equipTally")
        }

        lock.release()
        await sleep(DELAY)
    }
}
// #endregion
