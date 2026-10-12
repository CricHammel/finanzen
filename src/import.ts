import { parseCsv } from "./parse-csv.ts";
import type { Header, Transaction } from "./types.ts";

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
                    currentTransaction.amount,
            );
        }
    }
}

export function importTransactions(path: string) {
    const { header, transactions } = parseCsv(path);
    verifyBalance(header, transactions);
}
