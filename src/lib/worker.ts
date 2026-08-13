import { LogEntries } from "./db/dbN"
import { parseLog } from "./utils/parseLog"
import { v91 } from "./v91/v91"

export async function parseLogWithDetails(opts: {
    log: string
    createdAt: Date | null
}) {
    const { entries } = parseLog(opts.log, opts.createdAt)
    const details = v91.summarizeDetails(entries as LogEntries<any>)
    return {
        entries,
        details,
    }
}
