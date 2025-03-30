import { CompleteLog } from "./logDb"
import { HvEvent, HvEventMap } from "./parsers"

// @todo: Replace with https://chevrotain.io/docs/tutorial/step2_parsing.html#complete-parser

export function takeEvents(
    entries: CompleteLog["entries"],
    startIdx: number,
    root: GrammarRule,
    grammar: EventGrammar
): HvEvent[] | null {
    let toCheck = [{ rule: root, result: [] as HvEvent[] }]

    let entryIdx = startIdx
    while (toCheck.length && entryIdx < entries.length) {
        const toCheckUpdate: typeof toCheck = []
        for (const { rule, result } of toCheck) {
            if (result.length === rule.length) {
                return result
            }

            const entry = entries[startIdx + result.length]
            if (entry.type === "error") {
                return null
            }
            const ev = entry.event

            const termIdx = result.length

            const head = rule.slice(0, termIdx)
            const [term, ...tail] = rule.slice(termIdx)

            if (term.keys?.includes(ev.event_type)) {
                result.push(ev)
                toCheckUpdate.push({
                    rule,
                    result,
                })
            }

            for (const ref of term.refs ?? []) {
                const otherRule = grammar[ref]
                toCheckUpdate.push({
                    rule: [...head, ...otherRule, ...tail],
                    result: [...result],
                })
            }

            if (term.optional) {
                toCheckUpdate.push({
                    rule: [...head, ...tail],
                    result: [...result],
                })
            }
        }

        toCheck = toCheckUpdate
    }

    return null
}

export type EventGrammar = Record<string, GrammarRule>

interface IGrammarTerm {
    keys?: Array<EventKey>
    refs?: string[]
    optional?: boolean
}

type GrammarRule = Array<IGrammarTerm>

type EventKey = keyof HvEventMap
