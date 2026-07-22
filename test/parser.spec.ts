// import * as fs from "fs"
// import { group } from "radash"
// import { describe, expect, it } from "vitest"
// import { PARSERS } from "../src/lib/parsers"
// import longLog from "./logs/full.json"

// function expectParseToEqual(
//     line: string,
//     result: "any" | Record<string, any>
// ) {
//     const results = Object.values(PARSERS).map((parser) => ({
//         parser,
//         parse: parser.parse(line),
//     }))
//     const { success, fail, error } = group(
//         results,
//         ({ parse: [ok, err] }) =>
//             !!err ? "error" : ok === null ? "fail" : "success"
//     )

//     const debug = JSON.stringify(
//         { line, success: success ?? [], error: error ?? [] },
//         null,
//         2
//     )

//     expect(success?.length ?? 0, debug).toEqual(1)
//     expect(error?.length ?? 0, debug).toEqual(0)

//     if (result !== "any") {
//         expect(success![0].parse[0]).toEqual(result)
//     }

//     return { line, success: success![0] }
// }

// function logParseResults(
//     fp: string,
//     results: Array<ReturnType<typeof expectParseToEqual>>
// ) {
//     const log: string[] = []

//     for (let x of results) {
//         log.push(x.line)
//         log.push(
//             JSON.stringify(x.success.parse, null, 2)
//                 .replaceAll("\n", " ")
//                 .replaceAll(/\s+/g, " ")
//         )
//     }

//     fs.writeFileSync(fp, log.join("\n"))
// }

// describe("should parse", () => {
//     it("player attack", () => {
//         expectParseToEqual(
//             "Ripened Soul hits a name 123 + for 10201 damage.",
//             {
//                 event_type: "PLAYER_ATTACK",
//                 spell: "Ripened Soul",
//                 multiplier_type: "hits",
//                 monster: "a name 123 +",
//                 damage_type: undefined,
//                 value: 10201,
//             }
//         )
//     })
// })

// it("should parse all lines", () => {
//     const lines = (longLog as string[][]).flatMap((lns) => lns)
//     const results: any[] = []

//     for (let ln of lines) {
//         const res = expectParseToEqual(ln, "any")
//         results.push(res)
//     }

//     logParseResults("./logs/full_parse_test.log", results)
// })

// describe("should parse ROUND_START", () => {
//     it("for tower", () => {
//         expect(
//             PARSERS["ROUND_START"].parse(
//                 "Initializing The Tower (Floor 2) (Round 1 / 11) ..."
//             )
//         ).toEqual([
//             {
//                 event_type: "ROUND_START",
//                 battle_type: "The Tower (Floor 2)",
//                 current: 1,
//                 max: 11,
//             },
//             null,
//         ])
//     })

//     it("for random encounter", () => {
//         expect(
//             PARSERS["ROUND_START"].parse(
//                 "Initializing random encounter ..."
//             )
//         ).toEqual([
//             {
//                 event_type: "ROUND_START",
//                 battle_type: "random encounter",
//                 current: undefined,
//                 max: undefined,
//             },
//             null,
//         ])
//     })

//     it("for grindfest", () => {
//         expect(
//             PARSERS["ROUND_START"].parse(
//                 "Initializing Grindfest (Round 123 / 1000) ..."
//             )
//         ).toEqual([
//             {
//                 event_type: "ROUND_START",
//                 battle_type: "Grindfest",
//                 current: 123,
//                 max: 1000,
//             },
//             null,
//         ])
//     })

//     it("for item world", () => {
//         expect(
//             PARSERS["ROUND_START"].parse(
//                 "Initializing Item World (Round 42 / 86) ..."
//             )
//         ).toEqual([
//             {
//                 event_type: "ROUND_START",
//                 battle_type: "Item World",
//                 current: 42,
//                 max: 86,
//             },
//             null,
//         ])
//     })

//     it("for arena", () => {
//         expect(
//             PARSERS["ROUND_START"].parse(
//                 "Initializing arena challenge #112 (Round 1 / 111) ..."
//             )
//         ).toEqual([
//             {
//                 event_type: "ROUND_START",
//                 battle_type: "arena challenge #112",
//                 current: 1,
//                 max: 111,
//             },
//             null,
//         ])
//     })
// })
