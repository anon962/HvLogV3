import {
    App,
    APP_CONFIG_KEY,
    APP_CONFIG_VERSION,
    AppConfig,
} from "@/lib/app/app"
import { clone } from "radash"
import { createContext, ReactNode, useContext, useState } from "react"

const ctx = createContext<ReturnType<typeof initContext>>(null as any)

export function SettingsFormProvider(props: {
    app: App
    children: ReactNode
}) {
    const value = initContext(props.app)
    return <ctx.Provider value={value}>{props.children}</ctx.Provider>
}

function initContext(app: App) {
    const [settings, setSettings] = useState<FormValue>({
        equipFilters: ["", ""],
        prices: {},
        ...clone(app.userConfig),
    })

    return {
        settings,
        setSettings,
        clearSettings: () => {
            setSettings({
                equipFilters: ["", ""],
                prices: {},
            })
        },
        submit: () => {
            const userConfig = resolveSettings(settings)

            const asStr = JSON.stringify(
                {
                    version: APP_CONFIG_VERSION,
                    config: userConfig,
                },
                null,
                2
            )
            console.debug("Saving config", asStr)

            localStorage.setItem(APP_CONFIG_KEY, asStr)
        },
    }
}

export function useSettingsForm() {
    return useContext(ctx)
}

function resolveSettings(settings: FormValue): Partial<AppConfig> {
    const userConfig: Partial<AppConfig> = {}

    const equipFilters = settings.equipFilters
        .map((patt) => patt.trim())
        .filter((patt) => patt.length)
    if (equipFilters.length) {
        userConfig.equipFilters = equipFilters
    }

    const entries = Object.entries(settings.prices).filter(
        (kv): kv is [string, number] => kv[1] !== undefined
    )
    if (entries.length > 0) {
        userConfig.prices = Object.fromEntries(entries)
    }

    return userConfig
}

type FormValue = Omit<AppConfig, "prices"> & {
    prices: Record<string, number | undefined>
}
