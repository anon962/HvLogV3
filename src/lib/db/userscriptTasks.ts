import { L, last, sleep } from "myutils"
import { UserscriptConfig } from "./userscriptConfig"

type TaskOpts = {
    config: UserscriptConfig
    setConfig: (config: Partial<UserscriptConfig>) => void
}
type _TaskOpts = TaskOpts & {
    cancel: boolean
}

export function runUserscriptTasks(opts: TaskOpts) {
    const optsResolved = {
        ...opts,
        cancel: false,
    }

    pollPrices(optsResolved)

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

async function pollPrices(opts: _TaskOpts) {
    const DELAY = 86400 * 1000

    const source =
        opts.config.priceSource === "default"
            ? "hvdata"
            : opts.config.priceSource
    if (source === "none") {
        return
    }

    while (!opts.cancel) {
        if (!isIdle()) {
            sleep(5 * 60 * 1000)
            continue
        }

        const now = new Date()
        const updatedAt = new Date(opts.config.prices.updatedAt)
        const rem = updatedAt.getTime() + DELAY - now.getTime()
        if (rem > 0) {
            await sleep(rem + 50)
            continue
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
    }
}
