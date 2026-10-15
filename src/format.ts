import type { Amount } from "./types.ts";

const LOCALE = "de-DE";

export function formatAmount(amount: Amount): string {
    return new Intl.NumberFormat(LOCALE, {
        style: "currency",
        currency: amount.currency,
    }).format(amount.cents / 100);
}
