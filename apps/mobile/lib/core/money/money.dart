/// Money as integer paisa. There is deliberately no constructor from `double`.
final class Money implements Comparable<Money> {
  final int paisa;
  const Money(this.paisa);

  factory Money.fromTaka(int taka) => Money(taka * 100);

  static const zero = Money(0);

  Money operator +(Money o) => Money(paisa + o.paisa);
  Money operator -(Money o) => Money(paisa - o.paisa);
  Money operator -() => Money(-paisa);

  bool get isNegative => paisa < 0;

  @override
  int compareTo(Money other) => paisa.compareTo(other.paisa);

  @override
  bool operator ==(Object other) => other is Money && other.paisa == paisa;

  @override
  int get hashCode => paisa.hashCode;

  @override
  String toString() => 'Money($paisa)';
}
