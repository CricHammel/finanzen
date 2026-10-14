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

export function importTransactions(path: string) {
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
            "INSERT INTO transactions (accountId, importId, bookedOn, valuedOn, counterparty, bookingText, purpose, amountCents, balanceCents, dedupHash, rawLine, isInternal) VALUES (:accountId, :importId, :bookedOn, :valuedOn, :counterparty, :bookingText, :purpose, :amountCents, :balanceCents, :dedupHash, :rawLine, :isInternal) ON CONFLICT DO NOTHING",
        );
        let changes = 0;
        for (const t of transactions) {
            const result = stmt.run({
                accountId: accountId,
                importId: importId,
                bookedOn: t.booked,
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
        }
        db.prepare("UPDATE imports SET linesImported = ? WHERE id = ?").run(
            changes,
            importId,
        );
        db.exec("COMMIT");
    } catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }
}
