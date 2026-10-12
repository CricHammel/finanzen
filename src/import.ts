import { parseCsv } from "./parse-csv.ts";
import type { Transaction } from "./types.ts";

function verifyBalance(transactions: Transaction[]) {
    for (let i = 0; i < transactions.length - 1; i++) {
        const currentTransaction = transactions[i]!;
        const previousTransaction = transactions[i + 1]!;
        if (
            currentTransaction.balance.cents -
                currentTransaction.amount.cents !==
            previousTransaction.balance.cents
        ) {
            throw new Error(
                "Invalid balance at transaction " + currentTransaction,
            );
        }
    }
}

export function importTransactions(path: string) {
    const [header, records] = parseCsv(path);
    console.log(header);
    console.log(records);
    verifyBalance(records);
}
