import * as idb from "idb"
import * as latest from "./logDb"
import { migrateCompleteLogs } from "./migrateLogs"
import { v1 } from "./oldVersions"

type Db<T = any> = idb.IDBPDatabase<T>
type Txn<
    TSchema = any,
    TMode extends IDBTransactionMode = "readwrite"
> = idb.IDBPTransaction<
    TSchema,
    ArrayLike<idb.StoreNames<TSchema>>,
    TMode
>

export function migrateSchema(db: Db, oldVersion: number) {
    while (oldVersion !== db.version) {
        if (oldVersion === 1) {
            s_1_2(db)
        } else {
            throw new Error(
                `No schema migration for version ${oldVersion}`
            )
        }

        console.log("Scheduling migration", oldVersion, [
            ...db.objectStoreNames,
        ])
        db.deleteObjectStore(migrationKey(oldVersion)) // ???
        db.createObjectStore(migrationKey(oldVersion))
        oldVersion += 1
    }
}

export async function migrateData(db: Db, txn: Txn) {
    const currentVersions = new Set(db.objectStoreNames)

    let oldVersion = 1
    while (oldVersion < db.version) {
        const mkey = migrationKey(oldVersion)

        const needsMigration =
            currentVersions.has(mkey) &&
            (await txn.objectStore(mkey).count()) === 0
        if (needsMigration) {
            txn.objectStore(mkey).add("", "done")
            console.debug(`Migrating data from version ${oldVersion}`)

            switch (oldVersion) {
                case 1:
                    const oldTxn = txn as Txn<v1.LogDbSchema>
                    const newTxn = txn as Txn<latest.LogDbSchema>
                    putAll(
                        newTxn.objectStore("complete"),
                        migrateCompleteLogs(
                            await iterStore(oldTxn, "complete"),
                            oldVersion
                        )
                    )
                    break
                default:
                    throw new Error(
                        `Failed to migrate data from version ${oldVersion}`
                    )
            }
        }

        oldVersion += 1
    }
}

function s_1_2(db: Db) {
    db.createObjectStore("migration0001")
}

function migrationKey(version: number) {
    return "migration" + version.toString().padStart(4, "0")
}

async function iterStore<
    T extends idb.DBSchema = any,
    TStore extends idb.StoreNames<T> = any
>(txn: Txn<T>, store: TStore) {
    let result: Array<idb.StoreValue<T, TStore>> = []

    const cursor = await txn.objectStore(store).openCursor()
    if (!cursor) return result

    for await (const { value: oldLog } of cursor) {
        result.push(oldLog)
    }

    return result
}

function putAll<
    T extends idb.DBSchema = any,
    TStore extends idb.StoreNames<T> = any
>(
    store: idb.IDBPObjectStore<T, any, TStore, "readwrite">,
    xs: Array<idb.StoreValue<T, TStore>>
) {
    for (const x of xs) {
        store.put(x)
    }
}
