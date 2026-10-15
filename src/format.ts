import type { Amount, ISOMonth, MonthlySummary } from "./types.ts";

const LOCALE = "de-DE";

export function formatAmount(amount: Amount): string {
    return new Intl.NumberFormat(LOCALE, {
        style: "currency",
        currency: amount.currency,
    }).format(amount.cents / 100);
}
export function formatMonth(month: ISOMonth): string {
    return new Intl.DateTimeFormat(LOCALE, {
        month: "long",
        year: "numeric",
    }).format(new Date(`${month}-01`));
}

export function formatMonthlySummaries(summaries: MonthlySummary[]): string[] {
    return summaries.map((summary) => {
        let text = `Monthly summary for ${formatMonth(summary.month)}:\n`;
        text = text.concat(`Income: ${formatAmount(summary.income)}\n`);
        text = text.concat(`Expenses: ${formatAmount(summary.expenses)}\n`);
        text = text.concat(`Total: ${formatAmount(summary.total)}\n`);
        return text;
    });
}
