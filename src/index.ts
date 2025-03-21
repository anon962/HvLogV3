import { App } from "./lib/app/app"
import { registerLiveStatsToggle } from "./lib/app/registerLiveStatsToggle"

// @todo: compression
// @todo: live stats
// @todo: config (monaco)
// @todo: turn usage (attacks, debuffs, heals, other)
// @todo: profits

async function main() {
    const app = await App.ainit()

    registerLiveStatsToggle(app)
}

main()
