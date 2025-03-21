import { range, sort, sum } from "radash"

export class DataSeries<T = any> {
    data: T[] = []
    points: Point2[] = []
    mappedPoints: Point2[] = []

    constructor(
        public getter: (d: T) => { x: number; y: number },
        public transforms: Transform[] = []
    ) {}

    public push(...data: T[]): this {
        this.data.push(...data)
        this.points.push(
            ...sort(
                data.map((d) => this.getter(d)),
                (pt) => pt.x
            )
        )
        this.mappedPoints = this.transform(this.points)
        return this
    }

    public clear(): this {
        this.data = []
        this.points = []
        this.mappedPoints = []
        return this
    }

    private transform(pts: Point2[]) {
        let result = pts

        for (const tfm of this.transforms) {
            switch (tfm.type) {
                case "average":
                    result = this.transformAverage(result, tfm)
                    break
                case "downsample":
                    result = this.transformDownsample(result, tfm)
                    break
                case "bin":
                    result = this.transformBin(result, tfm)
                    break
                case "binByWidth":
                    result = this.transformBin(result, {
                        type: "bin",
                        keyFn: (pt) => Math.trunc(pt.x / tfm.width),
                        aggFn: (key, pts) => ({
                            x: key * tfm.width,
                            y:
                                sum(yVals(pts)) /
                                (tfm.divideByWidth ? tfm.width : 1),
                        }),
                    })
                    break
                case "map":
                    result = result.map((pt) => tfm.fn(pt))
                    break
            }
        }

        result = sort(result, ({ x }) => x)

        return result
    }

    private transformAverage(
        pts: Point2[],
        tfm: AverageTransform
    ): Point2[] {
        const update: Point2[] = []

        const keepEdges = tfm.keepEdges ?? true
        const start = keepEdges ? 0 : tfm.width
        const end = keepEdges ? pts.length : pts.length - tfm.width

        for (let idx = start; idx < end; idx++) {
            const center = pts[idx]
            const a = Math.max(idx - tfm.width, 0)
            const b = Math.min(idx + tfm.width, pts.length - 1)

            const items = [idx, ...range(a, b)].map((i) => pts[i].y)
            const y = sum(items) / items.length

            update.push({
                x: center.x,
                y,
            })
        }

        return update
    }

    private transformDownsample(
        pts: Point2[],
        tfm: DownsampleTransform
    ): Point2[] {
        const update: Point2[] = []
        if (!pts.length) {
            return pts
        }

        // First point
        const start = tfm.offset ?? 0
        if ((tfm.keepFirst ?? true) && start !== 0) {
            update.push(pts[0])
        }

        // Step through other points
        let idx
        for (idx = start; idx < pts.length; idx += tfm.step) {
            update.push(pts[idx])
        }

        // Last point
        if ((tfm.keepLast ?? true) && idx !== pts.length - 1) {
            update.push(pts[idx])
        }

        return update
    }

    private transformBin<TKey extends string | number>(
        pts: Point2[],
        tfm: BinTransform<TKey>
    ): Point2[] {
        const bins = new Map<TKey, Point2[]>()

        // Default to x as key
        const keyfn = tfm.keyFn ?? ((pt) => pt.x as TKey)

        // Default to sum as aggregator
        const aggFn =
            tfm.aggFn ??
            ((key, pts) => ({
                x: key as number,
                y: sum(pts.map((pt) => pt.y)),
            }))

        // Bins
        for (const pt of pts) {
            const k = keyfn(pt)

            if (!bins.has(k)) {
                bins.set(k, [])
            }

            bins.get(k)!.push(pt)
        }

        // Bins to points
        const update = [...bins.entries()].map(([key, pts]) =>
            aggFn(key, pts)
        )

        return update
    }
}

type Point2 = {
    x: number
    y: number
}

type Transform =
    | AverageTransform
    | DownsampleTransform
    | BinTransform
    | BinByWidthTransform
    | MapTransform

interface AverageTransform {
    type: "average"
    width: number
    keepEdges?: boolean
}

interface DownsampleTransform {
    type: "downsample"
    step: number
    offset?: number
    keepFirst?: boolean
    keepLast?: boolean
}

interface BinTransform<TKey extends string | number = number> {
    type: "bin"
    keyFn?: (pt: Point2) => TKey
    aggFn?: (key: TKey, pts: Point2[]) => Point2
}

interface BinByWidthTransform {
    type: "binByWidth"
    width: number
    divideByWidth?: boolean
}

interface MapTransform {
    type: "map"
    fn: (pt: Point2) => Point2
}

function xVals(pts: Point2[]): number[] {
    return pts.map((pt) => pt.x)
}

function yVals(pts: Point2[]): number[] {
    return pts.map((pt) => pt.x)
}
