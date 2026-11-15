import type { SQLOutputValue } from "node:sqlite";
import { getCategory } from "./categories.ts";
import { db } from "./db.ts";
import type {
    Account,
    Amount,
    CategorySummary,
    MonthlySummary,
    Transaction,
} from "./types.ts";

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
    limit?: number,
    sort?: "ASC" | "DESC",
    categoryId?: number | "none",
): Transaction[] {
    let statement = "SELECT * FROM transactions WHERE accountId = ?";
    if (typeof categoryId === "number") {
        statement += " AND categoryId = ?";
    } else if (categoryId === "none") {
        statement += " AND categoryId IS NULL";
    }
    if (sort !== undefined) {
        statement += ` ORDER BY bookedOn ${sort}, dayPosition ${sort}`;
    } else {
        statement += " ORDER BY bookedOn, dayPosition";
    }
    let rows;
    if (limit !== undefined) {
        statement += " LIMIT ?";
        if (typeof categoryId === "number") {
            rows = db.prepare(statement).all(accountId, categoryId, limit);
        } else {
            rows = db.prepare(statement).all(accountId, limit);
        }
    } else {
        if (typeof categoryId === "number") {
            rows = db.prepare(statement).all(accountId, categoryId);
        } else {
            rows = db.prepare(statement).all(accountId);
        }
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
                SUM(amountCents) AS total
            FROM transactions
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

export function getCategoryOverview(
    accountId: number,
    categoryId?: number | "none",
): CategorySummary[] {
    const where = categoryId === undefined ? "" : "WHERE categories.id = ?";
    const recursive = `
        WITH RECURSIVE tree(rootId, id) AS (
            SELECT
                id,
                id
            FROM categories
            UNION
            SELECT
                tree.rootId,
                categories.id
            FROM categories
            JOIN tree ON categories.parentId = tree.id
        )
        SELECT
            categories.id AS categoryId,
            categories.name AS name,
            COALESCE(
                SUM(transactions.amountCents) FILTER (WHERE transactions.amountCents < 0), 0
            ) AS expenses_recursive,
            COALESCE(
                SUM(transactions.amountCents) FILTER (WHERE transactions.amountCents < 0 AND transactions.categoryId = categories.id), 0
            ) AS expenses_direct,
            COALESCE(
                SUM(transactions.amountCents) FILTER (WHERE transactions.amountCents > 0), 0
            ) AS income_recursive,
            COALESCE(
                SUM(transactions.amountCents) FILTER (WHERE transactions.amountCents > 0 AND transactions.categoryId = categories.id), 0
            ) AS income_direct,
            COALESCE(
                SUM(transactions.amountCents), 0
            ) AS total_recursive,
            COALESCE(
                SUM(transactions.amountCents) FILTER (WHERE transactions.categoryId = categories.id), 0
            ) AS total_direct
        FROM categories
        JOIN tree ON tree.rootId = categories.id
        LEFT JOIN transactions ON transactions.categoryId = tree.id AND transactions.accountId = ?
        ${where}
        GROUP BY categories.id
        ORDER BY total_recursive DESC`;
    const direct = `SELECT
                    NULL AS categoryId,
                    'no category' AS name,
                    COALESCE(
                        SUM(amountCents) FILTER (WHERE amountCents < 0), 0
                    ) AS expenses_recursive,
                    COALESCE(
                        SUM(amountCents) FILTER (WHERE amountCents < 0), 0
                    ) AS expenses_direct,
                    COALESCE(
                        SUM(amountCents) FILTER (WHERE amountCents > 0), 0
                    ) AS income_recursive,
                    COALESCE(
                        SUM(amountCents) FILTER (WHERE amountCents > 0), 0
                    ) AS income_direct,
                    COALESCE(
                        SUM(amountCents), 0
                    ) AS total_recursive,
                    COALESCE(
                        SUM(amountCents), 0
                    ) AS total_direct
                    FROM transactions
                    WHERE accountId = ? AND categoryId IS NULL
                    HAVING COUNT(*) > 0`;
    let rows: Record<string, SQLOutputValue>[];
    if (typeof categoryId === "number") {
        getCategory(categoryId);
        rows = db.prepare(recursive).all(accountId, categoryId);
    } else if (categoryId === "none") {
        rows = db.prepare(direct).all(accountId);
    } else {
        rows = [
            ...db.prepare(recursive).all(accountId),
            ...db.prepare(direct).all(accountId),
        ];
    }
    const categories: CategorySummary[] = [];
    const currency = getAccountCurrency(accountId);
    for (const row of rows) {
        if (
            !(typeof row.categoryId === "number" || row.categoryId === null) ||
            typeof row.name !== "string" ||
            typeof row.income_recursive !== "number" ||
            typeof row.income_direct !== "number" ||
            typeof row.expenses_recursive !== "number" ||
            typeof row.expenses_direct !== "number" ||
            typeof row.total_recursive !== "number" ||
            typeof row.total_direct !== "number"
        ) {
            throw new Error(
                `Wrong database format for row: categoryId: ${row.categoryId}, name: ${row.name}, income_recursive: ${row.income_recursive}, income_direct: ${row.income_direct}, expenses_recursive: ${row.expenses_recursive}, expenses_direct: ${row.expenses_direct}, total_recursive: ${row.total_recursive}, total_direct: ${row.total_direct}`,
            );
        }
        categories.push({
            categoryId: row.categoryId,
            name: row.name,
            recursive: {
                income: {
                    cents: row.income_recursive,
                    currency: currency,
                },
                expenses: {
                    cents: row.expenses_recursive,
                    currency: currency,
                },
                total: {
                    cents: row.total_recursive,
                    currency: currency,
                },
            },
            direct: {
                income: {
                    cents: row.income_direct,
                    currency: currency,
                },
                expenses: {
                    cents: row.expenses_direct,
                    currency: currency,
                },
                total: {
                    cents: row.total_direct,
                    currency: currency,
                },
            },
        });
    }
    return categories;
}
