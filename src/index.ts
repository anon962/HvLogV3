import { last, sleep, sort } from "radash"
import { ChartManager } from "./lib/charts/chartManager"
import { HealChart } from "./lib/charts/healChart"
import { LogDb, LogEntry, LogHash } from "./lib/db"
import { isEventFrom, parseLine, PARSERS } from "./lib/parsers"

// @todo: compression
// @todo: live stats
// @todo: config (monaco)
// @todo: turn usage (attacks, debuffs, heals, other)
// @todo: profits

const stats = new ChartManager()
stats.addChart(new HealChart("heals"))
window.addEventListener("beforeunload", () => stats.save())

async function main() {
    const db = await LogDb.init()

    if (!!document.querySelector("#riddlemaster")) {
        return
    } else if (!!document.querySelector("#textlog")) {
        await initialLogScan(db)
        await watchLog(db)
    } else {
        await handleOutOfCombat(db)
    }
}

async function initialLogScan(db: LogDb): Promise<void> {
    const logEl = document.querySelector("#textlog > tbody")!

    // Newest to oldest (top to bottom)
    const entries = [...logEl.children]
        .map((el) => el.textContent!)
        .map((text) => parseLogText(text))

    // Check if already seen (page was refreshed)
    if (!(await db.isNewLine(entries[0]))) {
        console.debug("Ignoring dupe log lines (page was refreshed)")
        return
    }

    // Check if new log
    const oldHash = await db.getLogHash()
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
            await db.putLogHash(hash)
        } else if (!isSameBattle(hash, oldHash)) {
            await db.putLogHash(hash)
            await db.flushLiveLog()
            stats.clear()
        } else {
            await db.putLogHash(hash)
        }
    }

    // Add new entries
    console.debug("Resuming log")
    await appendLogEntries(db, entries.reverse())

    function isSameBattle(curr: LogHash, prev: LogHash) {
        return (
            curr.battleType === prev.battleType &&
            curr.maxRound === prev.maxRound &&
            curr.currentRound >= prev.currentRound
        )
    }
}

async function watchLog(db: LogDb): Promise<void> {
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
        initialLogScan(db).then(() => watchLog(db))
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
            const entry = parseLogText(text)
            newEntries.push(entry)
        }

        if (newEntries.length) {
            await appendLogEntries(db, newEntries)
        }

        await sleep(1)
    }
}

function parseLogText(line: string): LogEntry {
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

async function handleOutOfCombat(db: LogDb): Promise<void> {
    await db.flushLiveLog()
}

async function appendLogEntries(db: LogDb, entries: LogEntry[]) {
    for (const entry of entries) {
        if (entry.type === "event") {
            stats.append(entry.event)
        }
    }

    await db.appendToLiveLog(entries)
}

main()
