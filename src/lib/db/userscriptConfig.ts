import { newContext } from "../utils/miscUtils"
import { DbN } from "./dbN"

export const USERSCRIPT_CONFIG = newContext(() => {})

export const DEFAULT_USERSCRIPT_CONFIG = () => ({
    prices: {} as DbN.Prices,
})

export type UserscriptConfig = ReturnType<typeof DEFAULT_USERSCRIPT_CONFIG>
