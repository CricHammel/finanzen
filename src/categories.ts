import type { SQLOutputValue } from "node:sqlite";
import { db } from "./db.ts";
import type { Category, NewCategory } from "./types.ts";

function rowToCategory(row: Record<string, SQLOutputValue>): Category {
    if (
        typeof row.id !== "number" ||
        typeof row.name !== "string" ||
        !(typeof row.parentId === "number" || row.parentId === null)
    ) {
        throw new Error(
            `Wrong database format for row: id: ${row.id}, name: ${row.name}, parentId: ${row.parentId}`,
        );
    }
    return {
        id: row.id,
        name: row.name,
        parentId: row.parentId,
    };
}

export function getCategories(): Category[] {
    const rows = db.prepare("SELECT * FROM categories").all();
    const categories: Category[] = [];
    for (const row of rows) {
        categories.push(rowToCategory(row));
    }
    return categories;
}

export function getCategory(id: number): Category {
    const row = db.prepare("SELECT * FROM categories WHERE id = ?").get(id);
    if (!row) {
        throw new Error(`Category with id ${id} does not exist.`);
    }
    return rowToCategory(row);
}

export function getCategoryChildren(id: number): Category[] {
    const rows = db
        .prepare("SELECT * FROM categories WHERE parentId = ?")
        .all(id);
    const categories: Category[] = [];
    for (const row of rows) {
        categories.push(rowToCategory(row));
    }
    return categories;
}

export function createCategory(newCategory: NewCategory): Category {
    if (typeof newCategory.parentId === "number") {
        const parent = db
            .prepare("SELECT id FROM categories WHERE id = ?")
            .get(newCategory.parentId);
        if (!parent) {
            throw new Error(
                `Parent category with id ${newCategory.parentId} does not exist`,
            );
        }
    }
    const existing = db
        .prepare("SELECT name FROM categories WHERE name = ?")
        .get(newCategory.name);
    if (existing) {
        throw new Error(
            `Category with name "${newCategory.name}" already exists`,
        );
    }
    const id = db
        .prepare("INSERT INTO categories (name, parentId) VALUES (?, ?)")
        .run(
            newCategory.name,
            typeof newCategory.parentId === "number"
                ? newCategory.parentId
                : null,
        ).lastInsertRowid;
    return {
        id: Number(id),
        name: newCategory.name,
        parentId: newCategory.parentId,
    };
}
