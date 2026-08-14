import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MigrationRunner } from "./MigrationRunner.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export function openDatabase(filename) {
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;");
  new MigrationRunner(database, path.join(here, "migrations")).run();
  return database;
}
