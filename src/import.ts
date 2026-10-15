import { parseCsv } from "./parse-csv.ts";
import type { Header, Transaction } from "./types.ts";
import { db } from "./db.ts";
import { basename } from "node:path";

function verifyBalance(header: Header, transactions: Transaction[]) {
    if (
        !transactions[0] ||
        header.balance.cents !== transactions[0].balance.cents ||
        header.balance.currency !== transactions[0].balance.currency
    ) {
        throw new Error(
            "Balance of account and last transaction do not match!",
        );
    }
    for (let i = 0; i < transactions.length - 1; i++) {
        const currentTransaction = transactions[i]!;
        const previousTransaction = transactions[i + 1]!;
        if (
            currentTransaction.balance.cents -
                currentTransaction.amount.cents !==
            previousTransaction.balance.cents
        ) {
            throw new Error(
                "Invalid balance at transaction with date " +
                    currentTransaction.booked +
                    " and amount " +
                    currentTransaction.amount.cents,
            );
        }
    }
}

function findOrCreateAccount(header: Header): number {
    const account = db
        .prepare("SELECT id FROM accounts WHERE iban = ?")
        .get(header.iban);
    if (!account) {
        return Number(
            db
                .prepare(
                    "INSERT INTO accounts (iban, name, bank, type, currency) VALUES (?, ?, ?, ?, ?)",
                )
                .run(
                    header.iban,
                    header.accountName,
                    header.bank,
                    "Girokonto", // Right now "Girokonto" is the only account type
                    header.balance.currency,
                ).lastInsertRowid,
        );
    }
    if (typeof account.id !== "number") {
        throw new Error("Unexspected row id: " + account.id);
    }
    return account.id;
}

export function importTransactions(path: string): number {
    const { header, transactions } = parseCsv(path);
    verifyBalance(header, transactions);
    db.exec("BEGIN");
    try {
        const accountId = findOrCreateAccount(header);
        const fileName = basename(path);
        const importId = db
            .prepare(
                "INSERT INTO imports (accountId, fileName, importedAt, periodFrom, periodTo, linesTotal, linesImported) VALUES (?, ?, ?, ?, ?, ?, ?)",
            )
            .run(
                accountId,
                fileName,
                new Date().toISOString(),
                header.periodFrom,
                header.periodTo,
                transactions.length,
                0, // Placeholder, gets updated once import is done
            ).lastInsertRowid;
        const stmt = db.prepare(
            "INSERT INTO transactions (accountId, importId, bookedOn, dayPosition, valuedOn, counterparty, bookingText, purpose, amountCents, balanceCents, dedupHash, rawLine, isInternal) VALUES (:accountId, :importId, :bookedOn, :dayPosition, :valuedOn, :counterparty, :bookingText, :purpose, :amountCents, :balanceCents, :dedupHash, :rawLine, :isInternal) ON CONFLICT (accountId, dedupHash) DO NOTHING",
        );
        let changes = 0;
        let previousTransactionDate: string | undefined;
        let dayCounter = 0;
        for (const t of transactions.toReversed()) {
            if (
                previousTransactionDate &&
                previousTransactionDate !== t.booked
            ) {
                dayCounter = 0;
            }
            const result = stmt.run({
                accountId: accountId,
                importId: importId,
                bookedOn: t.booked,
                dayPosition: dayCounter,
                valuedOn: t.valued,
                counterparty: t.applicantRecipient,
                bookingText: t.description,
                purpose: t.reason,
                amountCents: t.amount.cents,
                balanceCents: t.balance.cents,
                dedupHash: t.dedupHash,
                rawLine: t.rawLine,
                isInternal: 0,
            });
            changes += Number(result.changes);
            dayCounter++;
            previousTransactionDate = t.booked;
        }
        db.prepare("UPDATE imports SET linesImported = ? WHERE id = ?").run(
            changes,
            importId,
        );
        if (changes === 0) {
            return accountId;
        }
        // Check whole account for gaps between transactions
        const gap = db
            .prepare(
                `WITH chain AS (
                        SELECT
                            accountId,
                            bookedOn,
                            balanceCents - amountCents AS balance_before,
                            LAG(balanceCents) OVER chain_window AS previous_balance,
                            LAG(bookedOn) OVER chain_window AS previous_bookedOn
                        FROM transactions
                        WHERE accountId = ?
                        WINDOW chain_window AS (PARTITION BY accountId ORDER BY bookedOn, dayPosition)
                    )
                    SELECT accountId,
                        previous_bookedOn,
                        bookedOn,
                        balance_before - previous_balance AS missing_balance
                    FROM chain
                    WHERE previous_bookedOn IS NOT NULL
                        AND balance_before != previous_balance
                    ORDER BY accountId, bookedOn
                    LIMIT 1;`,
            )
            .get(accountId);
        if (gap) {
            throw new Error(
                `Found gap between ${gap["previous_bookedOn"]} and ${gap["bookedOn"]}: ${gap["missing_balance"]} cents are missing!`,
            );
        }
        db.exec("COMMIT");
        return accountId;
    } catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }
}
