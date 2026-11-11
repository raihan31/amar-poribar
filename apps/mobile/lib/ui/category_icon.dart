import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

/// Icon for each default category key (SRS FR-CAT-02). The first 13 are the picture set shown by
/// A4 and D4; the rest keep every default category drawable. Unknown keys get [kFallbackIcon].
const Map<String, IconData> kCategoryIcons = {
  'bazaar': Icons.shopping_basket_outlined,
  'rent': Icons.home_outlined,
  'electricity': Icons.bolt,
  'mobile_recharge': Icons.smartphone,
  'transport': Icons.directions_bus_outlined,
  'education': Icons.menu_book_outlined,
  'medical': Icons.medical_services_outlined,
  'domestic_help': Icons.cleaning_services_outlined,
  'eating_out': Icons.restaurant,
  'clothing': Icons.checkroom,
  'charity': Icons.volunteer_activism_outlined,
  'festival': Icons.celebration_outlined,
  'other_expense': Icons.more_horiz,
  'gas': Icons.local_fire_department_outlined,
  'water': Icons.water_drop_outlined,
  'internet': Icons.wifi,
  'family_support': Icons.handshake_outlined,
  'gifts': Icons.card_giftcard,
  'household': Icons.chair_outlined,
  'personal_care': Icons.spa_outlined,
  'entertainment': Icons.movie_outlined,
  'loan_emi': Icons.account_balance_outlined,
  'fees': Icons.receipt_long_outlined,
  'salary': Icons.work_outline,
  'business': Icons.storefront_outlined,
  'remittance': Icons.flight_takeoff,
  'rent_received': Icons.apartment,
  'other_income': Icons.savings_outlined,
};

const IconData kFallbackIcon = Icons.category_outlined;

IconData categoryIconData(String? key) => kCategoryIcons[key] ?? kFallbackIcon;

/// A category's vector icon, picked by its key (not by a family-chosen emoji).
class CategoryIcon extends StatelessWidget {
  const CategoryIcon(this.categoryKey, {super.key, this.size = 28, this.color});

  final String? categoryKey;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) => Icon(
        categoryIconData(categoryKey),
        size: size,
        color: color ?? AppTokens.ink,
      );
}
