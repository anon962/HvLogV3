import { createWriteStream } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { parseLog } from "./lib/parseLog"
import {
    DetailsSummary,
    MonsterSummary,
    SearchSummary,
    summarizeSearchStats,
} from "./lib/summary"
import { v91 } from "./lib/v91/v91"

export {}

const write = (x: string) => process.stdout.write(x + "\n")

const __file__ = fileURLToPath(import.meta.url)
const ROOT_DIR = path.dirname(path.dirname(path.dirname(__file__)))
const logDir = path.join(ROOT_DIR, "data", "logs")
const logFile = path.join(logDir, "web_cli.log")
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
    let cmd = {} as any
    try {
        while (true) {
            const stdin = await readLine()
            if (!stdin) {
                return
            }

            cmd = JSON.parse(stdin)
            switch (cmd.type) {
                case "parse": {
                    let result = {
                        events: cmd.events ?? null,
                        details: cmd.details ?? null,
                        search: null,
                        monsters: null,
                    } as any as {
                        events: {
                            entries: any[]
                            versionString: string
                        }
                        details: DetailsSummary
                        search: SearchSummary
                        monsters: MonsterSummary
                    }

                    const stages = new Set<string>(cmd["stages"])
                    if (stages.has("events")) {
                        result.events = getEvents({
                            logText: cmd.log,
                            createdAt: cmd.createdAt,
                        })
                    }
                    if (stages.has("details")) {
                        result.details = v91.summarizeDetails(
                            result.events.entries,
                        )
                    }
                    if (stages.has("search")) {
                        result.search = summarizeSearchStats(
                            result.details,
                            cmd.prices,
                        )
                    }
                    if (stages.has("monsters")) {
                        result.monsters = v91.summarizeMonsters(
                            result.events.entries,
                        )
                    }

                    write(JSON.stringify(result))
                    break
                }
                default:
                    console.error(process.argv)
                    throw new Error(`Unknown command ${cmd}`)
            }
        }
    } catch (e) {
        console.error(e)

        delete cmd["log"]
        delete cmd["events"]
        console.error(cmd)

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
