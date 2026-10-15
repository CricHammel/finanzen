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
    booked: ISODate;
    valued: ISODate;
    applicantRecipient: string;
    description: string;
    reason: string;
    balance: Amount;
    amount: Amount;
    dedupHash: string;
    rawLine: string;
};

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
