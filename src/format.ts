import type {
    Amount,
    CategorySummary,
    ISODate,
    ISOMonth,
    MonthlySummary,
    SummaryGroup,
} from "./types.ts";

const LOCALE = "de-DE";
const TIMEZONE = "UTC";

export function formatAmount(amount: Amount): string {
    return new Intl.NumberFormat(LOCALE, {
        style: "currency",
        currency: amount.currency,
    }).format(amount.cents / 100);
}

export function formatDate(date: ISODate): string {
    return new Intl.DateTimeFormat(LOCALE, {
        day: "numeric",
        month: "numeric",
        year: "numeric",
        timeZone: TIMEZONE,
    }).format(new Date(date));
}

export function formatMonth(month: ISOMonth): string {
    return new Intl.DateTimeFormat(LOCALE, {
        month: "long",
        year: "numeric",
        timeZone: TIMEZONE,
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

function sameAmounts(a: SummaryGroup, b: SummaryGroup): boolean {
    return (
        a.income.cents === b.income.cents &&
        a.expenses.cents === b.expenses.cents &&
        a.total.cents === b.total.cents
    );
}

export function formatCategorySummaries(
    summaries: CategorySummary[],
): string[] {
    return summaries.map((summary) => {
        let text = `Summary for category ${summary.categoryId != null ? summary.categoryId + " " : ""}"${summary.name}":\n`;
        if (sameAmounts(summary.recursive, summary.direct)) {
            text = text.concat(
                `Income: ${formatAmount(summary.direct.income)}\n`,
            );
            text = text.concat(
                `Expenses: ${formatAmount(summary.direct.expenses)}\n`,
            );
            text = text.concat(
                `Total: ${formatAmount(summary.direct.total)}\n`,
            );
        } else {
            text = text.concat(
                `Recursive income: ${formatAmount(summary.recursive.income)}\n`,
            );
            text = text.concat(
                `Recursive expenses: ${formatAmount(summary.recursive.expenses)}\n`,
            );
            text = text.concat(
                `Recursive total: ${formatAmount(summary.recursive.total)}\n`,
            );
            text = text.concat(
                `Direct income: ${formatAmount(summary.direct.income)}\n`,
            );
            text = text.concat(
                `Direct expenses: ${formatAmount(summary.direct.expenses)}\n`,
            );
            text = text.concat(
                `Direct total: ${formatAmount(summary.direct.total)}\n`,
            );
        }
        return text;
    });
}
