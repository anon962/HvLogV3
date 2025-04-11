import { CompleteLog, LogId } from "./logDb/logDb"
import {
    extractBattleType,
    extractCompletionType,
    extractRoundIndexes,
    extractTurnIndexes,
} from "./stats/summaryStats"

const STORAGE_KEY = "hvlog_stats"
const VERSION = 2

/**
 * Cache for miscellaneous log stats that are at least slightly expensive to calculate.
 */
export class SummaryDb {
    data: StatsStorage

    constructor() {
        this.data = this.load()
    }

    public get(log: CompleteLog, opts: { save?: boolean } = {}) {
        return this.getMaybe(log.id) ?? this.analyze(log, opts)
    }

    public getMaybe(id: LogId): LogSummary | null {
        return this.data.data[id] ?? null
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
            start: log.meta.start,
            lastUpdate: log.meta.lastUpdate,
            completionType,
            battleType,
            round,
            turnIndexes,
            roundIndexes,
            numEvents: log.entries.length,
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
            console.log(
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
    start: string
    lastUpdate: string
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
        | {
              name: "Tower"
              floor: number
          }
    round: {
        end: number
        max: number
    } | null
    turnIndexes: number[]
    roundIndexes: Record<number, number>
    numEvents: number
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
