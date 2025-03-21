import { last, sleep, sort } from "radash"
import { ChartManager } from "../charts/chartManager"
import { HealChart } from "../charts/healChart"
import { LogDb, LogEntry, LogHash } from "../db"
import { isEventFrom, parseLine, PARSERS } from "../parsers"

export class BattleLogger {
    stats: ChartManager

    constructor(public db: LogDb) {
        this.stats = new ChartManager()
        this.stats.addChart(new HealChart("heals"))
        window.addEventListener("beforeunload", () =>
            this.stats.save()
        )
    }

    public static async ainit(): Promise<BattleLogger> {
        const logger = new BattleLogger(await LogDb.ainit())
        await logger.attach()
        return logger
    }

    private async attach(): Promise<void> {
        if (!!document.querySelector("#riddlemaster")) {
            return
        } else if (!!document.querySelector("#textlog")) {
            while (true) {
                await this.initialLogScan()
                await this.watchLog()
            }
        } else {
            // out of combat
            await this.db.flushLiveLog()
        }
    }

    private async initialLogScan(): Promise<void> {
        const logEl = document.querySelector("#textlog > tbody")!

        // Newest to oldest (top to bottom)
        const entries = [...logEl.children]
            .map((el) => el.textContent!)
            .map((text) => this.parseLogText(text))

        // Check if already seen (page was refreshed)
        if (!(await this.db.isNewLine(entries[0]))) {
            console.debug(
                "Ignoring dupe log lines (page was refreshed)"
            )
            return
        }

        // Check if new log
        const oldHash = await this.db.getLogHash()
        const lst = last(entries)!
        if (
            lst.type === "event" &&
            isEventFrom(lst.event, PARSERS.ROUND_START)
        ) {
            const hash: LogHash = {
                currentRound: lst.event.current,
                maxRound: lst.event.max,
                battleType: lst.event.battle_type,
            }

            if (oldHash.battleType === "") {
                // Old log doesn't have hash yet
                // (fresh install + mid-battle)
                await this.db.putLogHash(hash)
            } else if (!isSameBattle(hash, oldHash)) {
                await this.db.putLogHash(hash)
                await this.db.flushLiveLog()
                this.stats.clear()
            } else {
                await this.db.putLogHash(hash)
            }
        }

        // Add new entries
        console.debug("Resuming log")
        await this.appendLogEntries(entries.reverse())

        function isSameBattle(curr: LogHash, prev: LogHash) {
            return (
                curr.battleType === prev.battleType &&
                curr.maxRound === prev.maxRound &&
                curr.currentRound >= prev.currentRound
            )
        }
    }

    private async watchLog(): Promise<void> {
        const logEl = document.querySelector("#textlog > tbody")!

        const newLines: string[] = []
        const observer = new MutationObserver((records) => {
            const lines = sort(
                records.flatMap(
                    (r) => [...r.addedNodes] as HTMLElement[]
                ),
                (el) => el.offsetTop,
                true
            )
                .map((el) => el.textContent!)
                .filter((text) => text.length > 0)
            newLines.push(...lines)
        })
        observer.observe(logEl, {
            childList: true,
            attributes: false,
            characterData: false,
        })

        let isActive = true
        const onSoftRefresh = () => {
            console.debug("Recreating observer")
            isActive = false
            observer.disconnect()
            document.removeEventListener(
                "DOMContentLoaded",
                onSoftRefresh
            )
        }
        document.addEventListener("DOMContentLoaded", onSoftRefresh)

        while (isActive) {
            const newEntries: LogEntry[] = []
            while (newLines.length) {
                const text = newLines.shift()!
                const entry = this.parseLogText(text)
                newEntries.push(entry)
            }

            if (newEntries.length) {
                await this.appendLogEntries(newEntries)
            }

            await sleep(1)
        }
    }

    private async appendLogEntries(entries: LogEntry[]) {
        for (const entry of entries) {
            if (entry.type === "event") {
                this.stats.append(entry.event)
            }
        }

        await this.db.appendToLiveLog(entries)
    }

    private parseLogText(line: string): LogEntry {
        const [event, errors] = parseLine(line)
        return event
            ? { type: "event", event }
            : {
                  type: "error",
                  detail: errors.length
                      ? errors.join("\n")
                      : `No matching parser for ${line}`,
              }
    }
}
