import type { ParseArgsConfig } from "node:util";

export type ISODate = string;

export type ISOMonth = string;

export type Header = {
    iban: string;
    accountName: string;
    bank: string;
    client: string;
    periodFrom: ISODate;
    periodTo: ISODate;
    balance: Amount;
};

export type RawTransaction = {
    buchung: string;
    wertstellungsdatum: string;
    auftraggeber_empfaenger: string;
    buchungstext: string;
    verwendungszweck: string;
    saldo: string;
    waehrung_saldo: string;
    betrag: string;
    waehrung_betrag: string;
    raw_line: string;
};

export type Amount = {
    cents: number;
    currency: string;
};

export type Transaction = {
    id: number;
    importId: number;
    booked: ISODate;
    valued: ISODate;
    applicantRecipient: string;
    description: string;
    reason: string;
    balance: Amount;
    amount: Amount;
    dedupHash: string;
    rawLine: string;
    categoryId: number | null;
    categorySource: "rule" | "manual" | null;
    appliedRuleId: number | null;
    isInternal: boolean;
};

export type NewTransaction = Omit<
    Transaction,
    | "id"
    | "importId"
    | "categoryId"
    | "categorySource"
    | "appliedRuleId"
    | "isInternal"
>;

export type Account = {
    id: number;
    iban: string;
    name: string;
    bank: string;
    type: string;
    currency: string;
};

export type MonthlySummary = {
    month: ISOMonth;
    income: Amount;
    expenses: Amount;
    total: Amount;
};

export type Category = {
    id: number;
    name: string;
    parentId: number | null;
};

export type NewCategory = Omit<Category, "id">;

export type CommandOptions = NonNullable<ParseArgsConfig["options"]>;

export type CommandLeaf = {
    name: string;
    description: string;
    positionals: string[];
    options: CommandOptions;
    run: (positionals: string[], values: Record<string, unknown>) => void;
};

export type CommandGroup = {
    name: string;
    subcommands: CommandLeaf[];
};

export type Command = CommandLeaf | CommandGroup;
