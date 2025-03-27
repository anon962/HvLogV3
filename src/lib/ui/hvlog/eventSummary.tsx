export interface EventSummary<
    TExtra extends Record<string, any> = Record<string, never>,
    TMember extends (...args: any[]) => boolean = any,
    TKey extends string = string
> {
    data: Record<string, Array<EventSummaryData<TExtra, TKey>>>
    groups: Array<{
        label: string
        has: TMember
    }>
}

export type EventSummaryData<
    TExtra extends Record<string, any> = Record<string, never>,
    TKey extends string = string
> = TExtra & {
    key: TKey
    logIdx: number
}
