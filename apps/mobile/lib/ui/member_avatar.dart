import 'package:flutter/material.dart';

import '../core/theme/tokens.dart';
import '../domain/models/member.dart';

/// Initial in a colour pair with a presence dot. Board: Family.dc.html.
class MemberAvatar extends StatelessWidget {
  const MemberAvatar({
    super.key,
    required this.m,
    this.size = 56,
    this.online,
    this.showLabel = false,
  });

  static const double dotSize = 16;
  static const double ringWidth = 3;
  static const String onlineWord = 'অনলাইন';
  static const String offlineWord = 'অফলাইন';

  final Member m;
  final double size;

  /// Null hides presence entirely.
  final bool? online;
  final bool showLabel;

  @override
  Widget build(BuildContext context) {
    final c = AppTokens.avatars[m.avatarIndex.abs() % AppTokens.avatars.length];
    final initial =
        m.name.isEmpty ? '' : String.fromCharCode(m.name.runes.first);
    final avatar = SizedBox(
      width: size,
      height: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: c.bg, shape: BoxShape.circle),
            child: Text(
              initial,
              style: TextStyle(
                fontSize: size * 0.42,
                fontWeight: FontWeight.w700,
                color: c.fg,
              ),
            ),
          ),
          if (online != null)
            Positioned(
              right: -2,
              bottom: -2,
              child: Container(
                width: dotSize + ringWidth * 2,
                height: dotSize + ringWidth * 2,
                decoration: const BoxDecoration(
                  color: AppTokens.bg,
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Container(
                  width: dotSize,
                  height: dotSize,
                  decoration: BoxDecoration(
                    color: online! ? AppTokens.green : AppTokens.muted,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
    final word = online == true ? onlineWord : offlineWord;
    final withLabel = showLabel && online != null;
    return Semantics(
      container: true,
      button: true,
      label: online == null ? m.name : '${m.name}, $word',
      excludeSemantics: true,
      child: withLabel
          ? Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                avatar,
                const SizedBox(width: 10),
                Text(
                  word,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: AppTokens.muted,
                  ),
                ),
              ],
            )
          : avatar,
    );
  }
}
