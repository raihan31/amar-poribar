import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';

/// Amber microphone button. Board: Home.dc.html (bar) and Ask.dc.html (`.huge`).
class BigMicButton extends StatelessWidget {
  const BigMicButton({
    super.key,
    required this.onPressed,
    this.listening = false,
    this.label = 'বলুন',
  }) : huge = false;

  const BigMicButton.huge({
    super.key,
    required this.onPressed,
    this.listening = false,
    this.label = 'বলুন',
  }) : huge = true;

  static const double height = 84;
  static const double iconSize = 40;
  static const double hugeSize = 104;
  static const double hugeIconSize = 48;

  final VoidCallback onPressed;
  final bool listening;
  final String label;
  final bool huge;

  @override
  Widget build(BuildContext context) {
    final icon = Icon(
      listening ? Icons.stop_rounded : Icons.mic,
      size: huge ? hugeIconSize : iconSize,
      color: AppTokens.ink,
    );
    final text = listening ? 'শুনছি…' : label;
    return Semantics(
      container: true,
      button: true,
      label: text,
      excludeSemantics: true,
      onTap: onPressed,
      child: huge
          ? Material(
              color: AppTokens.amber,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onPressed,
                child: SizedBox(
                  width: hugeSize,
                  height: hugeSize,
                  child: Center(child: icon),
                ),
              ),
            )
          : Material(
              color: AppTokens.amber,
              shape: const StadiumBorder(),
              child: InkWell(
                customBorder: const StadiumBorder(),
                onTap: onPressed,
                child: SizedBox(
                  height: height,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      icon,
                      const SizedBox(width: 12),
                      Text(
                        text,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          color: AppTokens.ink,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
    );
  }
}
