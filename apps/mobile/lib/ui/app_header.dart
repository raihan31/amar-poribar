import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

/// Screen header with a back button and title. Board: every inner screen.
class AppHeader extends StatelessWidget {
  const AppHeader({
    super.key,
    required this.title,
    this.back = true,
    this.actions = const [],
  });

  static const double backSize = 56;
  static const double titleSize = 26;
  static const String backLabel = 'পেছনে';

  final String title;
  final bool back;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          if (back)
            Semantics(
              button: true,
              label: backLabel,
              excludeSemantics: true,
              onTap: () => Navigator.maybePop(context),
              child: InkResponse(
                onTap: () => Navigator.maybePop(context),
                radius: backSize / 2,
                child: const SizedBox(
                  width: backSize,
                  height: backSize,
                  child: Icon(Icons.arrow_back, size: 30, color: AppTokens.ink),
                ),
              ),
            )
          else
            const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: titleSize,
                fontWeight: FontWeight.w700,
                color: AppTokens.ink,
              ),
            ),
          ),
          ...actions,
        ],
      ),
    );
  }
}
