import { CompleteLog, LogId } from "./logDb"
import {
    extractBattleType,
    extractCompletionType,
    extractRoundIndexes,
    extractTurnIndexes,
} from "./stats/summaryStats"

const STORAGE_KEY = "hvlog_stats"
const VERSION = 1

/**
 * Cache for miscellaneous log stats that are at least slightly expensive to calculate.
 */
export class SummaryDb {
    data: StatsStorage

    constructor() {
        this.data = this.load()
    }

    public get(
        log: CompleteLog,
        opts: { save?: boolean } = {}
    ): LogSummary {
        return this.data.data[log.id] ?? this.analyze(log, opts)
    }

    private analyze(
        log: CompleteLog,
        opts: { save?: boolean } = {}
    ): LogSummary {
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

        const analysis = {
            id: log.id,
            completionType,
            battleType,
            round,
            turnIndexes,
            roundIndexes,
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

export interface LogSummary {
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
    data: Record<LogId, LogSummary>
}
