import { db } from "./db.ts";
import type { Amount, MonthlySummary } from "./types.ts";

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

export function getMonthlyOverview(accountId: number): MonthlySummary[] {
    const currencyRow = db
        .prepare("SELECT currency FROM accounts WHERE id = ?")
        .get(accountId);
    if (!currencyRow) {
        throw new Error(`Account with id ${accountId} not found.`);
    }
    const currency = currencyRow.currency;
    if (typeof currency !== "string") {
        throw new Error(`Wrong database format for row: currency: ${currency}`);
    }
    const rows = db
        .prepare(
            `SELECT
                substr(bookedOn, 1, 7) AS month,
                COALESCE(
                    SUM(amountCents) FILTER (WHERE amountCents < 0), 0
                ) AS expenses,
                COALESCE(
                    SUM(amountCents) FILTER (WHERE amountCents > 0), 0
                ) AS income,
                SUM(amountCents) AS total FROM transactions
            WHERE accountId = ?
            GROUP BY substr(bookedOn, 1, 7)
            ORDER BY bookedOn`,
        )
        .all(accountId);
    const months: MonthlySummary[] = [];
    for (const row of rows) {
        if (
            typeof row.month !== "string" ||
            typeof row.income !== "number" ||
            typeof row.expenses !== "number" ||
            typeof row.total !== "number"
        ) {
            throw new Error(
                `Wrong database format for row: month: ${row.month}, income: ${row.income}, expenses: ${row.expenses}, total: ${row.total}`,
            );
        }
        months.push({
            month: row.month,
            income: {
                cents: row.income,
                currency: currency,
            },
            expenses: {
                cents: row.expenses,
                currency: currency,
            },
            total: {
                cents: row.total,
                currency: currency,
            },
        });
    }
    return months;
}
