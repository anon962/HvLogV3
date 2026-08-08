import { LogEntries, LogEntry } from "../db/dbN"
import { DEBUG } from "../ui/constants"
import { BaseHvEvent } from "./eventParser"
import { sort } from "myutils"

// @todo: Replace with https://chevrotain.io/docs/tutorial/step2_parsing.html#complete-parser

export function takeEvents<TEvent extends BaseHvEvent>(
    grammar: EventGrammar<TEvent["event_type"]>,
    entries: LogEntries<TEvent>,
    startIdx: number,
    root: GrammarRule<TEvent["event_type"]>,
    greedy = true,
): [TEvent[], number[]] | [null, null] {
    const debug = (DEBUG ? {} : null) as any
    const debugInc = (key: string, v: number, def: number) => {
        if (debug) {
            debug[key] = debug[key] ?? def
            debug[key] += v
        }
    }

    let toCheck = [
        {
            rule: root,
            result: [] as number[],
            numErrors: 0,
        },
    ]
    let matches: number[][] = []

    const donePaths = new Set<string>()
    const getPathKey = (numErrors: number, rule: GrammarRule<any>) => {
        return `${numErrors}|||${JSON.stringify(rule)}`
    }

    while (toCheck.length > 0) {
        debugInc("n", 1, 0)

        // console.log("toCheck", toCheck.length, matches.length)
        let { rule, result, numErrors } = toCheck.shift()!
        const pathKey = getPathKey(numErrors, rule)
        const toCheckUpdate: typeof toCheck = []

        rule = trySimplify(grammar, rule)

        if (donePaths.has(pathKey)) {
            debugInc("skipDone", 1, 0)
            continue
        }

        // console.log(
        //     "---",
        //     rule,
        //     result,
        //     startIdx + result.length + numErrors,
        //     entries.slice(startIdx + result.length + numErrors),
        // )
        if (result.length === rule.length) {
            matches.push(result)
            donePaths.add(pathKey)
            continue
        }

        const entryIdx = startIdx + result.length + numErrors
        const entry = entries[entryIdx] as LogEntry<TEvent> | undefined
        if (entry?.type === "error") {
            toCheckUpdate.push({
                rule,
                result,
                numErrors: numErrors + 1,
            })
            continue
        }

        const termIdx = result.length
        const head = rule.slice(0, termIdx)
        const [term, ...tail] = rule.slice(termIdx)

        const ev = entry?.event
        let isMatch = ev && term.keys?.includes(ev.event_type)
        if (term.repeat) {
            if (!term.refs?.length && term.keys?.length) {
                debugInc("peekRepeat", 1, 0)
                const repeats = peekRepeats(
                    term.keys,
                    entries,
                    entryIdx,
                    term.repeat.max,
                )

                let minIdx = null as number | null
                let matchCount = 0
                for (let idx = 0; idx < repeats.length; idx++) {
                    if (!repeats[idx].isError) {
                        matchCount += 1
                        if (matchCount === term.repeat.min) {
                            minIdx = idx
                            break
                        }
                    }
                }

                if (minIdx) {
                    const repeatRule = []
                    const repeatResult = []
                    let repeatErrors = 0
                    for (let idx = 0; idx < minIdx; idx++) {
                        repeatRule.push({ ...term, repeat: undefined })
                        repeatResult.push(repeats[idx].entryIdx)
                        repeatErrors += repeats[idx].isError ? 1 : 0
                    }
                    for (let idx = minIdx; idx < repeats.length; idx++) {
                        repeatRule.push({ ...term, repeat: undefined })
                        repeatResult.push(repeats[idx].entryIdx)
                        repeatErrors += repeats[idx].isError ? 1 : 0

                        toCheckUpdate.push({
                            rule: [...head, ...repeatRule, ...tail],
                            result: [...result, ...repeatResult],
                            numErrors: numErrors + repeatErrors,
                        })
                    }
                } else {
                    const bareMiss = {
                        rule: [...head, ...tail],
                        result: [...result],
                        numErrors,
                    }
                    const bareMatch = {
                        rule: [
                            ...head,
                            { ...term, repeat: undefined },
                            ...tail,
                        ],
                        result: [...result, entryIdx],
                        numErrors,
                    }
                    const repeatMatch = {
                        rule: [
                            ...head,
                            { ...term, repeat: undefined },
                            {
                                ...term,
                                repeat: {
                                    min: Math.max(term.repeat.min - 1, 0),
                                    max: Math.max(term.repeat.max - 1, 0),
                                },
                            },
                            ...tail,
                        ],
                        result: [...result, entryIdx],
                        numErrors,
                    }

                    if (term.repeat.min === 0) {
                        if (!isMatch || term.repeat.max === 0) {
                            debugInc("bareMiss", 1, 0)
                            toCheckUpdate.push(bareMiss)
                        } else if (isMatch) {
                            debugInc("bareMatch", 1, 0)
                            toCheckUpdate.push(bareMatch)
                            if (term.repeat.max > 1) {
                                debugInc("repeatMatch.1", 1, 0)
                                toCheckUpdate.push(repeatMatch)
                            }
                        }
                    } else if (isMatch) {
                        debugInc("repeatMatch.2", 1, 0)
                        toCheckUpdate.push(repeatMatch)
                    }
                }
            }
        } else if (isMatch) {
            debugInc("match_no_rep", 1, 0)
            toCheckUpdate.push({
                rule,
                result: [...result, entryIdx],
                numErrors,
            })
        }

        for (const ref of term.refs ?? []) {
            const otherRule = grammar[ref]
            if (!otherRule) {
                throw new Error(`Invalid ref ${ref} ${term}`)
            }

            if (term.repeat) {
                const otherRuleRepeated = []
                for (let i = 0; i < term.repeat.min; i += 1) {
                    otherRuleRepeated.push(...otherRule)
                }

                debugInc("ref_rep_curr", 1, 0)
                toCheckUpdate.push({
                    rule: [...head, ...otherRuleRepeated, ...tail],
                    result: [...result],
                    numErrors,
                })

                if (term.repeat.min < term.repeat.max) {
                    debugInc("ref_rep_next", 1, 0)
                    toCheckUpdate.push({
                        rule: [
                            ...head,
                            {
                                ...term,
                                repeat: {
                                    min: term.repeat.min + 1,
                                    max: term.repeat.max,
                                },
                            },
                            ...tail,
                        ],
                        result: [...result],
                        numErrors,
                    })
                }
            } else {
                debugInc("ref_no_rep", 1, 0)
                toCheckUpdate.push({
                    rule: [...head, ...otherRule, ...tail],
                    result: [...result],
                    numErrors,
                })
            }
        }

        toCheck = [...toCheckUpdate, ...toCheck]
    }

    // console.log("matches", matches)
    if (!matches.length) {
        return [null, null]
    }

    matches = sort(matches, (xs) => xs.length, greedy)
    const best = matches[0]

    if (debug && debug.n > 1000) {
        console.debug(
            "takeEvents",
            debug,
            matches,
            donePaths,
            entries.slice(startIdx, startIdx + 100),
            root,
            greedy,
        )
    }

    // if (best.some((idx) => idx === 33787)) {
    //     console.debug(
    //         root,
    //         matches.map((seq) => seq.map((idx) => ({ ...entries[idx], idx }))),
    //     )
    // }

    return [
        best.map(
            (idx) =>
                (entries[idx] as LogEntry<TEvent> & { type: "event" })["event"],
        ),
        best,
    ]
}

