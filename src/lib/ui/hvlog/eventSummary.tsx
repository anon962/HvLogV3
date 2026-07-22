/**
 * Flat map of log events into some common data format
 * Also includes grouping logic, meant for the tally table
 *
 * eg drops can mapped to (item name, item count)
 *    and further grouped by categories like credits (direct drops, autosell) and crystals (crystal of X)
 *
 * mapping generates one data entry per event, and not summation because... i don't remember
 */
export interface EventSummary<
    TExtra extends Record<TKey, any> = Record<string, never>,
    TGroups extends Array<{
        label: string
        has: (...args: any[]) => boolean
    }> = Array<{
        label: string
        has: (...args: any[]) => boolean
    }>,
    TKey extends string = string,
> {
    data: Record<TKey, Array<EventSummaryData<TExtra, TKey>>>
    groups: TGroups
    miscGroup: null | {
        label: string
    }
}

export type EventSummaryData<
    TExtra extends Record<string, any> = Record<string, never>,
    TKey extends string = string,
> = TExtra & {
    key: TKey
    logIdx: number
}
