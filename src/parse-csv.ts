import { readFileSync } from "node:fs";
import type {
    ISODate,
    Header,
    RawTransaction,
    Amount,
    Transaction,
} from "./types.ts";

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
    const header = data.split("\n").slice(0, headerRows);
    const ibanRow = header.find((v) => v.startsWith("IBAN"));
    const accountNameRow = header.find((v) => v.startsWith("Kontoname"));
    const bankRow = header.find((v) => v.startsWith("Bank"));
    const clientRow = header.find((v) => v.startsWith("Kunde"));
    const periodRow = header.find((v) => v.startsWith("Zeitraum"));
    const balanceRow = header.find((v) => v.startsWith("Saldo"));
    if (
        !ibanRow ||
        !accountNameRow ||
        !bankRow ||
        !clientRow ||
        !periodRow ||
        !balanceRow
    ) {
        throw new Error("Header malformed!");
    }
    const iban = ibanRow.split(";")[1];
    const accountName = accountNameRow.split(";")[1];
    const bank = bankRow.split(";")[1];
    const client = clientRow.split(";")[1];
    const period = periodRow.split(";")[1];
    const balanceCents = balanceRow.split(";")[1];
    const balanceCurrency = balanceRow.split(";")[2];
    if (
        !iban ||
        !accountName ||
        !bank ||
        !client ||
        !period ||
        !balanceCents ||
        !balanceCurrency
    ) {
        throw new Error("Header malformed!");
    }
    const [periodFrom, periodTo] = period.split(" - ");
    if (!periodFrom || !periodTo) {
        throw new Error("Header malformed!");
    }
    const balance = parseAmount(balanceCents, balanceCurrency);
    return {
        iban: iban,
        accountName: accountName,
        bank: bank,
        client: client,
        periodFrom: parseDate(periodFrom),
        periodTo: parseDate(periodTo),
        balance: balance,
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
    const cents = unit * 100 + Number(centsString);
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

export function parseCsv(path: string): {
    header: Header;
    transactions: Transaction[];
} {
    const text = readExport(path);
    const headerRows = determineHeaderRows(text);
    const header = parseHeader(text, headerRows);
    const rawRecords = parseRawTransactions(text, headerRows);
    return { header: header, transactions: rawToTransaction(rawRecords) };
}
