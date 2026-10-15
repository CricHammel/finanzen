import { formatAmount, formatMonthlySummaries } from "./format.ts";
import { importTransactions } from "./import.ts";
import { getAccounts, getCurrentBalance, getMonthlyOverview } from "./query.ts";

function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log(
            "============================ Finanzen ============================",
        );
        console.log("A small tool to keep track of your finances.\n");
        console.log("   import <path>          Import a csv with transactions");
        console.log("   accounts               List accounts");
        console.log(
            "   balance <accountId>    Get the current balance of an account",
        );
        console.log(
            "   months <accountId>     Get a monthly summary of an account",
        );
        return;
    }
    switch (args[0]) {
        case "import": {
            if (!args[1]) {
                throw new Error("Wrong usage! Please specify import path");
            }
            importTransactions(args[1]);
            console.log("Import successful");
            break;
        }
        case "accounts": {
            getAccounts().forEach((account) => {
                console.log(
                    `${account.id} "${account.name}": ${account.iban}, ${account.bank}, ${account.currency}, (${account.type})`,
                );
            });
            break;
        }
        case "balance": {
            const id = Number(args[1]);
            if (!Number.isInteger(id)) {
                throw new Error("Wrong usage! Please specify account id");
                return;
            }
            console.log(
                "Current balance: " + formatAmount(getCurrentBalance(id)),
            );
            break;
        }
        case "months": {
            const id = Number(args[1]);
            if (!Number.isInteger(id)) {
                throw new Error("Wrong usage! Please specify account id");
            }
            formatMonthlySummaries(getMonthlyOverview(id)).forEach((s) =>
                console.log(s),
            );
            break;
        }
        default: {
            throw new Error("Wrong usage! import|accounts|balance|months");
        }
    }
}

main();
