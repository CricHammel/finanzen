import type { SQLOutputValue } from "node:sqlite";
import { db } from "./db.ts";
import type { NewRule, Rule } from "./types.ts";

function rowToRule(row: Record<string, SQLOutputValue>): Rule {
    if (
        typeof row.id !== "number" ||
        typeof row.matchType !== "string" ||
        !(
            row.matchType === "contains" ||
            row.matchType === "equals" ||
            row.matchType === "startsWith"
        ) ||
        typeof row.matchField !== "string" ||
        !(
            row.matchField === "counterparty" ||
            row.matchField === "bookingText" ||
            row.matchField === "purpose"
        ) ||
        typeof row.matchValue !== "string" ||
        typeof row.categoryId !== "number" ||
        typeof row.priority !== "number" ||
        typeof row.isActive !== "number" ||
        !(row.isActive === 0 || row.isActive === 1)
    ) {
        throw new Error(
            `Wrong database format for row: id: ${row.id}, matchType: ${row.matchType}, matchField: ${row.matchField}, matchValue: ${row.matchValue}, categoryId: ${row.categoryId}, priority: ${row.priority}, isActive: ${row.isActive}`,
        );
    }
    return {
        id: row.id,
        matchType: row.matchType,
        matchField: row.matchField,
        matchValue: row.matchValue,
        categoryId: row.categoryId,
        priority: row.priority,
        isActive: Boolean(row.isActive),
    };
}

export function getRules(): Rule[] {
    const rows = db.prepare("SELECT * FROM rules ORDER BY priority").all();
    const rules: Rule[] = [];
    for (const row of rows) {
        rules.push(rowToRule(row));
    }
    return rules;
}

export function createRule(rule: NewRule): Rule {
    const categoryRow = db
        .prepare("SELECT id FROM categories WHERE id = ?")
        .get(rule.categoryId);
    if (!categoryRow) {
        throw new Error(`Category with id ${rule.categoryId} not found`);
    }
    const ruleRow = db
        .prepare(
            "INSERT INTO rules (matchType, matchField, matchValue, categoryId, priority, isActive) VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(priority), 0) + 1 FROM rules), 1) RETURNING id, priority",
        )
        .get(rule.matchType, rule.matchField, rule.matchValue, rule.categoryId);
    if (
        !ruleRow ||
        typeof ruleRow.id !== "number" ||
        typeof ruleRow.priority !== "number"
    ) {
        throw new Error(
            "Database error! Rule insert did not return currect values",
        );
    }
    return {
        id: ruleRow.id,
        matchType: rule.matchType,
        matchField: rule.matchField,
        matchValue: rule.matchValue,
        categoryId: rule.categoryId,
        priority: ruleRow.priority,
        isActive: true,
    };
}

export function toggleRule(ruleId: number): boolean {
    const ruleRow = db
        .prepare("SELECT isActive FROM rules WHERE id = ?")
        .get(ruleId);
    if (!ruleRow) {
        throw new Error(`Rule with id ${ruleId} not found`);
    }
    const isActive = ruleRow.isActive;
    if (typeof isActive !== "number" || !(isActive === 0 || isActive === 1)) {
        throw new Error(`Wrong database format for row: isActive: ${isActive}`);
    }
    db.prepare("UPDATE rules SET isActive = ? WHERE id = ?").run(
        isActive ? 0 : 1,
        ruleId,
    );
    return !Boolean(isActive);
}

function setPriority(ids: number[]) {
    try {
        db.exec("BEGIN");
        // Set negative sort order to avoid unique constraint while reordering
        db.prepare("UPDATE rules SET priority = -priority").run();
        ids.forEach((id, i) => {
            db.prepare("UPDATE rules SET priority = ? WHERE id = ?").run(
                i + 1,
                id,
            );
        });
        db.exec("COMMIT");
    } catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }
}

export function sortRule(
    ruleId: number,
    beforeId?: number,
    afterId?: number,
): number {
    const rules = db.prepare("SELECT id FROM rules ORDER BY priority").all();
    const indexFrom = rules.findIndex((r) => r.id === ruleId);
    if (indexFrom === -1) {
        throw new Error(`Rule with id ${ruleId} not found`);
    }
    const ids: number[] = rules.map((r) => {
        if (typeof r.id !== "number") {
            throw new Error(`Wrong database format for row: id: ${r.id}`);
        }
        return r.id;
    });
    if (!beforeId && !afterId) {
        throw new Error("One argument of beforeId and afterId has to be given");
    } else if (beforeId && afterId) {
        throw new Error(
            "Only one argument of beforeId and afterId has to be given",
        );
    } else if (
        !rules.find((r) => r.id === beforeId) &&
        !rules.find((r) => r.id === afterId)
    ) {
        throw new Error(`Rule with id ${beforeId ?? afterId} not found`);
    }
    let indexTo: number;
    if (beforeId) {
        indexTo = ids.findIndex((id) => id === beforeId);
    } else {
        indexTo = ids.findIndex((id) => id === afterId) + 1;
    }
    ids.splice(indexFrom, 1);
    indexTo = indexTo > indexFrom ? indexTo - 1 : indexTo;
    ids.splice(indexTo, 0, ruleId);
    setPriority(ids);
    return indexTo + 1;
}
