import * as fs from "fs"
import { group } from "radash"
import { describe, expect, it } from "vitest"
import { PARSERS } from "../src/parsers"
import longLog from "./logs/full.json"

function expectParseToEqual(
    line: string,
    result: "any" | Record<string, any>
) {
    const results = Object.values(PARSERS).map((parser) => ({
        parser,
        parse: parser.parse(line),
    }))
    const { success, fail, error } = group(
        results,
        ({ parse: [ok, err] }) =>
            !!err ? "error" : ok === null ? "fail" : "success"
    )

    const debug = JSON.stringify(
        { line, success: success ?? [], error: error ?? [] },
        null,
        2
    )

    expect(success?.length ?? 0, debug).toEqual(1)
    expect(error?.length ?? 0, debug).toEqual(0)

    if (result !== "any") {
        expect(success![0].parse[0]).toEqual(result)
    }

    return { line, success: success![0] }
}

function logParseResults(
    fp: string,
    results: Array<ReturnType<typeof expectParseToEqual>>
) {
    const log: string[] = []

    for (let x of results) {
        log.push(x.line)
        log.push(
            JSON.stringify(x.success.parse, null, 2)
                .replaceAll("\n", " ")
                .replaceAll(/\s+/g, " ")
        )
    }

    fs.writeFileSync(fp, log.join("\n"))
}

describe("should parse", () => {
    it("player attack", () => {
        expectParseToEqual(
            "Ripened Soul hits a name 123 + for 10201 damage.",
            {
                event_type: "PLAYER_ATTACK",
                spell: "Ripened Soul",
                multiplier_type: "hits",
                monster: "a name 123 +",
                damage_type: undefined,
                value: 10201,
            }
        )
    })
})

it("should parse all lines", () => {
    const lines = (longLog as string[][]).flatMap((lns) => lns)
    const results: any[] = []

    for (let ln of lines) {
        const res = expectParseToEqual(ln, "any")
        results.push(res)
    }

    logParseResults("./logs/full_parse_test.log", results)
})
