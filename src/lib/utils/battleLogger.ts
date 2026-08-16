import {
    observeMutations,
    range,
    readUrl,
    resolveSequential,
    sort,
    uuidWithFallback,
    waitEvent,
} from "myutils"
import { LogDb } from "../db/db"
import { DbN } from "../db/dbN"

/**
 * happy path:
 *   1. page load
 *   2. attach logger
 *   3. first log scan
 *   4. player action / log append
 *   5. mutation obs triggers scan
 *   6. (... steps 4-5 ...)
 *   7. back to 1 after round end triggers DOMContentLoad
 *      (mb and jpx should trigger this event on ajax load)
 *
 * logger is always loaded, even out of battle, in which case logs get flushed from localstorage to idb
 *
 * all this assumes the log only contains one turn on page load (possibly already-logged)
 */
export class BattleLogger {
    db: LogDb

    constructor(
        public opts: {
            world: DbN.HvWorld
        },
    ) {
        this.db = new LogDb({
            world: this.opts.world,
        })
    }

    private async *watchLog(opts: {
        logEl: HTMLElement
    }): AsyncGenerator<{ idx: number; lines: string[]; isBattleEnd: boolean }> {
        let rows: HTMLElement[]

        let idx = 0
        rows = [...opts.logEl.querySelectorAll("tr")] as HTMLElement[]
        yield {
            idx,
            lines: parse(rows),
            isBattleEnd: this.isBattleEnd(),
        }
        idx += 1

        for await (const records of observeMutations({
            el: opts.logEl,
            obsOpts: {
                childList: true,
                attributes: false,
                characterData: false,
            },
            timeout: 1000,
        })) {
            if (records === null) {
                continue
            }

            yield {
                idx,
                lines: parse(
                    records
                        .flatMap((r) => [...r.addedNodes])
                        .filter((x) => x instanceof HTMLElement)
                        .filter((el) => el.tagName === "TR"),
                ),
                isBattleEnd: this.isBattleEnd(),
            }
            idx += 1
        }

        function parse(els: HTMLElement[]): string[] {
            return sort(els, (el) => el.offsetTop, true)
                .map((el) => el.textContent?.trim())
                .filter((ln) => ln?.length > 0)
        }
    }

    async attach(): Promise<void> {
        const hvlog_live = DbN.readLocalStorage(
            this.opts.world === "persistent"
                ? "hvlog_live"
                : "hvlog_live_isekai",
            (raw) => JSON.parse(raw),
        ) ?? {
            current: null,
            complete: {},
        }

        let done = false
        waitEvent({
            targets: [
                // { el: window, eventId: "hvlog:urlchange" as any },
                // { el: window, eventId: "popstate" },
                { el: document, eventId: "DOMContentLoaded" },
            ],
        }).then(() => {
            done = true
            this.attach()
        })

        const logEl = document.querySelector(
            "#textlog tbody",
        ) as HTMLElement | null
        if (!!logEl && !this.isBattleEnd()) {
            for await (const { idx, lines, isBattleEnd } of this.watchLog({
                logEl,
            })) {
                if (done || !logEl.isConnected) {
                    break
                }

                const curr = hvlog_live.current ?? {
                    id: uuidWithFallback(),
                    startedAt: new Date().toISOString(),
                    turnCount: 0,
                    prevTurn: null,
                }

                // Dupes should only happen when user refreshes (idx === 0)
                // This should always slice lines to empty array
                //   but I guess its possible for logger init to be delayed long enough for a turn to happen
                let linesDeduped = lines
                if (idx === 0 && curr.prevTurn) {
                    if (lines[0] === curr.prevTurn.first) {
                        linesDeduped = lines.slice(curr.prevTurn.length)
                    }
                }
                if (linesDeduped.length === 0) {
                    continue
                }

                const rowId = `${curr.id}_${curr.turnCount}` as const
                this.db.put(
                    "live",
                    {
                        logId: curr.id,
                        lines: linesDeduped,
                    },
                    rowId,
                )

                hvlog_live.current = {
                    ...curr,
                    updatedAt: new Date().toISOString(),
                    turnCount: curr.turnCount + 1,
                    prevTurn: {
                        first: linesDeduped[0],
                        length: linesDeduped.length,
                    },
                }

                if (isBattleEnd) {
                    this.flushComplete(hvlog_live)
                    break
                } else {
                    this.writeLive(hvlog_live)
                }
            }
        } else if (readUrl().parts[0] === "hvlog") {
            resolveSequential(
                Object.values(hvlog_live.complete).map(
                    (log) => () =>
                        this.persistComplete(
                            this.db,
                            this.opts.world,
                            hvlog_live,
                            log,
                            () => done,
                        ),
                ),
            )
            return
        } else if (!!document.querySelector("#riddlemaster")) {
            return
        } else {
            this.flushComplete(hvlog_live)
            resolveSequential(
                Object.values(hvlog_live.complete).map(
                    (log) => () =>
                        this.persistComplete(
                            this.db,
                            this.opts.world,
                            hvlog_live,
                            log,
                            () => done,
                        ),
                ),
            )
        }
    }

