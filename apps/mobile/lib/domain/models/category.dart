import 'enums.dart';

class Category {
  final String id;
  final String name;
  final String icon;
  final String colorHex;
  final TransactionType type;

  // CRDT specific fields
  final int isDeleted; 
  final String hlc;

  Category({
    required this.id,
    required this.name,
    required this.icon,
    required this.colorHex,
    required this.type,
    this.isDeleted = 0,
    required this.hlc,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'icon': icon,
      'color_hex': colorHex,
      'type': type.name,
      'is_deleted': isDeleted,
      'hlc': hlc,
    };
  }

  factory Category.fromMap(Map<String, dynamic> map) {
    return Category(
      id: map['id'] as String,
      name: map['name'] as String,
      icon: map['icon'] as String,
      colorHex: map['color_hex'] as String,
      type: TransactionType.fromString(map['type']),
      isDeleted: map['is_deleted'] as int,
      hlc: map['hlc'] as String,
    );
  }
}
