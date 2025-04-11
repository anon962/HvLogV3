import {
    comopressGzip as compressGzip,
    decompressGzip,
} from "@/lib/utils/miscUtils"
import { range } from "radash"
import { expect, it } from "vitest"

it("compression should work", async () => {
    const orig = "abc"
    const c = await compressGzip(orig)
    const dc = await decompressGzip(c)
    expect(orig).toEqual(dc)
})

it("compression should work on long strings", async () => {
    let orig = [...range(99_999)]
        .map(() => Math.random().toString())
        .join("")
    const c = await compressGzip(orig)
    const dc = await decompressGzip(c)
    expect(orig).toEqual(dc)
})
