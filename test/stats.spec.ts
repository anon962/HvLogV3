import { LogEntry } from "@/lib/logDb"
import { parseLine } from "@/lib/parsers"
import { extractTurnIndexes } from "@/lib/stats/summaryStats"
import { expect, it } from "vitest"
import longLog from "./logs/full.json"

// @ts-ignore
Set.prototype.difference = function (other: Set) {
    const diff = new Set()

    for (const el of this.values()) {
        if (!other.has(el)) {
            diff.add(el)
        }
    }

    return diff
}

it("turn count should be correct", () => {
    const raw = longLog as string[][]
    const rawFlat = raw.flatMap((lns) => lns)

    const { turnIndexes: actualTurnIndexes } = raw.reduce(
        (acc, lns) => {
            if (!lns[0].startsWith("Initializing")) {
                acc.turnIndexes.push(acc.count)
            }

            acc.count += lns.length

            return acc
        },
        { turnIndexes: [] as number[], count: 0 }
    )

    const entries: LogEntry[] = raw
        .flatMap((lns) => lns)
        .map((ln) => {
            const [event, errors] = parseLine(ln)
            return errors
                ? { type: "error", detail: "" }
                : { type: "event", event }
        })

    const turnIndexes = extractTurnIndexes({
        id: "",
        meta: { lastUpdate: "", start: "" },
        entries,
    })

    const missing = new Set(actualTurnIndexes).difference(
        new Set(turnIndexes)
    )
    missing.forEach((idx) =>
        console.log("missing", idx, rawFlat[idx], entries[idx])
    )
    expect(missing.size).toEqual(0)

    const extraneous = new Set(turnIndexes).difference(
        new Set(actualTurnIndexes)
    )
    extraneous.forEach((idx) =>
        console.log("extraneous", idx, rawFlat[idx], entries[idx])
    )
    expect(extraneous.size).toEqual(0)
})
