import { createWriteStream } from "fs"
import { L } from "myutils"
import path from "path"
import { fileURLToPath } from "url"
import {
    DetailsSummary,
    MonsterSummary,
    SearchSummary,
    summarizeSearchStats,
} from "./lib/stats/summary"
import { parseLog } from "./lib/utils/parseLog"
import { v91 } from "./lib/v91/v91"
import {
    init as zstdWasmInit,
    compress as zstdWasmCompress,
} from "@bokuweb/zstd-wasm"

export {}

const write = (x: string) => process.stdout.write(x + "\n")

const __file__ = fileURLToPath(import.meta.url)
const ROOT_DIR = path.dirname(path.dirname(path.dirname(__file__)))
const logDir = path.join(ROOT_DIR, "data", "logs")
const logFile = path.join(logDir, "web_cli.log")
const logStream = createWriteStream(logFile, { flags: "a", flush: true })

L.patchConsole()
L.sinks["cli"] = {
    disabled: false,
    call: (level, msg, ...rest) => {
        const now = new Date().toISOString()
        logStream.write(
            `[${level.toUpperCase().padEnd(5)}] [${now}] - ` +
                [msg, ...rest]
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
    },
}
L.log(
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
                    handleParse(cmd)
                    break
                }
                case "compress": {
                    await handleCompress(cmd)
                    break
                }
                default:
                    L.error(process.argv)
                    throw new Error(`Unknown command ${cmd.type}`)
            }
        }
    } catch (e) {
        L.error(e)

        delete cmd["log"]
        delete cmd["events"]
        L.error(cmd)

        write("")
        throw e
    }
}

function handleParse(cmd: any) {
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
        let createdAtDate: Date | null = null
        if (cmd.createdAt) {
            createdAtDate = new Date(cmd.createdAt)
        }

        result.events = parseLog(cmd.log, createdAtDate)
    }
    if (stages.has("details")) {
        result.details = v91.summarizeDetails(result.events.entries)
    }
    if (stages.has("search")) {
        result.search = summarizeSearchStats(result.details, cmd.prices)
    }
    if (stages.has("monsters")) {
        result.monsters = v91.summarizeMonsters(result.events.entries)
    }

    write(JSON.stringify(result))
}

await zstdWasmInit()
async function handleCompress(cmd: { data: string }) {
    const dataBytes = new TextEncoder().encode(cmd.data)
    const result = window.zstdWasm.compress(dataBytes, 19)
    // const result = await compressGzip(cmd.data)

    const result64 = Buffer.from(result).toString("base64")
    write(result64)
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
