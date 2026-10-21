import { parseArgs } from "node:util";
import {
    assignCategory,
    createCategory,
    getCategories,
    unassignCategory,
} from "./categories.ts";
import { formatAmount, formatDate, formatMonthlySummaries } from "./format.ts";
import { importTransactions } from "./import.ts";
import {
    getAccounts,
    getCurrentBalance,
    getMonthlyOverview,
    getTransactions,
} from "./query.ts";
import type { Command, CommandLeaf } from "./types.ts";
import { createRule, getRules, sortRule, toggleRule } from "./rules.ts";

function getPosString(pos: string[], i: number, name: string): string {
    const v = pos[i];
    if (v === undefined) throw new Error(`Missing argument ${name}`);
    return v;
}

function getPosNumber(
    pos: string[],
    i: number,
    name: string,
    isPositive?: boolean,
): number {
    const n = Number(getPosString(pos, i, name));
    if (isPositive) {
        if (!Number.isInteger(n) || n <= 0) {
            throw new Error(`Wrong usage! ${name} must be a positive integer`);
        }
    } else {
        if (!Number.isInteger(n)) {
            throw new Error(`Wrong usage! ${name} must be an integer`);
        }
    }
    return n;
}

function getOptNumber(
    values: Record<string, unknown>,
    name: string,
    isPositive?: boolean,
): number | undefined {
    let n: number | undefined;
    if (values[name] === undefined) {
        n = undefined;
    } else if (typeof values[name] === "string") {
        n = Number(values[name]);
        if (isPositive) {
            if (!Number.isInteger(n) || n <= 0) {
                throw new Error(
                    `Wrong usage! ${name} must be a positive integer`,
                );
            }
        } else {
            if (!Number.isInteger(n)) {
                throw new Error(`Wrong usage! ${name} must be an integer`);
            }
        }
    } else {
        throw new Error(`Type error: ${values[name]}`);
    }
    return n;
}

function getCommandDescription(command: Command): string {
    let desc = "";
    if ("subcommands" in command) {
        command.subcommands.forEach((s, i) => {
            desc += `${command.name} `;
            desc += getCommandDescription(s);
            if (i !== command.subcommands.length - 1) {
                desc += "\n";
            }
        });
    } else {
        desc += `${command.name}`;
        command.positionals.forEach((p) => {
            desc += ` ${p}`;
        });
        for (const o in command.options) {
            desc += ` [--${o}]`;
        }
        desc += `: ${command.description}`;
    }
    return desc;
}

