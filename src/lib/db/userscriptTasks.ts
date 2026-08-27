import {
    batched,
    enumerate,
    L,
    last,
    objectEntries,
    objectKeys,
    pluralfy,
    sleep,
    sort,
    throttle,
} from "myutils"
import { HV_WORLDS, HVDATA_URL, LOG_PROCESSING_LOCK } from "../constants"
import { EquipPageN } from "../ui/hvlog/equipsPage"
import { compressZstd, decompressZstd } from "../utils/miscUtils"
import { LOG_DB_CACHE, LogDb } from "./db"
import { DbN } from "./dbN"
import { LogSourceN } from "./logSourceN"
import { UserscriptConfig } from "./userscriptConfig"

const TASKS: Array<(opts: TaskOpts) => TaskGen> = [
    pollPrices,
    populateSearch,
    compressLogs,
    tallyEquips,
    trimDetailsCache,
]
const ACTIVE_TASK = {
    task: null as TaskGen | null,
    idx: -1,
}
export const TASK_DATA: Array<{
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
            const lock = await LOG_PROCESSING_LOCK.acquire()
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
                    if (e instanceof Error) {
                        L.error(e.stack)
                    }
                    L.error(e, ACTIVE_TASK)
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
                lock?.release()
            }
        }
    }

    poll()
    return () => {
        isCancelled = true

        // Causes (non-infinite) echo
        // TASK_DATA[TASKS.findIndex((x) => x === pollPrices)].delay = null

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
                        `${HVDATA_URL}/api/fapspreader.json?is_isekai=${world === "isekai" ? 1 : 0}`,
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

    const existing = new Set(await db.getAllKeys("logsMeta"))
    const done = (await db.get("kv", "compressDone")) ?? new Set<string>()
    const missing = existing.difference(done)
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
    const init: () => Promise<EquipTally> = async () => ({
        version: LogDb.parserVersion,
        done: new Set(),
        equips: await compressZstd({
            x: JSON.stringify({
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
            }),
            level: 10,
            pool: false,
        }),
        pending: false,
    })
    let equipTally = await db.get("kv", "equipTally")
    if (!equipTally || equipTally.version < LogDb.parserVersion) {
        equipTally = await init()
        await db.put("kv", equipTally, "equipTally")
    }

    const decompressed = await decompressZstd({ x: equipTally.equips })
    const text = await new Blob([decompressed]).text()
    const equips: EquipPageN.IdbStorage = JSON.parse(text)

    const deleted = await db.get("kv", "equipDeletions")
    if (deleted?.size) {
        const txn = await db.transaction(["kv"], "readwrite")
        const deadIdxs = new Set(
            equips.id.flatMap((id, idx) => (deleted.has(id) ? [idx] : [])),
        )
        for (const kv of objectEntries(equips)) {
            equips[kv[0]] = kv[1].filter((_, idx) => !deadIdxs.has(idx)) as any
        }
        await txn.objectStore("kv").put(new Set(), "equipDeletions")
        txn.commit()

        equipTally.equips = await compressZstd({
            x: JSON.stringify(equips),
            level: 10,
            pool: true,
        })
        await db.put("kv", equipTally, "equipTally")
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

        await trimDetailsCache(opts).next()
    }

    cancelStatus()

    if (equipTally.pending) {
        equipTally.pending = false
        await db.put("kv", equipTally, "equipTally")
    }

    return () => sleep(DELAY)
}
// #endregion

// #region trimDetailsCache
async function* trimDetailsCache(opts: TaskOpts): TaskGen {
    const DELAY = 5 * 60 * 1000
    const SOFT_SIZE_CAP = 50
    const HARD_SIZE_CAP = 100
    const MIN_TTL = 15 * 60 * 1000

    const db = await new LogDb().connect()

    const idsEntries = new Set(await db.getAllKeys("entriesCache"))
    const idsDetails = new Set(await db.getAllKeys("summariesForDetails"))
    const ids = idsEntries.union(idsDetails)

    const cache = LOG_DB_CACHE()
    const history = await cache.detailsCacheHistory

    let mode, overflowCount

    if (ids.size > HARD_SIZE_CAP) {
        mode = "hard"
        overflowCount = ids.size - HARD_SIZE_CAP
    } else if (ids.size > SOFT_SIZE_CAP) {
        mode = "soft"
        overflowCount = ids.size - SOFT_SIZE_CAP
    } else {
        return () => sleep(DELAY)
    }

    let candidates: Array<{ id: DbN.LogId; age: number }> = []
    const now = new Date().getTime()
    for (const id of ids) {
        let lastFetch = 0
        if (id in history) {
            lastFetch = new Date(history[id].lastFetch).getTime()
        }

        const age = now - lastFetch
        if (age > MIN_TTL || mode === "hard") {
            candidates.push({ id, age })
        }
    }
    candidates = sort(candidates, (x) => x.age, true)

    const overflow = candidates.slice(0, overflowCount)
    L.info(`Evicting ${overflow.length} logs from entries + details caches`)
    for (const { id } of overflow) {
        const txn = await db.transaction(
            ["entriesCache", "summariesForDetails"],
            "readwrite",
        )
        if (await txn.objectStore("entriesCache").getKey(id)) {
            txn.objectStore("entriesCache").delete(id)
        }
        if (await txn.objectStore("summariesForDetails").getKey(id)) {
            txn.objectStore("summariesForDetails").delete(id)
        }

        delete history[id]
        cache.deetsHistoryChangeCount += 1
    }

    for (const id of objectKeys(history)) {
        if (!ids.has(id)) {
            delete history[id]
            cache.deetsHistoryChangeCount += 1
        }
    }

    await cache.flushDetailsCacheHistory()
    return () => sleep(DELAY)
}
// #endregion

// #region populateSearch
async function* populateSearch(opts: TaskOpts): TaskGen {
    const DELAY = 5 * 60 * 1000

    const db = await new LogDb().connect()
    const cache = LOG_DB_CACHE()

    let searchDone = await db.get("kv", "searchDone")
    if (!searchDone || searchDone.version !== LogDb.parserVersion) {
        searchDone = {
            version: LogDb.parserVersion,
            done: new Set(),
            pending: true,
        }
    }

    const ids = new Set(await db.getAllKeys("logsMeta"))
    const missing = new Set(ids).difference(searchDone.done)
    if (missing.size === 0) {
        return () => sleep(DELAY)
    }

    let idx = -1
    const [pbar, cancelPbar] = throttle({
        fn: () =>
            L.info(
                `Generating search cache (${idx + 1} / ${missing.size}) ...`,
            ),
        interval: 5000,
    })

    if (!searchDone.pending) {
        searchDone.pending = true
        await db.put("kv", searchDone, "searchDone")
    }

    const batches = batched([...missing], 50)
    for (const batch of batches) {
        opts = yield

        for (const id of batch) {
            idx += 1
            pbar()

            await cache.metaSearchCache.fetch({
                id,
                prices: opts.config.prices,
            })
            searchDone.done.add(id)
        }

        searchDone.pending = batch !== last(batches)!
        await db.put("kv", searchDone, "searchDone")

        await trimDetailsCache(opts).next()
    }

    L.info(`Added ${missing.size} logs to search cache`)
    cancelPbar()
    return () => sleep(DELAY)
}
// #endregion
