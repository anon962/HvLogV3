import * as idb from "idb"

type Db = idb.IDBPDatabase<any>
type Txn = idb.IDBPTransaction<any, any, any>

export function migrateLogDb(db: Db, oldVersion: number, txn: Txn) {
    if (oldVersion === 1) {
        return
    } else {
        throw new Error(`No migration for version ${oldVersion}`)
    }
}
