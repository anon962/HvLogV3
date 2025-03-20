import { sort, sum } from "radash"
import data from "../../test/logs/full.json"
import { parseLine } from "../lib/parsers"

const start = performance.now()

const tally = (data as string[][])
    .flatMap((lines) => lines)
    .map((ln) => parseLine(ln))
    .reduce((acc, [x]) => {
        if (!x) {
            return acc
        }

        acc[x.event_type] = acc[x.event_type] ?? 0
        acc[x.event_type] += 1

        return acc
    }, {} as Record<string, number>)

const elapsed = performance.now() - start

const sorted = Object.fromEntries(
    sort(Object.entries(tally), (kv) => kv[1], true)
)
console.log(JSON.stringify(sorted, null, 2))

const n = sum(Object.values(tally))
console.log(
    `Parsed ${n} lines in ${Math.trunc(elapsed)}ms (${Math.trunc(
        n / elapsed
    )} lines per ms)`
)
