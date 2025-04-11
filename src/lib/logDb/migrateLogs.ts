import * as latestParsers from "../parsers"
import * as latest from "./logDb"
import { v1 } from "./oldVersions"

export function migrateCompleteLogs(
    logs: any[],
    oldVersion: number
): any[] {
    console.debug("Migrating logs from version", oldVersion)

    switch (oldVersion) {
        case 1:
            return (logs as v1.CompleteLog[]).map((log) => l_1_2(log))
        default:
            throw new Error(
                `Failed to migrate logs from version ${oldVersion}`
            )
    }
}

function l_1_2(log: v1.CompleteLog): latest.CompleteLog {
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
                            [p.POTENCY_GAIN, p.ENCHANT_GAIN]
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
