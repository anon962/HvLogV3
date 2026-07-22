import { LogEntry } from "./logDb/schema"
import { EventParser } from "./eventParser"
import { BaseHvEvent, ParserSchema } from "./eventParser"
import { Result } from "myutils"
import { v91 } from "./v91/v91"

export function parseLine<TSchema extends ParserSchema, TName extends string>(
    line: string,
    parsers: Array<EventParser<TSchema, TName>>,
): Result<BaseHvEvent<TSchema, TName>, string[]> {
    const errors: string[] = []

    for (const parser of parsers) {
        const [result, err] = parser.parse(line)
        if (result !== null) {
            // console.debug(line, result)
            return [result, null]
        } else if (err) {
            errors.push(err.detail)
        }
    }

    return [null, errors]
}

export function parseLog(
    logText: string,
    createdAt: Date | null,
): {
    entries: Array<LogEntry<any>>
    versionString: "v91"
    version: typeof v91
    errorCount: number
} {
    // Split log into lines
    const lines = logText.split("\n").flatMap((ln) => {
        ln = ln.trim()
        if (ln.length > 0) {
            return [ln]
        } else {
            return []
        }
    })

    // Pick first version to check
    let toCheck = ["v91" as const]
    let candidate: (typeof toCheck)[number] | undefined = undefined
    if (createdAt) {
        if (createdAt < new Date("2026-06-01")) {
            // candidate = "v90"
        }

        if (candidate) {
            toCheck = toCheck.filter((v) => v !== candidate)
        }
    }

    // Try parsing with each version
    // Return first result with no errors (otherwise one with least)
    let best = {
        entries: null,
        errorCount: Number.POSITIVE_INFINITY,
        versionString: null,
        version: null,
    } as unknown as ReturnType<typeof parseLog>
    while (true) {
        if (!candidate) {
            if (toCheck.length > 0) {
                candidate = toCheck.shift()!
            } else {
                return best
            }
        }

        let v
        switch (candidate) {
            case "v91":
                v = v91
        }

        const entries: Array<LogEntry<any>> = []
        let errorCount = 0
        for (const ln of lines) {
            const [event, errors] = parseLine(ln, v.ALL_PARSERS)
            if (event) {
                entries.push({ type: "event", event })
            } else {
                errorCount += 1
                entries.push({
                    type: "error",
                    detail: errors.length
                        ? errors.join("\n")
                        : `No matching parser for ${ln}`,
                })
            }
        }

        if (errorCount < best.errorCount || errorCount === 0) {
            best = {
                entries,
                errorCount,
                version: v,
                versionString: candidate,
            }
        }

        if (best.errorCount === 0) {
            return best
        }

        candidate = undefined
    }
}
