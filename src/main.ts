import { createCategory, getCategories } from "./categories.ts";
import { formatAmount, formatDate, formatMonthlySummaries } from "./format.ts";
import { importTransactions } from "./import.ts";
import {
    getAccounts,
    getCurrentBalance,
    getMonthlyOverview,
    getTransactions,
} from "./query.ts";

function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log(
            "============================ Finanzen ============================",
        );
        console.log("A small tool to keep track of your finances.\n");
        console.log(
            "   import <path>                               Import a csv with transactions",
        );
        console.log(
            "   accounts                                    List accounts",
        );
        console.log(
            "   transactions <accountId> [limit] [sort]     List the transactions of an account",
        );
        console.log(
            "   balance <accountId>                         Get the current balance of an account",
        );
        console.log(
            "   months <accountId>                          Get a monthly summary of an account",
        );
        console.log(
            "   categories                                  List categories",
        );
        console.log(
            "   categories create <name> [parentId]         Create a new category, optionally with a parent",
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
        case "transactions": {
            if (args.length < 2 || args.length > 4) {
                throw new Error(
                    "Wrong usage! Please specify account id and optionally limit and sort order",
                );
            }
            const id = Number(args[1]);
            if (!Number.isInteger(id)) {
                throw new Error("Wrong usage! Please specify account id");
            }
            let limit: number | undefined;
            if (args[2] !== undefined) {
                limit = Number.parseInt(args[2]);
                if (Number.isNaN(limit)) {
                    limit = undefined;
                }
            }
            if (
                !(
                    args[3] === "ASC" ||
                    args[3] === "DESC" ||
                    args[3] === undefined
                )
            ) {
                throw new Error("Wrong usage! Sort must be 'ASC' or 'DESC'");
            }
            let sort: "ASC" | "DESC" | undefined = args[3];
            // If limit is not a number, check if it is a sort order
            if (
                limit === undefined &&
                sort === undefined &&
                (args[2] === "ASC" || args[2] === "DESC")
            ) {
                sort = args[2];
            }
            getTransactions(id, limit, sort).forEach((t) => {
                console.log(
                    `${t.id} from/to "${t.applicantRecipient}", booked on ${formatDate(t.booked)}, amount: ${formatAmount(t.amount)}, balance after: ${formatAmount(t.balance)}`,
                );
            });
            break;
        }
        case "balance": {
            const id = Number(args[1]);
            if (!Number.isInteger(id)) {
                throw new Error("Wrong usage! Please specify account id");
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
        case "categories": {
            if (args.length === 1) {
                getCategories().forEach((c) => {
                    console.log(
                        `${c.id} ${c.name} ${c.parentId ? `(parent: ${c.parentId})` : "(no parent)"}`,
                    );
                });
            } else if (args[1] === "create") {
                if (args.length === 2 || args.length > 4) {
                    throw new Error(
                        "Wrong usage! Please specify name and optionally parent id",
                    );
                }
                const name = String(args[2]);
                let parentId: number | null = null;
                if (args.length === 4) {
                    parentId = Number(args[3]);
                    if (!Number.isInteger(parentId)) {
                        throw new Error(
                            "Wrong usage! Please specify name and optionally parent id",
                        );
                    }
                }
                const c = createCategory({
                    name: name,
                    parentId: parentId,
                });
                console.log(
                    `New category created: ${c.id} ${c.name} ${c.parentId ? `(parent: ${c.parentId})` : "(no parent)"}`,
                );
            } else {
                throw new Error(
                    "Wrong usage! category create <name> [parentId]",
                );
            }

            break;
        }
        default: {
            throw new Error(
                "Wrong usage! import|accounts|transactions|balance|months|categories",
            );
        }
    }
}

main();
