import path from "node:path";
import * as fs from "fs";
import { DatabaseSync } from "node:sqlite";

const dbPath = path.join(import.meta.dirname, "../db.sqlite3");
const schemaPath = path.join(import.meta.dirname, "../schema.sql");

function ensureSchema(db: DatabaseSync) {
    const userVersion = db.prepare("PRAGMA user_version").get()![
        "user_version"
    ];
    if (typeof userVersion !== "number") {
        throw new Error("No user_version, database malformed");
    }
    if (userVersion !== 0) {
        return;
    }
    const schema = fs.readFileSync(schemaPath, "utf8").toString();
    db.exec(schema);
    db.exec("PRAGMA user_version = 1");
}

const db = new DatabaseSync(dbPath);
ensureSchema(db);
export { db };
