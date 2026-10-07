import 'enums.dart';

class UserDevice {
  final String id;
  final Role role;
  final String name;
  final String publicKey; // For encrypting data targeted to this specific device (optional, for future)
  final String masterKeyHash; // Verifying they belong to the family
  
  // CRDT specific fields
  final int isDeleted; 
  final String hlc;

  UserDevice({
    required this.id,
    required this.role,
    required this.name,
    required this.publicKey,
    required this.masterKeyHash,
    this.isDeleted = 0,
    required this.hlc,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'role': role.name,
      'name': name,
      'public_key': publicKey,
      'master_key_hash': masterKeyHash,
      'is_deleted': isDeleted,
      'hlc': hlc,
    };
  }

  factory UserDevice.fromMap(Map<String, dynamic> map) {
    return UserDevice(
      id: map['id'] as String,
      role: Role.fromString(map['role']),
      name: map['name'] as String,
      publicKey: map['public_key'] as String,
      masterKeyHash: map['master_key_hash'] as String,
      isDeleted: map['is_deleted'] as int,
      hlc: map['hlc'] as String,
    );
  }
}
