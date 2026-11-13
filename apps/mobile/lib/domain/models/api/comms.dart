import 'package:json_annotation/json_annotation.dart';

part 'comms.g.dart';

// Shapes follow SRS 6.1 (module comms). No server route exists yet, so there
// are no shared fixtures for these; they are not covered by the contract test.

@JsonSerializable(explicitToJson: true)
class Conversation {
  final String id;
  final String familyId;
  final String kind; // group | direct
  final String? key;
  final int unread;
  const Conversation({
    required this.id,
    required this.familyId,
    required this.kind,
    this.key,
    this.unread = 0,
  });
  factory Conversation.fromJson(Map<String, dynamic> j) =>
      _$ConversationFromJson(j);
  Map<String, dynamic> toJson() => _$ConversationToJson(this);
}

@JsonSerializable(explicitToJson: true)
class Message {
  final String id;
  final String conversationId;
  final String senderId;
  final String kind; // text | voice | video | system
  final String? body;
  final String? mediaId;
  final String createdAt;
  final String? deletedAt;
  const Message({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.kind,
    this.body,
    this.mediaId,
    required this.createdAt,
    this.deletedAt,
  });
  factory Message.fromJson(Map<String, dynamic> j) => _$MessageFromJson(j);
  Map<String, dynamic> toJson() => _$MessageToJson(this);
}

@JsonSerializable(explicitToJson: true)
class Nudge {
  final String id;
  final String familyId;
  final String senderId;
  final String recipientId;
  final String phraseId;
  final int intensity;
  final String state; // sent | delivered | seen | replied
  final String? reply; // coming | later | call
  final String createdAt;
  const Nudge({
    required this.id,
    required this.familyId,
    required this.senderId,
    required this.recipientId,
    required this.phraseId,
    required this.intensity,
    required this.state,
    this.reply,
    required this.createdAt,
  });
  factory Nudge.fromJson(Map<String, dynamic> j) => _$NudgeFromJson(j);
  Map<String, dynamic> toJson() => _$NudgeToJson(this);
}

@JsonSerializable(explicitToJson: true)
class NudgePhrase {
  final String id;
  final String textBn;
  final String textEn;
  final int sort;
  const NudgePhrase({
    required this.id,
    required this.textBn,
    required this.textEn,
    required this.sort,
  });
  factory NudgePhrase.fromJson(Map<String, dynamic> j) =>
      _$NudgePhraseFromJson(j);
  Map<String, dynamic> toJson() => _$NudgePhraseToJson(this);
}

/// `GET /v1/nudge-phrases`.
@JsonSerializable(explicitToJson: true)
class PhraseCatalogue {
  final List<NudgePhrase> items;
  const PhraseCatalogue({required this.items});
  factory PhraseCatalogue.fromJson(Map<String, dynamic> j) =>
      _$PhraseCatalogueFromJson(j);
  Map<String, dynamic> toJson() => _$PhraseCatalogueToJson(this);
}

@JsonSerializable(explicitToJson: true)
class IceServer {
  final List<String> urls;
  final String? username;
  final String? credential;
  const IceServer({required this.urls, this.username, this.credential});
  factory IceServer.fromJson(Map<String, dynamic> j) => _$IceServerFromJson(j);
  Map<String, dynamic> toJson() => _$IceServerToJson(this);
}

/// `GET /v1/rtc/ice`.
@JsonSerializable(explicitToJson: true)
class IceServers {
  final List<IceServer> iceServers;
  final int ttlSeconds;
  const IceServers({required this.iceServers, required this.ttlSeconds});
  factory IceServers.fromJson(Map<String, dynamic> j) =>
      _$IceServersFromJson(j);
  Map<String, dynamic> toJson() => _$IceServersToJson(this);
}
