import path from "path"
import { CompleteLog, LogEntry } from "./lib/logDb/schema"
import { parseLog } from "./lib/parseLog"
import { v91 } from "./lib/v91/v91"
import { createWriteStream } from "fs"
import { fileURLToPath } from "url"
import { SearchSummary, summarizeSearchStats } from "./lib/searchSummary"
import { summarizeFinances } from "./lib/stats/dropStats"
import { DetailsSummary } from "./lib/detailsSummary"

export {}

const write = (x: string) => process.stdout.write(x + "\n")

const __file__ = fileURLToPath(import.meta.url)
const ROOT_DIR = path.dirname(path.dirname(path.dirname(__file__)))
const logFile = path.join(
    // process.cwd(),
    // "web_cli.log",
    ROOT_DIR,
    "data",
    "logs",
    "web_cli.log",
)
const logStream = createWriteStream(logFile, { flags: "a", flush: true })

for (const level of ["log", "info", "warn", "debug", "error"] as const) {
    console[level] = (...args: unknown[]) => {
        const now = new Date().toISOString()

        logStream.write(
            `[${level.toUpperCase().padEnd(5)}] [${now}] - ` +
                args
                    .map((x) => {
                        try {
                            return JSON.stringify(x)
                        } catch (e) {
                            return String(x)
                        }
                    })
                    .join(" ") +
                "\n",
        )
    }
}
console.log(
    path.join(
        // process.cwd(),
        ROOT_DIR,
        "data",
        "logs",
        "web_cli.log",
    ),
)

async function main() {
    try {
        while (true) {
            const stdin = await readLine()
            if (!stdin) {
                return
            }

            const cmd = JSON.parse(stdin)
            console.log(cmd["type"], "start")
            switch (cmd.type) {
                case "parse": {
                    let result = {
                        events: cmd.events ?? null,
                        details: cmd.details ?? null,
                        search: cmd.search ?? null,
                    } as any as {
                        events: {
                            entries: any[]
                            versionString: string
                        }
                        details: Omit<DetailsSummary, "indexMap" | "finances">
                        search: SearchSummary
                    }

                    const stages = new Set<string>(cmd["stages"])
                    if (stages.has("events")) {
                        result.events = getEvents({
                            logText: cmd.log,
                            createdAt: cmd.createdAt,
                        })
                    }
                    if (stages.has("details")) {
                        result.details = getDetailsSummary({
                            version: result.events.versionString,
                            entries: result.events.entries,
                        })
                    }
                    if (stages.has("search")) {
                        result.search = getSearchSummary({
                            details: result.details,
                            prices: cmd.prices,
                        })
                    }

                    write(JSON.stringify(result))
                    break
                }
                default:
                    console.error(process.argv)
                    throw new Error(`Unknown command ${cmd}`)
            }
            console.log(cmd["type"], "end")
        }
    } catch (e) {
        console.error(e)
        write("")
        throw e
    }
}

function getEvents(opts: { logText: string; createdAt?: string }) {
    let createdAtDate: Date | null = null
    if (opts.createdAt) {
        createdAtDate = new Date(opts.createdAt)
    }

    return parseLog(opts.logText, createdAtDate)
}

function getDetailsSummary(opts: {
    version: string
    entries: Array<LogEntry<any>>
}) {
    const log: CompleteLog<any> = {
        id: "",
        meta: {
            start: "",
            lastUpdate: "",
            version: 0,
            world: "persistent",
        },
        entries: opts.entries,
    }

    return v91.summarize(log)
}

function getSearchSummary(opts: {
    details: Omit<DetailsSummary, "finances" | "indexMap">
    prices: Record<string, number>
}) {
    const finances = summarizeFinances(
        opts.details.meta,
        opts.details.drops,
        opts.details.usage,
        opts.prices,
    )
    return summarizeSearchStats({ ...opts.details, finances })
}

async function readLine(): Promise<string> {
    let buffer = ""
    return new Promise((resolve) => {
        const onData = (chunk: Buffer) => {
            const idx = chunk.indexOf(10) // '\n'
            if (idx !== -1) {
                cleanup()
                process.stdin.pause()
                buffer += chunk.toString("utf-8")
                const nl = buffer.indexOf("\n")
                resolve(buffer.slice(0, nl))
                buffer = buffer.slice(nl + 1)
            } else {
                buffer += chunk.toString("utf-8")
            }
        }
        const onEnd = () => {
            cleanup()
            resolve(buffer)
        }
        const cleanup = () => {
            process.stdin.off("data", onData)
            process.stdin.off("end", onEnd)
        }
        process.stdin.on("data", onData)
        process.stdin.on("end", onEnd)
        process.stdin.resume()
    })
}

await main()
