enum Role {
  father,
  mother,
  child;

  static Role fromString(String val) {
    return Role.values.firstWhere(
      (e) => e.name == val,
      orElse: () => Role.child,
    );
  }
}

enum TransactionType {
  income,
  expense;

  static TransactionType fromString(String val) {
    return TransactionType.values.firstWhere(
      (e) => e.name == val,
      orElse: () => TransactionType.expense,
    );
  }
}

enum SyncStatus {
  pending,
  synced,
  failed;

  static SyncStatus fromString(String val) {
    return SyncStatus.values.firstWhere(
      (e) => e.name == val,
      orElse: () => SyncStatus.pending,
    );
  }
}

enum BankMessageStatus {
  pending,
  approved,
  rejected;

  static BankMessageStatus fromString(String val) {
    return BankMessageStatus.values.firstWhere(
      (e) => e.name == val,
      orElse: () => BankMessageStatus.pending,
    );
  }
}
