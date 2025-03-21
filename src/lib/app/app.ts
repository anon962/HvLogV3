import { BattleLogger } from "./battleLogger"

export class App {
    public constructor(public logger: BattleLogger) {}

    public static async ainit(): Promise<App> {
        const logger = await BattleLogger.ainit()
        return new App(logger)
    }
}
