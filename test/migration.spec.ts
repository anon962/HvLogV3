// import { migrateCompleteLogs } from "@/lib/logDb/migrateLogs"
// import { v1 } from "@/lib/logDb/versions/v1"
// import { describe, expect, it } from "vitest"

// describe("migrating logs from v1 to v2", () => {
//     const oldEvs = [
//         {
//             type: "event",
//             event: {
//                 event_type: "PLAYER_ATTACK",
//                 spell: "Ripened Soul",
//                 multiplier_type: "hits",
//                 monster: "a name 123 +",
//                 damage_type: null,
//                 value: 10201,
//                 resist: null,
//             },
//         },
//     ] as const

//     it("should work with new compression key", async () => {
//         const oldLog: v1.CompleteLog = {
//             id: "",
//             meta: {
//                 lastUpdate: "",
//                 start: "",
//             },
//             entries: [
//                 ...oldEvs,
//                 {
//                     type: "error",
//                     detail: `No matching parser for The equipment's potential has increased by 1234 points!`,
//                 },
//                 {
//                     type: "error",
//                     detail: `No matching parser for Unlocked innate potential: Blah 2`,
//                 },
//             ],
//         }

//         const newLog = await migrateCompleteLogs([oldLog], 1)
//         expect(newLog).toEqual([
//             {
//                 ...oldLog,
//                 compressed: false,
//                 entries: [
//                     ...oldEvs,
//                     {
//                         type: "event",
//                         event: {
//                             event_type: "POTENCY_GAIN",
//                             value: 1234,
//                         },
//                     },
//                     {
//                         type: "event",
//                         event: {
//                             event_type: "ENCHANT_GAIN",
//                             value: "Blah 2",
//                         },
//                     },
//                 ],
//             },
//         ])
//     })
// })
