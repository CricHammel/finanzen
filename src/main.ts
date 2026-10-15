import { importTransactions } from "./import.ts";
import { getCurrentBalance } from "./query.ts";

function main() {
    const accountId = importTransactions("data/Umsatzanzeige.csv");
    console.log(getCurrentBalance(accountId));
}

main();
