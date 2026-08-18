import { readFileSync } from "node:fs";

type ISODate = string;

type Header = {
    iban: string;
    accountName: string;
    bank: string;
    client: string;
    periodFrom: ISODate;
    periodTo: ISODate;
};

type RawTransaction = {
    buchung: string;
    wertstellungsdatum: string;
    auftraggeber_empfaenger: string;
    buchungstext: string;
    verwendungszweck: string;
    saldo: string;
    waehrung_saldo: string;
    betrag: string;
    waehrung_betrag: string;
};

type Amount = {
    cents: number;
    currency: string;
};

type Transaction = {
    booked: ISODate;
    valued: ISODate;
    applicantRecipient: string;
    description: string;
    reason: string;
    balance: Amount;
    amount: Amount;
};

function readExport(path: string): string {
    const bytes = readFileSync(path);
    const text = new TextDecoder("windows-1252").decode(bytes);
    return text;
}

function determineHeaderRows(data: string): number {
    const rows = data.split("\n");
    const headerRows = rows.findIndex((v) => v.startsWith("Buchung"));
    if (headerRows === -1) {
        throw new Error("No first row!");
    }
    return headerRows;
}

function parseHeader(data: string, headerRows: number): Header {
    const header = data.split("\n").slice(0, headerRows - 1);
    const ibanRow = header.find((v) => v.startsWith("IBAN"));
    const accountNameRow = header.find((v) => v.startsWith("Kontoname"));
    const bankRow = header.find((v) => v.startsWith("Bank"));
    const clientRow = header.find((v) => v.startsWith("Kunde"));
    const periodRow = header.find((v) => v.startsWith("Zeitraum"));
    if (!ibanRow || !accountNameRow || !bankRow || !clientRow || !periodRow) {
        throw new Error("Header malformed!");
    }
    const iban = ibanRow.split(";")[1];
    const accountName = accountNameRow.split(";")[1];
    const bank = bankRow.split(";")[1];
    const client = clientRow.split(";")[1];
    const period = periodRow.split(";")[1];
    if (!iban || !accountName || !bank || !client || !period) {
        throw new Error("Header malformed!");
    }
    const [periodFrom, periodTo] = period.split(" - ");
    if (!periodFrom || !periodTo) {
        throw new Error("Header malformed!");
    }
    return {
        iban: iban,
        accountName: accountName,
        bank: bank,
        client: client,
        periodFrom: parseDate(periodFrom),
        periodTo: parseDate(periodTo),
    };
}

function parseRawTransactions(
    data: string,
    headerRows: number,
): RawTransaction[] {
    const csv = data.split("\n").slice(headerRows);
    const firstRow = csv.splice(0, 1)[0];
    if (firstRow === undefined) {
        throw new Error("No first row!");
    }
    const headers = firstRow.split(";");
    const headerCount = headers.length;
    const records: RawTransaction[] = [];
    for (const [i, record] of csv.entries()) {
        const fields = record.split(";");
        if (fields.length !== headerCount) {
            console.error(
                `Not ${headerCount} fields on line ${i + headerRows + 2}, skipping record!`,
            );
            console.error(record);
            continue;
        }
        records.push({
            buchung: fields[0]!,
            wertstellungsdatum: fields[1]!,
            auftraggeber_empfaenger: fields[2]!,
            buchungstext: fields[3]!,
            verwendungszweck: fields[4]!,
            saldo: fields[5]!,
            waehrung_saldo: fields[6]!,
            betrag: fields[7]!,
            waehrung_betrag: fields[8]!,
        });
    }
    return records;
}

function parseDate(dateString: string): ISODate {
    const [day, month, year] = dateString.split(".");
    if (
        !day ||
        !month ||
        !year ||
        day.length !== 2 ||
        month.length !== 2 ||
        year.length !== 4
    ) {
        throw new Error(
            `Invalid date format: ${dateString} (Should be DD.MM.YYYY)`,
        );
    }
    return `${year}-${month}-${day}`;
}

function parseAmount(amountString: string, currency: string): Amount {
    const isNegative = amountString.startsWith("-");
    const [unitString, centsString] = amountString.replace("-", "").split(",");
    if (!unitString || !centsString || centsString.length !== 2) {
        throw new Error("Invalid amount: " + amountString);
    }
    const unit = Number(unitString.replaceAll(".", ""));
    let cents = unit * 100 + Number(centsString);
    return {
        cents: isNegative ? -cents : cents,
        currency: currency,
    };
}

function rawToTransaction(raws: RawTransaction[]): Transaction[] {
    const transactions: Transaction[] = [];
    for (const raw of raws) {
        transactions.push({
            booked: parseDate(raw.buchung),
            valued: parseDate(raw.wertstellungsdatum),
            applicantRecipient: raw.auftraggeber_empfaenger,
            description: raw.buchungstext,
            reason: raw.verwendungszweck,
            balance: parseAmount(raw.saldo, raw.waehrung_saldo),
            amount: parseAmount(raw.betrag, raw.waehrung_betrag),
        });
    }
    return transactions;
}

function verifyBalance(transactions: Transaction[]): boolean {
    for (let i = 0; i < transactions.length - 1; i++) {
        const currentTransaction = transactions[i]!;
        const previousTransaction = transactions[i + 1]!;
        if (
            currentTransaction.balance.cents -
                currentTransaction.amount.cents !==
            previousTransaction.balance.cents
        ) {
            console.error(
                "Invalid balance at transaction ",
                currentTransaction,
            );
            return false;
        }
    }
    return true;
}

function main() {
    const text = readExport("data/Umsatzanzeige.csv");
    const headerRows = determineHeaderRows(text);
    console.log(headerRows);
    const header = parseHeader(text, headerRows);
    const rawRecords = parseRawTransactions(text, headerRows);
    const records = rawToTransaction(rawRecords);
    console.log(header);
    console.log(records);
    console.log(verifyBalance(records));
}

main();
