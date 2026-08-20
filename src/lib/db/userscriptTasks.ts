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
import { HV_WORLDS } from "../constants"

export const TASK_LOCK = new AsyncLock()
const TASKS: Array<(opts: TaskOpts) => TaskGen> = [
    pollPrices,
    compressLogs,
    tallyEquips,
]
const ACTIVE_TASK = {
    task: null as TaskGen | null,
    idx: -1,
}
const TASK_DATA: Array<{
    state: any
    delay: null | Promise<number>
}> = TASKS.map((t) => ({
    state: null,
    delay: null,
}))

type TaskOpts = {
    config: UserscriptConfig
    setConfig: (config: Partial<UserscriptConfig>) => void
    logSource: LogSourceN.Protocol
}
type TaskGen = AsyncGenerator<undefined, () => Promise<any>, TaskOpts>

export function runUserscriptTasks(opts: TaskOpts) {
    let isCancelled = false
    const { promise: cancel, resolve: resolveCancel } =
        Promise.withResolvers<null>()
    async function poll() {
        while (!isCancelled) {
            const lock = await TASK_LOCK.acquire()
            try {
                if (ACTIVE_TASK.task === null) {
                    const idleTaskIdx = TASK_DATA.findIndex(
                        (x) => x.delay === null,
                    )
                    if (idleTaskIdx > -1) {
                        ACTIVE_TASK.idx = idleTaskIdx
                        ACTIVE_TASK.task = TASKS[idleTaskIdx](opts)
                        continue
                    }

                    const nextIdx = await Promise.race([
                        ...TASK_DATA.map((x) => x.delay!),
                        cancel.then(() => "cancel" as const),
                        lock.whenBlocking.then(() => "blocking" as const),
                    ])
                    if (nextIdx === "cancel") {
                        return
                    } else if (nextIdx === "blocking") {
                        continue
                    }
                    ACTIVE_TASK.idx = nextIdx
                    ACTIVE_TASK.task = TASKS[nextIdx](opts)
                    continue
                }

                let result
                try {
                    result = await ACTIVE_TASK.task.next(opts)
                } catch (e) {
                    // Should only throw when logs are deleted after key query
                    L.error(e)
                    const idx = ACTIVE_TASK.idx
                    ACTIVE_TASK.task = null
                    TASK_DATA[idx].delay = sleep(30_000).then(() => idx)
                    continue
                }

                if (result.done) {
                    const idx = ACTIVE_TASK.idx
                    ACTIVE_TASK.task = null
                    TASK_DATA[idx].delay = result.value().then(() => idx)
                }
            } finally {
                lock.release()
            }
        }
    }

    poll()
    return () => {
        isCancelled = true

        TASK_DATA[TASKS.findIndex((x) => x === pollPrices)].delay = null

        resolveCancel(null)
    }
}

// #region pollPrices
async function* pollPrices(opts: TaskOpts): TaskGen {
    const DELAY = 86400 * 1000

    const source =
        opts.config.priceSource === "default"
            ? "hvdata"
            : opts.config.priceSource
    if (source === "none") {
        return () => sleep(999_999_999)
    }

    const now = new Date()
    const updatedAt = new Date(opts.config.prices.updatedAt)
    const rem = updatedAt.getTime() + DELAY - now.getTime()
    if (rem > 0) {
        L.info(
            `Sleeping ${(rem / 1000).toFixed(0)}s before price fetch from ${source}`,
        )
        return () => sleep(rem)
    }

    L.info(`Fetching prices from ${source}`)

    await opts.logSource.ainit
    const update: UserscriptConfig["prices"] = {
        updatedAt: now.toISOString(),
        persistent: {},
        isekai: {},
    }
    switch (source) {
        case "hvdata":
            try {
                for (const world of HV_WORLDS) {
                    const resp = await fetch(
                        `https://hvdata.gisadan.dev/api/fapspreader.json?is_isekai=${world === "isekai" ? 1 : 0}`,
                    )
                    if (!resp.ok) {
                        throw new Error(`${resp.status} ${resp.statusText}`)
                    }
                    const prices = await resp.json()
                    update[world] = prices
                }
            } catch (e) {
                L.error(e)
                return () => sleep(5 * 60 * 1000)
            }
            break
        // case "fapspreader":
        //     try {
        //         for (const world of HV_WORLDS) {
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
        //         return () => sleep(5 * 60 * 1000)
        //     }
        //     break
    }

    opts.config.prices = update
    opts.setConfig({
        prices: update,
    })

    return () => sleep(DELAY)
}
// #endregion

