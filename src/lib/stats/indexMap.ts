import { enumerate } from "@/lib/utils/miscUtils"

export class IndexMap {
    private logToTurn: Map<number, number> = new Map()
    private turnToLog: Map<number, number> = new Map()
    private roundToLog: Map<number, number> = new Map()
    private logToRound: Map<number, number> = new Map()

    constructor(
        public turnIndexes: number[],
        public roundIndexes: Record<number, number>,
        public logSize: number
    ) {
        this.initTurnMap()
        this.initRoundMap()
    }

    private initTurnMap() {
        let lastLogIdx = 0
        let lastTurnIdx = 0
        for (const [turnIdx, logIdx] of enumerate(this.turnIndexes)) {
            this.turnToLog.set(lastTurnIdx, lastLogIdx)
            for (let l = lastLogIdx; l < logIdx; l++) {
                this.logToTurn.set(l, lastTurnIdx)
            }

            lastTurnIdx = turnIdx + 1
            lastLogIdx = logIdx + 1
        }

        this.turnToLog.set(lastTurnIdx, lastLogIdx)
        for (let l = lastLogIdx; l < this.logSize; l++) {
            this.logToTurn.set(l, lastTurnIdx)
        }
    }

    private initRoundMap() {
        for (const [roundIdx, logIdx] of Object.entries(
            this.roundIndexes
        )) {
            this.roundToLog.set(parseInt(roundIdx), logIdx)
            this.logToRound.set(logIdx, parseInt(roundIdx))
        }

        let lastRoundIdx = 1
        for (let l = 0; l < this.logSize; l++) {
            const roundIdx = this.logToRound.get(l)
            if (roundIdx !== undefined) {
                lastRoundIdx = roundIdx
            } else {
                this.logToRound.set(l, lastRoundIdx)
            }
        }
    }

    public l2t(logIdx: number): number {
        return this.logToTurn.get(logIdx)!
    }
    public t2l(turnIdx: number): number {
        return this.turnToLog.get(turnIdx)!
    }

    public l2r(logIdx: number): number {
        return this.logToRound.get(logIdx)!
    }
    public r2l(roundIdx: number): number | undefined {
        return this.roundToLog.get(roundIdx)
    }

    public t2r(turnIdx: number): number | undefined {
        const logIdx = this.t2l(turnIdx)
        return this.l2r(logIdx)
    }
    public r2t(roundIdx: number): number | undefined {
        const logIdx = this.r2l(roundIdx)
        if (!logIdx) {
            return
        }

        return this.l2t(logIdx)
    }
}
