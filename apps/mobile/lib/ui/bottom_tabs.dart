import 'package:flutter/material.dart';

import '../core/money/money_format.dart';
import '../core/theme/tokens.dart';

/// Five-tab bottom bar. Board: Home.dc.html.
class AppBottomTabs extends StatelessWidget {
  const AppBottomTabs({
    super.key,
    required this.index,
    required this.onSelect,
    this.chatBadge = 0,
  });

  static const double barHeight = 72;
  static const double minTabWidth = 48;
  static const List<String> labels = [
    'হোম',
    'কথা',
    'তালিকা',
    'বাজেট',
    'পরিবার',
  ];
  static const List<IconData> icons = [
    Icons.home_rounded,
    Icons.chat_bubble_rounded,
    Icons.list_alt_rounded,
    Icons.pie_chart_rounded,
    Icons.people_rounded,
  ];
  static const int chatIndex = 1;

  final int index;
  final ValueChanged<int> onSelect;
  final int chatBadge;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: barHeight,
      decoration: const BoxDecoration(
        color: AppTokens.white,
        border: Border(top: BorderSide(color: AppTokens.border)),
      ),
      child: Row(
        children: [
          for (var i = 0; i < labels.length; i++) Expanded(child: _tab(i)),
        ],
      ),
    );
  }

  Widget _tab(int i) {
    final selected = i == index;
    final color = selected ? AppTokens.green : AppTokens.muted;
    final showBadge = i == chatIndex && chatBadge > 0;
    return Semantics(
      button: true,
      selected: selected,
      label: labels[i],
      excludeSemantics: true,
      onTap: () => onSelect(i),
      child: InkWell(
        onTap: () => onSelect(i),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(icons[i], size: 28, color: color),
                if (showBadge)
                  Positioned(
                    right: -10,
                    top: -6,
                    child: Container(
                      constraints:
                          const BoxConstraints(minWidth: 20, minHeight: 20),
                      padding: const EdgeInsets.symmetric(horizontal: 5),
                      decoration: const BoxDecoration(
                        color: AppTokens.danger,
                        borderRadius: BorderRadius.all(Radius.circular(10)),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        toBanglaDigits('$chatBadge'),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppTokens.white,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              labels[i],
              style: TextStyle(
                fontSize: 15,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
