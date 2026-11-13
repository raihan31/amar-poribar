import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export function apiVersion(): string {
  return (JSON.parse(readFileSync(join(apiRoot, "package.json"), "utf8")) as { version: string }).version;
}