    private flushComplete(hvlog_live: DbN.HvLogLive) {
        const { current } = hvlog_live
        if (current) {
            hvlog_live.current = null
            hvlog_live.complete[current.id] = {
                id: current.id,
                startedAt: current.startedAt,
                endedAt: current.updatedAt,
                turnCount: current.turnCount,
            }
            this.writeLive(hvlog_live)
            console.debug("flush complete", current.id, hvlog_live)
        }
    }

    private writeLive(update: DbN.HvLogLive) {
        DbN.writeLocalStorage(
            this.opts.world === "persistent"
                ? "hvlog_live"
                : "hvlog_live_isekai",
            update,
        )
    }

    private async persistComplete(
        db: LogDb,
        world: DbN.HvWorld,
        hvlog_live: DbN.HvLogLive,
        log: DbN.HvLogLive["complete"][DbN.LogId],
        done: () => boolean,
    ) {
        const txn = await db.transaction(
            ["live", "logsMeta", "logsRaw"],
            "readwrite",
        )
        if (done() || !(log.id in hvlog_live.complete)) {
            txn.abort()
            console.debug("abort persist", log.id, hvlog_live)
            return
        }

        console.debug("persist", log.id, hvlog_live)
        const liveKeys = range(log.turnCount).map(
            (idx) => `${log.id}_${idx}` as const,
        )
        const turns = (
            await Promise.all(
                liveKeys.map((key) => txn.objectStore("live").get(key)),
            )
        ).filter((x) => x !== undefined)

        let missingTurns = turns.length < liveKeys.length
        if (missingTurns) {
            console.error(
                `Missing ${liveKeys.length - turns.length} turns in log`,
            )
        }

        await txn.objectStore("logsRaw").put({
            id: log.id,
            compressed: 0,
            raw: turns.flatMap(({ lines }) => lines).join("\n"),
            raw_c: null,
        })
        await txn.objectStore("logsMeta").put({
            id: log.id,
            startedAt: log.startedAt,
            endedAt: log.endedAt,
            world,
            user_id: null,
            user_name: null,
            errors: {
                missingTurns,
            },
        })
        await Promise.all(
            liveKeys.map((k) => txn.objectStore("live").delete(k)),
        )
        txn.commit()

        DbN.broadcastIdbEvent({
            type: "hvlog_log_insert",
            ids: [log.id],
            world,
        })
        delete hvlog_live.complete[log.id]
        this.writeLive(hvlog_live)
    }

    private isBattleEnd() {
        // Should probably include this check in the mutation observer
        // but only a problem if multiple mutations are in the backlog
        // at which point we probably have bigger problems
        return !!document
            .querySelector<HTMLImageElement>("#btcp img")
            ?.src.includes("finishbattle")
    }
}
