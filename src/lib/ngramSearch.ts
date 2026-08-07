import { enumerate, range, sort } from "myutils"

type IdMap<T> = Map<T, number[]>
type NgramMap<T> = Map<string, IdMap<T>>
type Cache<T> = Map<number, NgramMap<T>>

export class NgramSearch<T> {
    cache: Cache<T> = new Map()
    idToNormal: Map<T, string> = new Map()
    idToIdx: Map<T, number> = new Map()

    constructor(
        public options: {
            items: Array<{ id: T; text: string }>
            cacheSize: number
        },
    ) {
        for (const [idx, { id, text }] of enumerate(this.options.items)) {
            this.idToNormal.set(id, text.toLocaleLowerCase())
            this.idToIdx.set(id, idx)
        }

        for (const idx of range(1, this.options.cacheSize + 1)) {
            this.initNgrams(idx)
        }
    }

    private initNgrams(size: number) {
        const cacheForSize: NgramMap<T> = new Map()
        this.cache.set(size, cacheForSize)

        for (const { id } of this.options.items) {
            const text = this.idToNormal.get(id)!

            for (let idx = 0; idx <= text.length - size; idx++) {
                const ngram = text.slice(idx, idx + size)

                let idsForNgram: IdMap<T>
                if (!cacheForSize.has(ngram)) {
                    idsForNgram = new Map()
                    cacheForSize.set(ngram, idsForNgram)
                } else {
                    idsForNgram = cacheForSize.get(ngram)!
                }

                let idxs: number[]
                if (!idsForNgram.has(id)) {
                    idxs = []
                    idsForNgram.set(id, idxs)
                } else {
                    idxs = idsForNgram.get(id)!
                }
                idxs.push(idx)
            }
        }
    }

    find(query: string): Array<{ id: T; text: string; idx: number }> {
        query = query.toLocaleLowerCase()
        const headSize = Math.min(this.options.cacheSize, query.length)
        const head = query.slice(0, headSize)
        const tail = query.slice(headSize)

        const matchMap = this.cache.get(headSize)?.get(head)
        let matchList: Array<[T, number]> = []
        if (matchMap) {
            matchList = Array.from(matchMap.entries()).flatMap(([id, idxs]) =>
                idxs.map((idx) => [id, idx] as [T, number]),
            )
        }

        matchList = matchList.filter(([id, idx]) => {
            const text = this.idToNormal.get(id)!
            return text.slice(idx).startsWith(query)
        })

        matchList = sort(matchList, ([id, idx]) => idx)

        const seen = new Set<T>()
        const dupeIdxs = new Set<number>()
        for (const [idx, [id]] of enumerate(matchList)) {
            if (seen.has(id)) {
                dupeIdxs.add(idx)
            } else {
                seen.add(id)
            }
        }
        matchList = matchList.filter((_, idx) => !dupeIdxs.has(idx))

        const result = matchList.map(([id, startIdx]) => {
            const itemIdx = this.idToIdx.get(id)!
            return { ...this.options.items[itemIdx], idx: startIdx }
        })

        return result
    }
}
