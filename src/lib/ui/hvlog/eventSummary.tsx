export interface EventSummary<
    TKey extends string,
    TExtra extends Record<string, any> = Record<string, never>,
    TMember extends (...args: any[]) => boolean = any
> {
    data: Record<string, Array<EventSummaryData<TKey, TExtra>>>
    groups: Array<{
        label: string
        has: TMember
    }>
}

export type EventSummaryData<
    TKey extends string,
    TExtra extends Record<string, any> = Record<string, never>
> = TExtra & {
    key: TKey
    logIdx: number
}
