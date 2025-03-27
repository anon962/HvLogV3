import { CompleteLog } from "./logDb"
import {
    extractBattleType,
    extractCompletionType,
    extractDrops,
    extractItemUsage,
    extractRoundIndexes,
    extractTurnIndexes,
} from "./statExtractors"
import { IndexMap } from "./ui/hvlog/indexMap"

const STORAGE_KEY = "hvlog_stats"
const VERSION = 1

/**
 * Cache for miscellaneous log stats that are at least slightly expensive to calculate
 * This is mainly for the summaries in LogTable. Most of the real stats are stored by the ChartManager.
 */
export class LogStats {
    data: StatsStorage

    constructor() {
        this.data = this.load()
    }

    public get(
        log: CompleteLog,
        opts: { save?: boolean } = {}
    ): LogAnalysis {
        const raw = this.data.data[log.id] ?? this.analyze(log, opts)

        return {
            ...raw,
            indexMap: new IndexMap(
                raw.turnIndexes,
                raw.roundIndexes,
                log.entries.length
            ),
        }
    }

    private analyze(
        log: CompleteLog,
        opts: { save?: boolean } = {}
    ): RawStats {
        const {
            battleType,
            round,
            inconsistentBattleTypes,
            startCount,
            endCount,
        } = extractBattleType(log)

        const missingStart = !!round && round.end !== startCount

        const turnIndexes = extractTurnIndexes(log)
        const roundIndexes = extractRoundIndexes(log)

        const hasParseError = log.entries.some(
            (entry) => entry.type === "error"
        )

        const completionType = extractCompletionType(log)

        // prettier-ignore
        const missingEnd =
            completionType ?
                completionType === 'finish' ?
                    endCount === startCount :
                    endCount === startCount - 1 :
            false

        const drops = extractDrops(log)

        const itemUsage = extractItemUsage(log)

        const analysis = {
            id: log.id,
            completionType,
            battleType,
            round,
            turnIndexes,
            roundIndexes,
            drops,
            itemUsage,
            errors: {
                parsing: hasParseError,
                inconsistentBattleTypes,
                missingStart,
                missingEnd,
            },
        }

        if (opts.save ?? true) {
            this.data["data"][log.id] = analysis
            this.save()
        }

        return analysis
    }

    private load() {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            return DEFAULT_STORAGE()
        }

        let parsed: StatsStorage
        try {
            parsed = JSON.parse(raw)
        } catch (e) {
            console.error(
                `Error loading ${STORAGE_KEY} from localStorage`,
                raw
            )
            return DEFAULT_STORAGE()
        }

        if (parsed.version !== VERSION) {
            console.error(
                `Wiping outdated log stats. Current version is ${VERSION} but got ${parsed.version}`,
                parsed
            )
            return DEFAULT_STORAGE()
        }

        return parsed
    }

    public save() {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(this.data, null, 2)
        )
    }
}

type LogId = string

export type LogAnalysis = Omit<
    RawStats,
    "turnIndexes" | "roundIndexes"
> & {
    indexMap: IndexMap
}

interface RawStats {
    id: LogId
    completionType: "finish" | "flee" | "die" | null
    battleType:
        | null
        | {
              name: "Item World" | "Grindfest" | "random encounter"
          }
        | {
              name: "Arena"
              id: number
          }
    round: {
        end: number
        max: number
    } | null
    turnIndexes: number[]
    roundIndexes: Record<number, number>
    drops: Record<
        string,
        {
            name: string
            entries: Array<{ logIdx: number; count: number }>
        }
    >
    itemUsage: Record<string, number[]>
    errors: {
        parsing: boolean
        inconsistentBattleTypes: boolean
        missingStart: boolean
        missingEnd: boolean
    }
}

const DEFAULT_STORAGE = () =>
    ({
        version: VERSION,
        data: {},
    } satisfies StatsStorage)

interface StatsStorage {
    version: number
    data: Record<LogId, RawStats>
}
