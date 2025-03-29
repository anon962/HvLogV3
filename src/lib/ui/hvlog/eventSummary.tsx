export interface EventSummary<
    TExtra extends Record<string, any> = Record<string, never>,
    TGroups extends Array<{
        label: string
        has: (...args: any[]) => boolean
    }> = Array<{
        label: string
        has: (...args: any[]) => boolean
    }>,
    TKey extends string = string
> {
    data: Record<string, Array<EventSummaryData<TExtra, TKey>>>
    groups: TGroups
}

export type EventSummaryData<
    TExtra extends Record<string, any> = Record<string, never>,
    TKey extends string = string
> = TExtra & {
    key: TKey
    logIdx: number
}