const COMMANDS: Command[] = [
    {
        name: "import",
        description: "Import a csv with transactions",
        positionals: ["<path>"],
        options: {},
        run: (pos) => {
            importTransactions(getPosString(pos, 0, "<path>"));
            console.log("Import successful");
        },
    },
    {
        name: "accounts",
        subcommands: [
            {
                name: "list",
                description: "List accounts",
                positionals: [],
                options: {},
                run: () => {
                    getAccounts().forEach((account) => {
                        console.log(
                            `${account.id} "${account.name}": ${account.iban}, ${account.bank}, ${account.currency}, (${account.type})`,
                        );
                    });
                },
            },
        ],
    },
    {
        name: "transactions",
        subcommands: [
            {
                name: "list",
                description: "List transactions of an account",
                positionals: ["<accountId>"],
                options: {
                    limit: {
                        type: "string",
                    },
                    sort: {
                        type: "string",
                    },
                },
                run: (pos, values) => {
                    const id = getPosNumber(pos, 0, "accountId", true);
                    let limit = getOptNumber(values, "limit", true);
                    const sort = values.sort;
                    if (
                        !(
                            sort === "ASC" ||
                            sort === "DESC" ||
                            sort === undefined
                        )
                    ) {
                        throw new Error(
                            `Wrong usage!\nsort must be 'ASC' or 'DESC'`,
                        );
                    }
                    getTransactions(id, limit, sort).forEach((t) => {
                        console.log(
                            `${t.id} from/to "${t.applicantRecipient}", booked on ${formatDate(t.booked)}, amount: ${formatAmount(t.amount)}, balance after: ${formatAmount(t.balance)}${t.categoryId ? `, category: ${t.categoryId} (${t.categorySource}${t.categorySource === "rule" ? `: ${t.appliedRuleId}` : ""})` : ""}`,
                        );
                    });
                },
            },
        ],
    },
    {
        name: "balance",
        description: "Get the current balance of an account",
        positionals: ["<accountId>"],
        options: {},
        run: (pos) => {
            const id = getPosNumber(pos, 0, "accountId", true);
            console.log(
                "Current balance: " + formatAmount(getCurrentBalance(id)),
            );
        },
    },
    {
        name: "months",
        description: "Get a monthly summary of an account",
        positionals: ["<accountId>"],
        options: {},
        run: (pos) => {
            const id = getPosNumber(pos, 0, "accountId", true);
            formatMonthlySummaries(getMonthlyOverview(id)).forEach((s) =>
                console.log(s),
            );
        },
    },
    {
        name: "categories",
        subcommands: [
            {
                name: "list",
                description: "List categories",
                positionals: [],
                options: {},
                run: () => {
                    getCategories().forEach((c) => {
                        console.log(
                            `${c.id} ${c.name} ${c.parentId ? `(parent: ${c.parentId})` : "(no parent)"}`,
                        );
                    });
                },
            },
            {
                name: "create",
                description: "Create a new category",
                positionals: ["<name>"],
                options: {
                    parentId: { type: "string" },
                },
                run: (pos, values) => {
                    const name = getPosString(pos, 0, "name");
                    let parentId =
                        getOptNumber(values, "parentId", true) ?? null;
                    const c = createCategory({
                        name: name,
                        parentId: parentId,
                    });
                    console.log(
                        `New category created: ${c.id} ${c.name} ${c.parentId ? `(parent: ${c.parentId})` : "(no parent)"}`,
                    );
                },
            },
            {
                name: "assign",
                description: "Assign a category to a transaction",
                positionals: ["<transactionId>", "<categoryId>"],
                options: {},
                run: (pos) => {
                    const transactionId = getPosNumber(
                        pos,
                        0,
                        "transactionId",
                        true,
                    );
                    const categoryId = getPosNumber(pos, 1, "categoryId", true);
                    assignCategory(transactionId, categoryId, "manual");
                    console.log("Category assigned successfully");
                },
            },
            {
                name: "unassign",
                description: "Unassign any categories from a transaction",
                positionals: ["<transactionId>"],
                options: {},
                run: (pos) => {
                    const transactionId = getPosNumber(pos, 0, "transactionId");
                    unassignCategory(transactionId);
                    console.log(
                        `Unassigned category from transaction ${transactionId}`,
                    );
                },
            },
        ],
    },
    {
        name: "rules",
        subcommands: [
            {
                name: "list",
                description: "List rules",
                positionals: [],
                options: {},
                run: () => {
                    getRules().forEach((r) => {
                        console.log(
                            `${r.id} ${r.matchField} ${r.matchType} "${r.matchValue}" (priority: ${r.priority}, active: ${r.isActive})`,
                        );
                    });
                },
            },
            {
                name: "create",
                description: "Create a new rule",
                positionals: [
                    "<matchField>",
                    "<matchType>",
                    "<matchValue>",
                    "<categoryId>",
                ],
                options: {},
                run: (pos) => {
                    const matchField = getPosString(pos, 0, "matchField");
                    const matchType = getPosString(pos, 1, "matchType");
                    const matchValue = getPosString(pos, 2, "matchValue");
                    const categoryId = getPosNumber(pos, 3, "categoryId", true);
                    if (
                        !(
                            matchField === "counterparty" ||
                            matchField === "bookingText" ||
                            matchField === "purpose"
                        )
                    ) {
                        throw new Error(
                            `Wrong usage!\nmatchField must be counterparty|bookingText|purpose`,
                        );
                    } else if (
                        !(
                            matchType === "contains" ||
                            matchType === "equals" ||
                            matchType === "startsWith"
                        )
                    ) {
                        throw new Error(
                            `Wrong usage!\nmatchType must be contains|equals|startsWith`,
                        );
                    }
                    const r = createRule({
                        matchField: matchField,
                        matchType: matchType,
                        matchValue: matchValue,
                        categoryId: categoryId,
                    });
                    console.log(
                        `Rule created: ${r.id} ${r.matchField} ${r.matchType} "${r.matchValue}" (priority: ${r.priority}, active: ${r.isActive})`,
                    );
                },
            },
            {
                name: "toggle",
                description: "Toggle whether a rule is active",
                positionals: ["<ruleId>"],
                options: {},
                run: (pos) => {
                    const ruleId = getPosNumber(pos, 0, "ruleId", true);
                    console.log(
                        `Set rule ${ruleId} to ${toggleRule(ruleId) ? "active" : "inactive"}`,
                    );
                },
            },
            {
                name: "sort",
                description: "Change the priority of a rule",
                positionals: ["ruleId"],
                options: {
                    beforeId: { type: "string" },
                    afterId: { type: "string" },
                },
                run: (pos, values) => {
                    const ruleId = getPosNumber(pos, 0, "ruleId", true);
                    const beforeId = getOptNumber(values, "beforeId", true);
                    const afterId = getOptNumber(values, "afterId", true);
                    console.log(
                        `Set priority of rule ${ruleId} to ${sortRule(ruleId, beforeId, afterId)}`,
                    );
                },
            },
        ],
    },
];

function main() {
    try {
        const args = process.argv.slice(2);
        const first = args[0];
        const command = COMMANDS.find((c) => c.name === first);
        if (!command) {
            console.log(
                "============================ Finanzen ============================",
            );
            console.log("A small tool to keep track of your finances.\n");
            let desc = "";
            COMMANDS.forEach((c) => {
                desc += getCommandDescription(c) + "\n";
            });
            console.log(desc);
            if (first) {
                throw new Error(`Wrong usage!`);
            }
            return;
        }
        let leaf: CommandLeaf;
        let remainingArgs: string[];
        if ("subcommands" in command) {
            const subcommand = command.subcommands.find(
                (s) => s.name === args[1],
            );
            if (!subcommand) {
                throw new Error(
                    `Wrong usage!\n${getCommandDescription(command)}`,
                );
            }
            leaf = subcommand;
            remainingArgs = args.slice(2);
        } else {
            leaf = command;
            remainingArgs = args.slice(1);
        }
        const { positionals, values } = parseArgs({
            args: remainingArgs,
            options: leaf.options,
            allowPositionals: true,
            strict: true,
        });
        if (positionals.length !== leaf.positionals.length) {
            throw new Error(`Wrong usage!\n${getCommandDescription(command)}`);
        }
        leaf.run(positionals, values);
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
            process.exitCode = 1;
        } else {
            throw new Error(`Unknown error: ${error}`);
        }
    }
}

main();
