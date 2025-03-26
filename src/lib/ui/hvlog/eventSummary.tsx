export interface EventSummary<
    TExtra extends Record<string, any> = Record<string, never>
> {
    data: Record<
        string,
        Array<
            {
                logIdx: number
            } & TExtra
        >
    >
    groups: Array<{
        keys: Set<string>
        label: string
    }>
}