function trySimplify<TEvent extends BaseHvEvent>(
    grammar: EventGrammar<TEvent["event_type"]>,
    rule: GrammarRule<TEvent["event_type"]>,
): GrammarRule<TEvent["event_type"]> {
    const hasRefs = rule.some((term) => !!term.refs?.length)
    if (!hasRefs) {
        return rule
    }

    const rewrite = rule // JSON.parse(JSON.stringify(rule))
    for (const term of rewrite) {
        let fail = false
        const keys = [...(term.keys ?? [])]
        for (const ref of term?.refs ?? []) {
            const otherRule = grammar[ref]
            if (otherRule.length > 1) {
                fail = true
                break
            }
            if (otherRule[0].refs?.length) {
                fail = true
                break
            }

            keys.push(...(otherRule[0].keys ?? []))
        }

        if (!fail) {
            term.keys = keys
            term.refs = []
        }
    }

    return rewrite
}

function peekRepeats<TEvent extends BaseHvEvent>(
    keys: Readonly<Array<TEvent["event_type"]>>,
    entries: LogEntries<TEvent>,
    startIdx: number,
    max: number,
): Array<{ entryIdx: number; isError: boolean }> {
    let result = []
    let matchCount = 0
    while (matchCount < max) {
        const entryIdx: number = startIdx + result.length
        const entry = entries[entryIdx]
        if (!entry) {
            break
        }
        if (entry.type !== "event") {
            result.push({ entryIdx, isError: true })
            continue
        }

        if (keys.some((k) => k === entry.event.event_type)) {
            result.push({ entryIdx, isError: false })
            matchCount += 1
            continue
        } else {
            break
        }
    }

    return result
}

