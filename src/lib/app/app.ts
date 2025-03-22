import { LogDb } from "../db"
import { BattleLogger } from "./battleLogger"

const STORAGE_KEY = "hvlog_config"

const APP_VERSION = 1

const DEFAULT_CONFIG = () =>
    ({
        version: APP_VERSION,
        enableLiveStats: false,
    } satisfies AppConfig)

export class App {
    public constructor(
        public config: AppConfig,
        public db: LogDb,
        public logger: BattleLogger
    ) {}

    public static async ainit(): Promise<App> {
        const config = App.loadConfig()

        const db = await LogDb.ainit()

        const logger = await BattleLogger.ainit(
            db,
            config.enableLiveStats
        )

        const app = new App(config, db, logger)
        app.dumpConfig()

        return app
    }

    private static loadConfig(): AppConfig {
        // Load string
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === null) {
            const config = DEFAULT_CONFIG()
            return config
        }

        // Parse json
        let config: AppConfig
        try {
            config = JSON.parse(raw)
        } catch (e) {
            console.error(e)
            console.error(raw)
            alert(
                `Invalid HvLog config. Please fix or delete the ${STORAGE_KEY} entry in localStorage.`
            )
            throw new Error("Invalid config")
        }

        // Check version
        if (config.version === APP_VERSION) {
            // @todo: validate?
            return config
        } else {
            console.error(config)
            alert(
                `Invalid HvLog config. Please fix or delete the ${STORAGE_KEY} entry in localStorage.`
            )
            throw new Error("Invalid config")
        }
    }

    dumpConfig() {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(this.config, null, 2)
        )
    }
}

interface AppConfig {
    version: number
    enableLiveStats: boolean
}
