import { formatAmount, formatMonthlySummaries } from "./format.ts";
import { importTransactions } from "./import.ts";
import { getCurrentBalance, getMonthlyOverview } from "./query.ts";

function main() {
    const accountId = importTransactions("data/Umsatzanzeige.csv");
    const balance = getCurrentBalance(accountId);
    console.log(formatAmount(balance));
    formatMonthlySummaries(getMonthlyOverview(accountId)).forEach((s) =>
        console.log(s),
    );
}

main();
