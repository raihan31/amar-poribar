import { randomBytes } from "node:crypto";
import type { CreateCategoryInput, UpdateCategoryInput } from "@amar-poribar/shared";
import { HttpError } from "../../../platform/errors.js";
import { catalogRepo, type Category } from "../infra/catalog.repo.js";
import type { LedgerDeps } from "./deps.js";

// FR-CAT-02: add, rename, hide and choose an icon.
export function createCategory(deps: LedgerDeps, familyId: string, body: CreateCategoryInput): Promise<Category> {
  return catalogRepo.insertCategory(deps.db, { ...body, key: `custom_${randomBytes(6).toString("hex")}`, familyId });
}

export async function updateCategory(
  deps: LedgerDeps,
  familyId: string,
  categoryId: string,
  body: UpdateCategoryInput,
): Promise<Category> {
  const row = await catalogRepo.updateCategory(deps.db, familyId, categoryId, body);
  if (!row) throw new HttpError(404, "not_found", "Category not found");
  return row;
}
