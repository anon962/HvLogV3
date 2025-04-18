import * as latestParsers from "../parsers"
import { v1, v2 } from "./oldVersions"

export async function migrateCompleteLogs(
    logs: any[],
    oldVersion: number
): Promise<any[]> {
    console.debug("Migrating logs from version", oldVersion)

    switch (oldVersion) {
        case 2:
            const result = []

            for (let log of logs as Array<
                v2.CompleteLog | v2.CompressedLog
            >) {
                if (log.compressed) {
                    log = await v2.decompressLog(log)
                }

                result.push(l_2_3(log))
            }

            return result
        case 1:
            return (logs as v1.CompleteLog[]).map((log) => l_1_2(log))
        default:
            throw new Error(
                `Failed to migrate logs from version ${oldVersion}`
            )
    }
}

function l_2_3(log: v1.CompleteLog): v2.CompleteLog {
    return {
        ...log,
        entries: log.entries.map((x) => {
            switch (x.type) {
                case "event":
                default:
                    return x
                case "error":
                    // Try reparsing error lines
                    const line = x.detail.match(
                        "No matching parser for (.*)"
                    )?.[1]
                    if (line) {
                        const p = latestParsers.PARSERS
                        const [result, _] = latestParsers.parseLine(
                            line,
                            [p.AUTO_SALVAGE, p.EXPLOSION]
                        )

                        if (result) {
                            return {
                                type: "event",
                                event: result,
                            }
                        }
                    }

                    return x
            }
        }),
        compressed: false,
    }
}

function l_1_2(log: v1.CompleteLog): v2.CompleteLog {
    return {
        ...log,
        entries: log.entries.map((x) => {
            switch (x.type) {
                case "event":
                default:
                    return x
                case "error":
                    // Try reparsing error lines
                    const line = x.detail.match(
                        "No matching parser for (.*)"
                    )?.[1]
                    if (line) {
                        const p = v2.PARSERS
                        const [result, _] = v2.parseLine(line, [
                            p.POTENCY_GAIN,
                            p.ENCHANT_GAIN,
                            p.DROP_EVENT,
                        ])

                        if (result) {
                            return {
                                type: "event",
                                event: result,
                            }
                        }
                    }

                    return x
            }
        }),
        compressed: false,
    }
}
