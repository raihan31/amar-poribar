import 'dart:convert';
import 'dart:io';

import 'package:amar_poribar/domain/models/api/budget.dart';
import 'package:amar_poribar/domain/models/api/common.dart';
import 'package:amar_poribar/domain/models/api/draft.dart';
import 'package:amar_poribar/domain/models/api/family.dart';
import 'package:amar_poribar/domain/models/api/ledger.dart';
import 'package:amar_poribar/domain/models/api/me.dart';
import 'package:amar_poribar/domain/models/api/report.dart';
import 'package:amar_poribar/domain/models/api/sync.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:json_schema/json_schema.dart';

typedef _Codec = Object? Function(Object? body);

Object? _obj<T>(
  Object? b,
  T Function(Map<String, dynamic>) from,
  Object? Function(T) to,
) =>
    to(from(b! as Map<String, dynamic>));

Object? _list<T>(
  Object? b,
  T Function(Map<String, dynamic>) from,
  Object? Function(T) to,
) =>
    [for (final x in b! as List<dynamic>) to(from(x as Map<String, dynamic>))];

/// Fixture name -> decode with the Dart model and encode again.
final Map<String, _Codec> _models = {
  'account': (b) => _obj(b, ApiAccount.fromJson, (m) => m.toJson()),
  'budget-list': (b) => _obj(b, BudgetList.fromJson, (m) => m.toJson()),
  'category': (b) => _obj(b, ApiCategory.fromJson, (m) => m.toJson()),
  'draft': (b) => _obj(b, TransactionDraft.fromJson, (m) => m.toJson()),
  'error': (b) => _obj(b, ApiErrorBody.fromJson, (m) => m.toJson()),
  'family': (b) => _obj(b, Family.fromJson, (m) => m.toJson()),
  'me': (b) => _obj(b, Me.fromJson, (m) => m.toJson()),
  'member': (b) => _list(b, ApiMember.fromJson, (m) => m.toJson()),
  'monthly-ai-summary': (b) =>
      _obj(b, MonthlySummary.fromJson, (m) => m.toJson()),
  'parse-response': (b) => _obj(b, ParseResponse.fromJson, (m) => m.toJson()),
  'summary-month': (b) => _obj(b, ReportSummary.fromJson, (m) => m.toJson()),
  'sync-request': (b) => _obj(b, SyncRequest.fromJson, (m) => m.toJson()),
  'sync-response': (b) => _obj(b, SyncResponse.fromJson, (m) => m.toJson()),
  'transaction-list': (b) =>
      _list(b, ApiTransaction.fromJson, (m) => m.toJson()),
  'transaction': (b) => _obj(b, ApiTransaction.fromJson, (m) => m.toJson()),
};

Directory _fixtureDir() {
  final shared = Directory('../../packages/shared/test-vectors/api');
  return shared.existsSync() ? shared : Directory('test/contract/fixtures');
}

Map<String, dynamic> _readJson(File f) =>
    jsonDecode(f.readAsStringSync()) as Map<String, dynamic>;

/// Keys that every object in [body] has, as dotted paths ("a.b", lists use "[]").
Set<String> _paths(Object? v, [String prefix = '']) {
  if (v is Map) {
    return {
      for (final e in v.entries) ...{
        '$prefix${e.key}',
        ..._paths(e.value, '$prefix${e.key}.'),
      },
    };
  }
  if (v is List) return {for (final x in v) ..._paths(x, prefix)};
  return {};
}

void main() {
  final openapi = _readJson(File('../api/openapi.json'));
  final paths = openapi['paths'] as Map<String, dynamic>;
  final components = openapi['components'];
  final files = _fixtureDir()
      .listSync()
      .whereType<File>()
      .where((f) => f.path.endsWith('.json'))
      .toList()
    ..sort((a, b) => a.path.compareTo(b.path));

  test('every fixture has a Dart model registered', () {
    final names = [
      for (final f in files) f.uri.pathSegments.last.replaceAll('.json', ''),
    ];
    expect(names, isNotEmpty);
    expect(
      names.where((n) => !_models.containsKey(n)),
      isEmpty,
      reason: 'add a model and a _models entry for each new fixture',
    );
  });

  for (final f in files) {
    final name = f.uri.pathSegments.last.replaceAll('.json', '');
    final codec = _models[name];
    if (codec == null) continue;

    test('$name: operation exists, schema accepts it, model round-trips', () {
      final fx = _readJson(f);
      final op = (fx['_operation'] as String).split(' ');
      final method = op[0].toLowerCase();
      final path = op[1];
      final item = (paths[path] as Map<String, dynamic>?)?[method]
          as Map<String, dynamic>?;
      expect(item, isNotNull, reason: '${fx['_operation']} not in openapi');

      final body = fx['body'];
      final schemaKeys = <String>{};
      if (fx['_kind'] == 'response') {
        final status = '${fx['_status']}';
        final res = (item!['responses'] as Map<String, dynamic>?)?[status]
            as Map<String, dynamic>?;
        final schema =
            ((res?['content'] as Map<String, dynamic>?)?['application/json']
                as Map<String, dynamic>?)?['schema'];
        if (schema is Map<String, dynamic>) {
          final js = JsonSchema.create({...schema, 'components': components});
          final r = js.validate(body);
          expect(r.errors, isEmpty, reason: 'fixture vs schema: ${r.errors}');
          schemaKeys.addAll(_schemaProps(schema, ''));
        }
      }

      // Decode with the model and encode again. A required field missing in the
      // model drops a key; a model field with no property in the API adds one.
      final encoded = jsonDecode(jsonEncode(codec(body)));
      expect(encoded, equals(body), reason: 'model drifted from fixture');
      if (schemaKeys.isNotEmpty) {
        expect(_paths(encoded), schemaKeys, reason: 'model vs schema fields');
      }
    });
  }
}

Set<String> _schemaProps(Map<String, dynamic> s, String prefix) {
  final out = <String>{};
  if (s['items'] is Map<String, dynamic>) {
    out.addAll(_schemaProps(s['items'] as Map<String, dynamic>, prefix));
  }
  final props = s['properties'] as Map<String, dynamic>?;
  props?.forEach((k, v) {
    out.add('$prefix$k');
    if (v is Map<String, dynamic>) out.addAll(_schemaProps(v, '$prefix$k.'));
  });
  return out;
}
