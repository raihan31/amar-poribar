import 'package:json_annotation/json_annotation.dart';

import 'ledger.dart';

part 'sync.g.dart';

@JsonSerializable(explicitToJson: true)
class SyncRejected {
  final String? id;
  final String reason;
  const SyncRejected({required this.id, required this.reason});
  factory SyncRejected.fromJson(Map<String, dynamic> j) =>
      _$SyncRejectedFromJson(j);
  Map<String, dynamic> toJson() => _$SyncRejectedToJson(this);
}

@JsonSerializable(explicitToJson: true)
class SyncChanges {
  final List<SyncTransactionChange> transactions;
  const SyncChanges({required this.transactions});
  factory SyncChanges.fromJson(Map<String, dynamic> j) =>
      _$SyncChangesFromJson(j);
  Map<String, dynamic> toJson() => _$SyncChangesToJson(this);
}

/// Body of `POST /v1/families/:id/sync`.
@JsonSerializable(explicitToJson: true)
class SyncRequest {
  final SyncChanges changes;
  final String? cursor;
  final String nodeId;
  const SyncRequest({
    required this.changes,
    required this.cursor,
    required this.nodeId,
  });
  factory SyncRequest.fromJson(Map<String, dynamic> j) =>
      _$SyncRequestFromJson(j);
  Map<String, dynamic> toJson() => _$SyncRequestToJson(this);
}

/// Response of the sync call. [changes] is the flat list of transaction rows.
class SyncResponse {
  final String cursor;
  final bool more;
  final int applied;
  final List<SyncRejected> rejected;
  final List<Map<String, dynamic>> changes;
  const SyncResponse(
    this.cursor,
    this.more,
    this.applied,
    this.rejected,
    this.changes,
  );

  factory SyncResponse.fromJson(Map<String, dynamic> j) => SyncResponse(
        j['cursor'] as String,
        j['more'] as bool,
        (j['applied'] as num).toInt(),
        [
          for (final x in j['rejected'] as List<dynamic>)
            SyncRejected.fromJson(x as Map<String, dynamic>),
        ],
        [
          for (final c in SyncChanges.fromJson(
            j['changes'] as Map<String, dynamic>,
          ).transactions)
            c.toJson(),
        ],
      );

  Map<String, dynamic> toJson() => {
        'applied': applied,
        'changes': {'transactions': changes},
        'cursor': cursor,
        'more': more,
        'rejected': [for (final r in rejected) r.toJson()],
      };
}
