import { sleep, sort } from "radash"
import { LogDb, LogEvent } from "./lib/db"
import { parseLine } from "./lib/parsers"

// @todo: compression
// @todo: monitor
// @todo: config (monaco)

async function main() {
    const db = await LogDb.init()

    const isInBattle = !!document.querySelector("#textlog")
    if (isInBattle) {
        await initialLogScan(db)
        await watchLog(db)
    } else {
        handleIdle()
    }
}

async function initialLogScan(db: LogDb): Promise<void> {
    const logEl = document.querySelector("#textlog > tbody")!

    // Newest to oldest (top to bottom)
    const entries = [...logEl.children]
        .map((el) => el.textContent!)
        .map((text) => parseLogText(text))

    // Check if already seen (page was refreshed)
    if (!db.isNewLine(entries[0])) {
        return
    }

    // Check if new log

    await db.appendToLiveLog(entries.reverse())

    function isNewLog() {}
}

async function watchLog(db: LogDb): Promise<never> {
    const logEl = document.querySelector("#textlog > tbody")!

    const newLines: string[] = []
    const observer = new MutationObserver((records) => {
        const lines = sort(
            records.flatMap(
                (r) => [...r.addedNodes] as HTMLElement[]
            ),
            (el) => el.offsetTop,
            true
        ).map((el) => el.textContent!)
        newLines.push(...lines)
    })
    observer.observe(logEl, {
        childList: true,
        attributes: false,
        characterData: false,
    })

    while (true) {
        const newEntries: LogEvent[] = []
        while (newLines.length) {
            const text = newLines.shift()!
            const entry = parseLogText(text)
            newEntries.push(entry)
        }
        await db.appendToLiveLog(newEntries)

        await sleep(1)
    }
}

function parseLogText(line: string): LogEvent {
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

async function handleIdle(): Promise<void> {}

main()
