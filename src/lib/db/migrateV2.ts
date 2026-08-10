type BaseLog = {
    id: string
    meta: {
        lastUpdate: string
        start: string
    }
}
type Log = BaseLog & { compressed: false; entries: Array<LogEntry> }
type CompressedLog = BaseLog & {
    compressed: true
    entries: Uint8Array<ArrayBuffer>
}
type LogEntry = LogEvent | LogError
type LogEvent = { type: "event"; event: any }
type LogError = { type: "error"; detail: string }
type ExportLog = {
    id: string
    world: "persistent" | "isekai"
    lines: string[]
}
export type MigrateV2Result =
    | { type: "log"; log: ExportLog }
    | { type: "error"; detail: string }

export async function* migrateV2(
    batchSize = 50,
): AsyncGenerator<Array<MigrateV2Result>, undefined, never> {
    for (const [dbId, world] of [
        ["HvLog", "persistent"],
        ["HvLog_isekai", "isekai"],
    ] as const) {
        const db = await initDb(dbId)
        const ids = await selectKeys(db)
        for (let idx = 0; idx < ids.length; idx += batchSize) {
            const idBatch = ids.slice(idx, idx + batchSize)
            const logBatch: Array<MigrateV2Result> = []

            for (const id of idBatch) {
                try {
                    const log = await selectLog(db, id)
                    logBatch.push({
                        type: "log",
                        log: {
                            id: log.id,
                            world,
                            lines: log.entries.map((x) => reverseEntry(x)),
                        },
                    })
                } catch (e) {
                    console.error(e)
                    logBatch.push({
                        type: "error",
                        detail: String(e),
                    })
                }
            }

            yield logBatch
        }
    }
}

