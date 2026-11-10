// Local ESLint plugin `amar` (SRS 11.3, DEC-18).
//  - staff-safe-facade: functions tagged `@staff-safe` must have a declared return type that
//    contains no PRIVATE_FIELDS property (depth <= 4) and no any/unknown.
//  - admin-imports-only-staff-safe: the admin module may import from other modules only
//    types or functions tagged `@staff-safe`.
import ts from "typescript";
import { PRIVATE_FIELDS } from "../../packages/shared/src/private-fields.ts";

const PRIVATE = new Set(PRIVATE_FIELDS);
const MAX_DEPTH = 4;
const TAG = /@staff-safe\b/;

function hasTag(sourceCode, node) {
  let n = node;
  // `export function f` / `export const f = ...`: the comment sits before the export.
  while (n) {
    if (sourceCode.getCommentsBefore(n).some((c) => c.type === "Block" && TAG.test(c.value))) return true;
    if (n.parent && /^(ExportNamedDeclaration|VariableDeclaration)$/.test(n.parent.type)) n = n.parent;
    else break;
  }
  return false;
}

function tsTagged(node) {
  return ts.getJSDocTags(node).some((t) => t.tagName.text === "staff-safe");
}

/** Returns the violations found in a type: [{ kind: "private" | "any", name }] */
function inspectType(checker, program, type) {
  const found = [];
  const seen = new Set();
  const walk = (t, depth) => {
    if (t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
      found.push({ kind: "any", name: checker.typeToString(t) });
      return;
    }
    if (t.isUnionOrIntersection()) {
      t.types.forEach((x) => walk(x, depth));
      return;
    }
    if (!(t.flags & ts.TypeFlags.Object)) return;
    if (seen.has(t)) return;
    seen.add(t);
    const decl = t.symbol?.declarations?.[0];
    const isLib = decl && program.isSourceFileDefaultLibrary(decl.getSourceFile());
    if (t.objectFlags & ts.ObjectFlags.Reference) {
      // Promise<T>, Array<T>, Map<K,V>, tuples: look at the type arguments.
      checker.getTypeArguments(t).forEach((a) => walk(a, depth));
    }
    if (isLib) return;
    if (depth > MAX_DEPTH) return;
    for (const p of checker.getPropertiesOfType(t)) {
      if (depth <= MAX_DEPTH && PRIVATE.has(p.getName())) found.push({ kind: "private", name: p.getName() });
      const pd = p.valueDeclaration ?? p.declarations?.[0];
      if (pd) walk(checker.getTypeOfSymbolAtLocation(p, pd), depth + 1);
    }
  };
  walk(type, 1);
  return found;
}

function services(context) {
  const s = context.sourceCode.parserServices;
  if (!s?.program || !s.esTreeNodeToTSNodeMap) {
    throw new Error("amar/staff-safe rules need type information (parserOptions.projectService).");
  }
  return s;
}

const keyName = (node, fallback) => node.key?.name ?? fallback;

const staffSafeFacade = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      privateField: "@staff-safe function `{{fn}}` exposes private field `{{name}}` in its return type.",
      anyType: "@staff-safe function `{{fn}}` must not return `{{name}}`; declare a precise aggregate type.",
      noReturnType: "@staff-safe function `{{fn}}` must declare its return type.",
    },
  },
  create(context) {
    const { program, esTreeNodeToTSNodeMap } = services(context);
    const checker = program.getTypeChecker();
    const check = (node, fnNode, name) => {
      if (!hasTag(context.sourceCode, node)) return;
      if (!fnNode.returnType) {
        context.report({ node, messageId: "noReturnType", data: { fn: name } });
        return;
      }
      const sig = checker.getSignatureFromDeclaration(esTreeNodeToTSNodeMap.get(fnNode));
      if (!sig) return;
      const seen = new Set();
      for (const v of inspectType(checker, program, sig.getReturnType())) {
        const key = `${v.kind}:${v.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        context.report({
          node,
          messageId: v.kind === "private" ? "privateField" : "anyType",
          data: { fn: name, name: v.name },
        });
      }
    };
    return {
      FunctionDeclaration(node) {
        check(node, node, node.id?.name ?? "(anonymous)");
      },
      VariableDeclarator(node) {
        const init = node.init;
        if (init && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")) {
          check(node, init, keyName({ key: node.id }, "(anonymous)"));
        }
      },
      TSMethodSignature(node) {
        check(node, node, keyName(node, "(method)"));
      },
      TSPropertySignature(node) {
        const fn = node.typeAnnotation?.typeAnnotation;
        if (fn?.type === "TSFunctionType") check(node, fn, keyName(node, "(property)"));
      },
      MethodDefinition(node) {
        check(node, node.value, keyName(node, "(method)"));
      },
    };
  },
};

const adminImportsOnlyStaffSafe = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      untagged:
        "admin may import only types or functions tagged `@staff-safe` from other modules; `{{name}}` is neither.",
    },
  },
  create(context) {
    const { program, esTreeNodeToTSNodeMap } = services(context);
    const checker = program.getTypeChecker();
    const ok = (sym) => {
      if (sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
      if (sym.flags & ts.SymbolFlags.Type && !(sym.flags & ts.SymbolFlags.Value)) return true;
      return (sym.declarations ?? []).some((d) => {
        if (tsTagged(d)) return true;
        // `/** @staff-safe */ export const f = ...` tags the variable statement.
        return ts.isVariableDeclaration(d) && tsTagged(d.parent.parent);
      });
    };
    return {
      ImportDeclaration(node) {
        if (node.importKind === "type") return;
        for (const spec of node.specifiers) {
          if (spec.type === "ImportSpecifier" && spec.importKind === "type") continue;
          const sym = checker.getSymbolAtLocation(esTreeNodeToTSNodeMap.get(spec.local));
          if (!sym || !ok(sym)) context.report({ node: spec, messageId: "untagged", data: { name: spec.local.name } });
        }
      },
    };
  },
};

export default {
  meta: { name: "eslint-plugin-amar" },
  rules: {
    "staff-safe-facade": staffSafeFacade,
    "admin-imports-only-staff-safe": adminImportsOnlyStaffSafe,
  },
};
