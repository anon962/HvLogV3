import { L, Override } from "myutils"
import { UserscriptConfig } from "./db/userscriptConfig"
import { HVDATA_URL } from "./constants"
import { DbN } from "./db/dbN"

export namespace HvDataN {
    export interface User {
        id: string
        key: string
        name: string
    }

    export async function createUser(): Promise<User> {
        const resp = await fetch(`${HVDATA_URL}/api/users`, {
            method: "POST",
        })

        if (resp.status !== 200) {
            throw new Error(String(resp.status) + " " + resp.statusText)
        }

        const data = await resp.json()
        L.info("Created HvData user", data)

        return data
    }
    export async function updateUser(
        user: Override<User, { name: string | null }>,
    ): Promise<User> {
        const resp = await fetch(`${HVDATA_URL}/api/users`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(user),
        })
        if (!resp.ok) {
            console.trace(`${resp.status} ${resp.statusText}`, user)
            throw new Error(`${resp.status} ${resp.statusText}`)
        }
        const data = await resp.json()
        L.info("Updated HvData user", data)
        return data
    }
    export async function deleteUser(opts: Pick<User, "id" | "key">) {
        return await fetch(`${HVDATA_URL}/api/users`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                id: opts.id,
                key: opts.key,
            }),
        })
    }

    export async function uploadLog(opts: {
        id?: DbN.LogId
        logText: string
        config: UserscriptConfig
    }): Promise<{
        dupe: boolean
        id: string
        id_user: string
        generated_at: string
        submitted_at: string
        published_at: string
        password: string
        hide_user: boolean | 0 | 1
        version: string
    }> {
        if (!opts.config.hvdataUser) {
            L.error(opts.config)
            throw new Error("Tried to upload log without user")
        }

        const body = JSON.stringify(
            {
                id: opts.id ?? null,
                log: opts.logText,
                id_user: opts.config.hvdataUser.id,
                key_user: opts.config.hvdataUser.key,
                publish_at_dawn: opts.config.hvdataDelayDawn === "yes",
                hide_user: opts.config.hvdataAnon === "yes",
            },
            null,
            2,
        )
        const bodyCompressed = await new Response(
            new Blob([body])
                .stream()
                .pipeThrough(new CompressionStream("gzip")),
        ).blob()

        const resp = await fetch(`${HVDATA_URL}/api/battle_logs`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Encoding": "gzip",
            },
            body: bodyCompressed,
        })

        if (resp.status === 304) {
            L.warn(`Uploaded dupe log`)
        } else if (!resp.ok) {
            throw new Error(`${resp.status} ${resp.statusText}`)
        }

        const respData = await resp.json()
        return respData
    }
}
