import { formatAmount } from "./format.ts";
import { importTransactions } from "./import.ts";
import { getCurrentBalance } from "./query.ts";

function main() {
    const accountId = importTransactions("data/Umsatzanzeige.csv");
    const balance = getCurrentBalance(accountId);
    console.log(formatAmount(balance));
}

main();