// #region compressLogs
async function* compressLogs(opts: TaskOpts): TaskGen {
    const DELAY = 60 * 60 * 1000
    const COMPRESSION_LEVEL = 10

    const db = await new LogDb().connect()

    const stats = {
        sizeRaw: 0,
        sizeComp: 0,
        logCount: 0,
    }

    const conn = await db.conn
    const ids = new Set(await conn.getAllKeys("logsMeta"))
    const done = (await db.get("kv", "compressDone")) ?? new Set<string>()

    const missing = ids.difference(done)
    if (missing.size === 0) {
        if (done.size > 0) {
            return () => sleep(DELAY)
        } else {
            return () => sleep(30 * 1000)
        }
    }

    let idx = -1
    const [status, cancelStatus] = throttle({
        fn: () =>
            L.info(
                `Compressing ${idx} / ${missing.size} log${pluralfy(missing.size)}`,
            ),
        interval: 5000,
    })

    for (const id of missing) {
        opts = yield

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

    if (stats.logCount > 0) {
        const sizeRaw = stats.sizeRaw / 1024 / 1024
        const sizeComp = stats.sizeComp / 1024 / 1024
        L.info(
            `Compressed ${stats.logCount} logs (${sizeRaw.toFixed(2)} MiB -> ${sizeComp.toFixed(2)} MiB)`,
        )
    }

    return () => sleep(DELAY)
}
// #endregion

// #region tallyEquips
async function* tallyEquips(opts: TaskOpts): TaskGen {
    const DELAY = 60 * 60 * 1000
    const BATCH_SIZE = 10

    const db = await new LogDb().connect()

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
    let equipTally = (await db.get("kv", "equipTally")) ?? init()

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
            idx: [],
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

    const conn = await db.conn
    const ids = new Set(await conn.getAllKeys("logsMeta"))
    const missing = [...ids.difference(equipTally.done)]

    if (missing.length === 0) {
        if (equipTally.done.size > 0) {
            return () => sleep(DELAY)
        } else {
            return () => sleep(30 * 1000)
        }
    }

    if (equipTally.done.size === 0) {
        equipTally.pending = true
        await db.put("kv", equipTally, "equipTally")
    }

    stats.logCount += missing.length

    let sampleIdx = 0
    const [status, cancelStatus] = throttle({
        fn: () =>
            L.info(`Generating equip tally (${sampleIdx} / ${missing.length})`),
        interval: 5000,
    })

    for (const batch of batched(missing, BATCH_SIZE)) {
        for (const id of batch) {
            opts = yield

            sampleIdx += 1
            status()

            const meta = await opts.logSource.fetchMeta(id)
            const details = await opts.logSource.fetchDetails(id)

            for (const [idx, x] of enumerate(Object.values(details.drops))) {
                if (!x.isEquip) {
                    continue
                }

                equips.id.push(id)
                equips.idx.push(idx)
                equips.name.push(x.name)
                equips.battleTypeId.push(details.meta.battleType?.id ?? null)
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
            }

            equipTally.done.add(id)
        }

        equipTally.equips = await compressZstd({
            x: JSON.stringify(equips),
            level: 10,
            pool: true,
        })
        await db.put("kv", equipTally, "equipTally")
        L.info(
            `Saved equip tally (total: ${equips.id.length} equips / ${equipTally.done.size} logs / ${(equipTally.equips.byteLength / 1024 / 1024).toFixed(2)} MiB compressed)`,
        )
    }

    cancelStatus()

    if (equipTally.pending) {
        equipTally.pending = false
        await db.put("kv", equipTally, "equipTally")
    }

    return () => sleep(DELAY)
}
// #endregion
