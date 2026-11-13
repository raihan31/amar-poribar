# Shared test vectors

JSON fixtures that the TypeScript packages and the Flutter app both test against, so a change to a field breaks both sides together. All data is synthetic (names such as "রহিম পরিবার", phone numbers `+880170000xxxx`).

## `api/*.json`

One file per response (or request) shape. Layout:

```json
{ "_operation": "GET /v1/families/{familyId}/transactions", "_kind": "response", "_status": 200, "body": [] }
```

- `_operation` is `METHOD path` exactly as in `apps/api/openapi.json`.
- `_kind` is `response` or `request` (only `sync-request.json` is a request body).
- `body` is the exact JSON the API sends (or accepts). Keys are sorted.

Do not edit these by hand. Regenerate with `pnpm exec tsx tools/gen-vectors.ts`; CI runs `pnpm exec tsx tools/gen-vectors.ts --check`.

`packages/shared/src/vectors.test.ts` checks every fixture: the operation must exist in `openapi.json`, the body must pass the OpenAPI JSON schema when the route declares one, and it must pass the strict Zod schema in `src/response-schemas.ts`.

## Other vectors

| File                | Used for                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `money.json`        | Dart display table (`paisa`, `bn`, `en`)                                                          |
| `money-ts.json`     | `formatBDT`, `parseAmountToPaisa`, `bnToLatinDigits`, `takaToPaisa` (`src/money.test.ts`)         |
| `bangla-words.json` | `numberToBanglaWords`, `amountInWords` (`src/words.test.ts`)                                      |
| `sms-parser.json`   | `parseMfsSms` table; `expected` is a subset match, `null` means not an MFS SMS (`packages/ai`)    |
| `hlc.json`          | Hybrid logical clock rules (API and mobile)                                                       |

## Loading from Dart

The mobile contract test lives in `apps/mobile/test/contract/` (created in the T-MOB tasks). From a test, the repo root is two levels above `apps/mobile`:

```dart
import 'dart:convert';
import 'dart:io';

Map<String, dynamic> loadVector(String name) {
  final file = File('../../packages/shared/test-vectors/api/$name.json');
  return jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
}

void main() {
  test('transaction decodes', () {
    final fx = loadVector('transaction');
    final model = Transaction.fromJson(fx['body'] as Map<String, dynamic>);
    expect(model.amountPaisa, 85000);
  });
}
```

`flutter test` runs with `apps/mobile` as the working directory.
