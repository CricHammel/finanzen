import { db } from "./db.ts";
import type { Account, Amount, MonthlySummary, Transaction } from "./types.ts";

export function getAccounts(): Account[] {
    const rows = db.prepare("SELECT * FROM accounts").all();
    const accounts: Account[] = [];
    for (const row of rows) {
        if (
            typeof row.id !== "number" ||
            typeof row.name !== "string" ||
            typeof row.iban !== "string" ||
            typeof row.bank !== "string" ||
            typeof row.type !== "string" ||
            typeof row.currency !== "string"
        ) {
            throw new Error(
                `Wrong database format for row: id: ${row.id}, name: ${row.name}, iban: ${row.iban}, bank: ${row.bank}, type: ${row.type}, currency: ${row.currency}`,
            );
        }
        accounts.push({
            id: row.id,
            name: row.name,
            iban: row.iban,
            bank: row.bank,
            type: row.type,
            currency: row.currency,
        });
    }
    return accounts;
}

export function getAccountCurrency(accountId: number): string {
    const currencyRow = db
        .prepare("SELECT currency FROM accounts WHERE id = ?")
        .get(accountId);
    if (!currencyRow) {
        throw new Error(`Account with id ${accountId} not found`);
    }
    const currency = currencyRow.currency;
    if (typeof currency !== "string") {
        throw new Error(`Wrong database format for row: currency: ${currency}`);
    }
    return currency;
}

export function getCurrentBalance(accountId: number): Amount {
    const row = db
        .prepare(
            `SELECT balanceCents FROM transactions WHERE accountId = ? ORDER BY bookedOn DESC, dayPosition DESC LIMIT 1`,
        )
        .get(accountId);
    if (!row) {
        throw new Error(`Account with id ${accountId} not found.`);
    }
    if (row.balanceCents === null) {
        throw new Error(`Account with id ${accountId} is empty.`);
    }
    if (typeof row.balanceCents !== "number") {
        throw new Error(
            `Wrong database format for row: balanceCents: ${row.balanceCents}`,
        );
    }
    return {
        cents: row.balanceCents,
        currency: getAccountCurrency(accountId),
    };
}

export function getTransactions(
    accountId: number,
    limit: number | undefined,
    sort: "ASC" | "DESC" | undefined,
): Transaction[] {
    let statement = "SELECT * FROM transactions WHERE accountId = ?";
    if (sort !== undefined) {
        statement += ` ORDER BY bookedOn ${sort}, dayPosition ${sort}`;
    } else {
        statement += " ORDER BY bookedOn, dayPosition";
    }
    let rows;
    if (limit !== undefined) {
        rows = db.prepare(statement + " LIMIT ?").all(accountId, limit);
    } else {
        rows = db.prepare(statement).all(accountId);
    }
    const transactions: Transaction[] = [];
    const currency = getAccountCurrency(accountId);
    for (const row of rows) {
        if (
            typeof row.id !== "number" ||
            typeof row.importId !== "number" ||
            typeof row.bookedOn !== "string" ||
            typeof row.valuedOn !== "string" ||
            typeof row.counterparty !== "string" ||
            typeof row.bookingText !== "string" ||
            typeof row.purpose !== "string" ||
            typeof row.amountCents !== "number" ||
            typeof row.balanceCents !== "number" ||
            typeof row.dedupHash !== "string" ||
            typeof row.rawLine !== "string" ||
            !(typeof row.categoryId === "number" || row.categoryId === null) ||
            !(
                row.categorySource === "rule" ||
                row.categorySource === "manual" ||
                row.categorySource === null
            ) ||
            !(
                typeof row.appliedRuleId === "number" ||
                row.appliedRuleId === null
            ) ||
            !(row.isInternal === 0 || row.isInternal === 1)
        ) {
            throw new Error(
                `Wrong database format for row: id: ${row.id}, importId: ${row.importId}, bookedOn: ${row.bookedOn}, valuedOn: ${row.valuedOn}, counterparty: ${row.counterparty}, bookingText: ${row.bookingText}, purpose: ${row.purpose}, amountCents: ${row.amountCents}, balanceCents: ${row.balanceCents}, dedupHash: ${row.dedupHash}, rawLine: ${row.rawLine}, categoryId: ${row.categoryId}, categorySource: ${row.categorySource}, appliedRuleId: ${row.appliedRuleId}, isInternal: ${row.isInternal}`,
            );
        }
        transactions.push({
            id: row.id,
            importId: row.importId,
            booked: row.bookedOn,
            valued: row.valuedOn,
            applicantRecipient: row.counterparty,
            description: row.bookingText,
            reason: row.purpose,
            amount: { cents: row.amountCents, currency: currency },
            balance: { cents: row.balanceCents, currency: currency },
            dedupHash: row.dedupHash,
            rawLine: row.rawLine,
            categoryId: row.categoryId,
            categorySource: row.categorySource,
            appliedRuleId: row.appliedRuleId,
            isInternal: Boolean(row.isInternal),
        });
    }
    return transactions;
}

export function getMonthlyOverview(accountId: number): MonthlySummary[] {
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
    const currency = getAccountCurrency(accountId);
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
