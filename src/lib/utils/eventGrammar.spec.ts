import { describe, expect, it } from "vitest"
import { EventGrammar, takeEvents } from "./eventGrammar"
import { BaseHvEvent } from "./eventParser"
import { CompleteLog } from "../db/schema"

const withKeys = (...keys: string[]) => [{ keys }]
const baseGrammar = {
    a: withKeys("a"),
    b: withKeys("b"),
} as const satisfies EventGrammar<string>

function entries(seq: string): CompleteLog<BaseHvEvent>["entries"] {
    return events(seq).map((event) => ({
        type: "event",
        event,
    }))
}

function events(seq: string): Array<BaseHvEvent> {
    return seq.split("").map((x) => ({
        event_type: x,
    }))
}

describe("event grammar", () => {
    it("should work", () => {
        const g = {
            ...baseGrammar,
            ba: withKeys("b", "a"),
        }

        expect(takeEvents(g, entries("abcd"), 0, [{ refs: ["a"] }])[0]).toEqual(
            events("a"),
        )
        expect(takeEvents(g, entries("abcd"), 0, [{ refs: ["b"] }])[0]).toEqual(
            null,
        )
        expect(
            takeEvents(g, entries("abcd"), 0, [{ refs: ["ba"] }])[0],
        ).toEqual(events("a"))
    })

    it("should handle repeats", () => {
        const g = {
            ...baseGrammar,
        }

        expect(
            takeEvents(g, entries("aaaaa"), 0, [
                { keys: ["a"], repeat: { min: 0, max: 1 } },
            ])[0],
        ).toEqual(events("a"))
        expect(
            takeEvents(g, entries("aaaaa"), 0, [
                { keys: ["a"], repeat: { min: 2, max: 4 } },
            ])[0],
        ).toEqual(events("aaaa"))
        expect(
            takeEvents(g, entries("aaaaa"), 0, [
                { keys: ["a"], repeat: { min: 4, max: 4 } },
            ])[0],
        ).toEqual(events("aaaa"))
    })

    it("should handle real data (round start)", () => {
        const g = {
            ...baseGrammar,
            start: [
                { keys: ["a"] },
                {
                    keys: ["b"],
                    repeat: {
                        min: 1,
                        max: 2,
                    },
                },
            ],
        }
        expect(
            takeEvents(g, entries("abbbc"), 0, [{ refs: ["start"] }])[0],
        ).toEqual(events("abb"))
    })
})
