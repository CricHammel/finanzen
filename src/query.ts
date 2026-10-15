import { db } from "./db.ts";
import type { Amount } from "./types.ts";

export function getCurrentBalance(accountId: number): Amount {
    const row = db
        .prepare(
            `SELECT
                currency,
                (
                    SELECT
                        balanceCents
                    FROM transactions
                    WHERE transactions.accountId = accounts.id
                    ORDER BY bookedOn DESC, dayPosition DESC
                    LIMIT 1
                ) AS balanceCents
            FROM accounts
            WHERE id = ?`,
        )
        .get(accountId);
    if (!row) {
        throw new Error(`Account with id ${accountId} not found.`);
    }
    if (row.balanceCents === null) {
        throw new Error(`Account with id ${accountId} is empty.`);
    }
    if (
        typeof row.balanceCents !== "number" ||
        typeof row.currency !== "string"
    ) {
        throw new Error(
            `Wrong database format for row: balanceCents: ${row.balanceCents}, currency: ${row.currency}`,
        );
    }
    return {
        cents: Number(row.balanceCents),
        currency: String(row.currency),
    };
}
