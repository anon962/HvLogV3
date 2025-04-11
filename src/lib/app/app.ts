import { clone } from "radash"
import { LogDb } from "../logDb/logDb"
import { DEFAULT_CONFIG } from "../ui/constants"
import { BattleLogger } from "./battleLogger"

export const APP_CONFIG_KEY = "hvlog_config"
export const APP_CONFIG_VERSION = 1

export interface AppConfig {
    equipFilters: string[]
    prices: Record<string, number>
}

export class App {
    public constructor(
        public config: AppConfig,
        public userConfig: Partial<AppConfig>,
        public db: LogDb,
        public logger: BattleLogger
    ) {}

    public static async ainit(): Promise<App> {
        const { config, userConfig } = App.loadConfig()
        console.debug("Using config", config)

        const db = await LogDb.ainit()

        const logger = await BattleLogger.ainit(db, false)

        const app = new App(config, userConfig, db, logger)

        return app
    }

    public async runLogger() {
        await this.logger.attach()
    }

    private static loadConfig() {
        let userConfig: Partial<AppConfig> = {}

        const defaultConfig: AppConfig = clone(DEFAULT_CONFIG)

        // Load string
        const raw = localStorage.getItem(APP_CONFIG_KEY)
        if (raw === null) {
            return { config: defaultConfig, userConfig }
        }

        // Parse json
        let version: number
        try {
            ;({ config: userConfig, version } = JSON.parse(raw))
        } catch (e) {
            console.error(e)
            console.error(raw)
            alert(
                `Invalid HvLog config. Please fix or delete the ${APP_CONFIG_KEY} entry in localStorage.`
            )
            throw new Error("Invalid config")
        }

        // Check version
        // @todo: validate?
        if (version !== APP_CONFIG_VERSION) {
            console.error(userConfig)
            alert(
                `Invalid HvLog config. Please fix or delete the ${APP_CONFIG_KEY} entry in localStorage.`
            )
            throw new Error("Invalid config")
        }

        const config = {
            ...defaultConfig,
            ...userConfig,

            prices: {
                ...defaultConfig.prices,
                ...userConfig.prices,
            },
        }

        return { config, userConfig }
    }
}