/**
 * Searches for a sequnce of events that matches root grammar followed by effect grammar
 * Then checks the following events for more groups that match the effect grammar
 * so this returns a 2d array (or null) where...
 *   - first entry is seq of events that matched the root grammar
 *   - following entries (at least one) are each a seq of events matching effect grammar
 */
export function takeEffectsWithRoot<
    TEvent extends BaseHvEvent,
    TGrammar extends EventGrammar<any>,
>(
    grammar: TGrammar,
    entries: LogEntry<TEvent>[],
    startIdx: number,
    rootRef: keyof TGrammar & string,
    effectRef: null | (keyof TGrammar & string),
): { root: TEvent; effects: TEvent[][] } | null {
    const firstRule = effectRef
        ? [{ refs: [rootRef] }, { refs: [effectRef] }]
        : [{ refs: [rootRef] }]
    const [evs] = takeEvents(grammar, entries, startIdx, firstRule)
    if (!evs) {
        return null
    }

    if (!effectRef) {
        return { root: evs[0], effects: [] }
    }

    const [root, ...firstEffects] = evs
    if (!firstEffects.length) {
        return null
    }

    const effects = firstEffects.length ? [firstEffects] : []
    effects.push(
        ...takeEffects(
            grammar,
            entries,
            startIdx + 1 + firstEffects.length,
            effectRef,
        ),
    )

    return {
        root,
        effects,
    }
}

function takeEffects<
    TEvent extends BaseHvEvent,
    TGrammar extends EventGrammar<any>,
>(
    grammar: TGrammar,
    entries: LogEntry<TEvent>[],
    startIdx: number,
    effectRef: keyof TGrammar & string,
): TEvent[][] {
    const effects = []
    let offset = 0

    while (true) {
        const [nextEffects] = takeEvents(grammar, entries, startIdx + offset, [
            { refs: [effectRef] },
        ])

        if (nextEffects) {
            effects.push(nextEffects)
            offset += nextEffects.length
        } else {
            return effects
        }
    }
}

export type EventGrammar<T extends string = string> = Record<
    string,
    GrammarRule<T>
>

interface IGrammarTerm<T extends string> {
    keys?: Readonly<Array<T>>
    refs?: Readonly<string[]>
    repeat?: {
        min: number
        max: number
    }
}

type GrammarRule<T extends string> = Array<IGrammarTerm<T>>

export function filterEvents<
    TEvent extends BaseHvEvent,
    TFilter extends string,
>(
    entries: LogEntries<TEvent>,
    eventTypes: Array<TFilter> | null,
): Array<TEvent & { event_type: TFilter } & { logIndex: number }> {
    const evs = entries.flatMap((entry, idx) =>
        entry.type === "event" ? [{ ...entry.event, logIndex: idx }] : [],
    )

    if (eventTypes === null) {
        return evs as any[]
    } else {
        const s = new Set(eventTypes)
        return evs.filter((ev) => s.has(ev.event_type as any)) as any[]
    }
}
