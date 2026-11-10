/// Normal or Simple mode sizing (SRS 5.1.1).
enum UiScale {
  normal(1.0, 56),
  simple(1.3, 72);

  const UiScale(this.textScale, this.primaryHeight);

  final double textScale;
  final double primaryHeight;
}
