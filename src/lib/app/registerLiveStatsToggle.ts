import { GM_registerMenuCommand } from "vite-plugin-monkey/dist/client"
import { App } from "./app"

export function registerLiveStatsToggle(app: App) {
    const getCaption = () =>
        app.config.enableLiveStats
            ? "Disable live stats"
            : "Enable live stats"

    GM_registerMenuCommand(
        getCaption(),
        () => {
            app.config.enableLiveStats = !app.config.enableLiveStats
            app.dumpConfig()

            app.logger.stats.setEnabled(app.config.enableLiveStats)

            registerLiveStatsToggle(app)
        },
        {
            id: "live_stats",
            title: "Show graphs while in battle",
        }
    )
}