// region: parsers
function reverseEntry(x: LogEntry): string {
    if (x.type === "event") {
        return reverseEntry(x.event)
    } else {
        return x.detail.replace("No matching parser for ", "")
    }
}
function reverseEvent(event: any): string {
    const { type, ...data } = event
    if (type === "DEBUFF_EXPIRE" && data.monster === undefined) {
        return _reverseEvent("BUFF_EXPIRE", data)
    }
    return _reverseEvent(type, data)
}
function _reverseEvent(event_type: string, data = {}) {
    const gen = GENERATORS[event_type]
    if (!gen)
        throw new Error(`No reverse generator for event type "${event_type}"`)
    return gen(data)
}
function resistSuffix(resist: number | null | undefined) {
    return resist !== undefined && resist !== null
        ? ` (${resist}% resisted)`
        : ""
}
function enemySpellText(d: any) {
    const verb = d.spell_verb || "casts"
    return `${d.monster} ${verb} ${d.spell}`
}
const GENERATORS = {
    PLAYER_ATTACK: (d: any) =>
        `${d.spell} ${d.multiplier_type} ${d.monster} for ${d.value} ${
            d.damage_type ? `points of ${d.damage_type} ` : ""
        }damage${resistSuffix(d.resist)}.`,
    PLAYER_ITEM: (d: any) => `You use ${d.item}.`,
    PLAYER_SKILL: (d: any) => `You cast ${d.spell}.`,
    PLAYER_MELEE: (d: any) =>
        `You ${d.multiplier_type} ${d.monster} for ${d.value} ${d.damage_type} damage.`,
    PLAYER_COUNTER: (d: any) =>
        `You counter ${d.monster} for ${d.value} points of ${d.damage_type} damage.`,
    PLAYER_OFFHAND: (d: any) =>
        `Your offhand ${d.multiplier_type} ${d.monster} for ${d.value} ${d.damage_type} damage.`,
    PLAYER_SPELL_ABSORBED: () => `Your spell is absorbed.`,
    PLAYER_SPIKE_SHIELD: (d: any) =>
        `Your spike shield hits ${d.monster} for ${d.value} ${
            d.damage_type ? `points of ${d.damage_type} ` : ""
        }damage${resistSuffix(d.resist)}.`,
    SPIRIT_STANCE_START: () => `Spirit Stance Engaged`,
    SPIRIT_STANCE_END: () => `Spirit Stance Exhausted`,
    ENEMY_BASIC: (d: any) =>
        `${d.monster} ${d.multiplier_type} you for ${d.value} ${d.damage_type} damage.`,
    ENEMY_EVADE: (d: any) => `${d.monster} evades your spell.`,
    ENEMY_MISS: (d: any) => `${d.monster} misses the attack against you.`,
    ENEMY_MISS_2: (d: any) =>
        `You ${d.multiplier_type} the attack from ${d.monster}.`,
    ENEMY_SKILL_ABSORB: (d: any) =>
        `${enemySpellText(d)}, but is ${d.multiplier_type}ed. You gain ${d.mp} Magic Points.`,
    ENEMY_SKILL_MISS: (d: any) =>
        `${enemySpellText(d)}. You ${d.multiplier_type} the attack.`,
    ENEMY_SKILL_MISS_2: (d: any) =>
        `${d.monster} uses ${d.skill}, but misses the attack.`,
    ENEMY_SKILL_SUCCESS: (d: any) =>
        `${enemySpellText(d)}, and ${d.multiplier_type} you for ${d.value} ${d.damage_type} damage${resistSuffix(
            d.resist,
        )}.`,
    ENEMY_PARRY: (d: any) => `${d.monster} ${d.multiplier_type} your attack.`,
    ENEMY_DODGE: () => `Your attack misses its mark.`,
    PLAYER_BUFF: (d: any) => `You gain the effect ${d.effect}.`,
    RIDDLE_RESTORE: (d: any) =>
        `Time Bonus: Recovered ${d.hp} HP, ${d.mp} MP and ${d.sp} SP.`,
    EFFECT_RESTORE: (d: any) =>
        `${d.effect} restores ${d.value} points of ${d.type}.`,
    ITEM_RESTORE: (d: any) => `Recovered ${d.value} points of ${d.type}.`,
    CURE_RESTORE: (d: any) => `You are healed for ${d.value} Health Points.`,
    SPIRIT_SHIELD: (d: any) =>
        `Your spirit shield absorbs ${d.damage} points of damage from the attack into ${d.spirit_damage} points of spirit damage.`,
    SPARK_TRIGGER: () =>
        `Your Spark of Life restores you from the brink of defeat.`,
    DISPEL: (d: any) => `The effect ${d.effect} was dispelled.`,
    COOLDOWN_EXPIRE: (d: any) => `Cooldown expired for ${d.spell}`,
    BUFF_EXPIRE: (d: any) => `The effect ${d.effect} has expired.`,
    RESIST: (d: any) => `${d.monster} resists your spell.`,
    DEBUFF: (d: any) => `${d.monster} gains the effect ${d.name}.`,
    DEBUFF_EXPIRE: (d: any) =>
        `The effect ${d.effect} on ${d.monster} has expired.`,
    EXPLOSION: (d: any) =>
        `${d.explosion} explodes for ${d.value} ${d.type} damage`,
    ROUND_START: (d: any) =>
        `Initializing ${d.battle_type}${
            d.current !== undefined && d.max !== undefined
                ? ` (Round ${d.current} / ${d.max})`
                : ""
        } ...`,
    ROUND_END: () => `You are Victorious!`,
    DEFEAT: () => `You have been defeated.`,
    FLEE: () => `You have escaped from the battle.`,
    SPAWN: (d: any) =>
        `Spawned Monster ${d.letter}: MID=${d.mid} (${d.monster}) LV=${d.level} HP=${d.hp}`,
    MONSTER_DEATH: (d: any) => `${d.monster} has been defeated.`,
    RIDDLE_MASTER: () => `The Riddlemaster listens...`, // trailing text isn't captured by the parser
    GEM: (d: any) => `${d.monster} drops a ${d.type} powerup!`,
    CREDITS: (d: any) => `You gain ${d.value} Credits!`,
    DROP: (d: any) => `${d.monster} dropped [${d.item}]`,
    DROP_EVENT: (d: any) => `You found [${d.item}]`,
    SOUL_FRAG_DROP: (d: any) => `You obtained ${d.count}x [Soul Fragments]`,
    PROFICIENCY: (d: any) => `You gain ${d.value} points of ${d.type}.`,
    EXPERIENCE: (d: any) => `You gain ${d.value} EXP!`,
    AUTO_SALVAGE: (d: any) =>
        `A traveling salesmoogle salvages it into ${d.value}x [${d.item}]${
            d.value2 !== undefined && d.item2 !== undefined
                ? ` and ${d.value2}x [${d.item2}]`
                : ""
        }`,
    AUTO_SELL: (d: any) =>
        `A traveling salesmoogle gives you [${d.value} Credits] for it.`,
    CLEAR_BONUS: (d: any) => `Battle Clear Bonus! [${d.item}]`,
    TOKEN_BONUS: (d: any) => `Arena Token Bonus! [${d.item}]`,
    EVENT_ITEM: (d: any) => `You found a [${d.item}]`,
    LEVEL_UP: (d: any) => `You have reached Level (${d.level})!`,
    MASTERY_GAIN: (d: any) => `You gain ${d.value} Mastery Point!`,
    POTENCY_GAIN: (d: any) =>
        `The equipment's potential has increased by ${d.value} points!`,
    ENCHANT_GAIN: (d: any) => `Unlocked innate potential: ${d.value}`,
    MB_USAGE: (d: any) => `Used: ${d.value}`,
} as Record<string, (d: any) => string>

// region: db
async function asPromise<T extends IDBRequest>(
    fn: () => T,
): Promise<T["result"]> {
    return new Promise((resolve, reject) => {
        const req = fn()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}
async function initDb(name: string) {
    return asPromise(() => indexedDB.open(name))
}
async function selectKeys(db: IDBDatabase) {
    const storeId = "complete"
    const tx = db.transaction(storeId, "readonly")
    const store = tx.objectStore(storeId)
    return asPromise(() => store.getAllKeys()) as Promise<string[]>
}
async function decompress(
    x: Uint8Array<ArrayBuffer>,
): Promise<Array<LogEntry>> {
    const ds = new DecompressionStream("gzip")
    const decompressedStream = new Blob([x]).stream().pipeThrough(ds)
    const decompressedBlob = await new Response(decompressedStream).blob()
    const entriesRaw = await decompressedBlob.text()
    const entries = JSON.parse(entriesRaw)
    return entries
}
async function selectLog(db: IDBDatabase, id: string) {
    const storeId = "complete"
    const tx = db.transaction(storeId, "readonly")
    const store = tx.objectStore(storeId)
    const raw: Log | CompressedLog = await asPromise(() => store.get(id))
    const log = {
        ...raw,
        entries: raw.compressed ? await decompress(raw.entries) : raw.entries,
    } as Log
    return log
}
