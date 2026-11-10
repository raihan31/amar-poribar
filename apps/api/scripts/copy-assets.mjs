// tsc does not copy non-TypeScript files; the privacy policy markdown is read at runtime from dist.
import { cpSync } from "node:fs";

cpSync("src/modules/privacy/domain/policy-bn.md", "dist/modules/privacy/domain/policy-bn.md");
cpSync("src/modules/privacy/domain/policy-en.md", "dist/modules/privacy/domain/policy-en.md");
