import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/theme/tokens.dart';
import '../presentation/providers/auth_provider.dart';

/// "শুনুন" button that reads [text] aloud. Board: Ask.dc.html (answer card).
class ListenButton extends ConsumerStatefulWidget {
  const ListenButton({super.key, required this.text});

  static const double minHeight = 56;
  static const String listenLabel = 'শুনুন';
  static const String stopLabel = 'থামুন';

  final String text;

  @override
  ConsumerState<ListenButton> createState() => _ListenButtonState();
}

class _ListenButtonState extends ConsumerState<ListenButton> {
  bool _speaking = false;

  Future<void> _toggle() async {
    final voice = ref.read(voiceServiceProvider);
    if (_speaking) {
      setState(() => _speaking = false);
      await voice.stopSpeaking();
      return;
    }
    setState(() => _speaking = true);
    try {
      await voice.speak(widget.text);
    } finally {
      if (mounted) setState(() => _speaking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final label = _speaking ? ListenButton.stopLabel : ListenButton.listenLabel;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      onTap: _toggle,
      child: Material(
        color: AppTokens.greenTint,
        shape: const StadiumBorder(),
        child: InkWell(
          customBorder: const StadiumBorder(),
          onTap: _toggle,
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: ListenButton.minHeight,
              minWidth: ListenButton.minHeight,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    _speaking ? Icons.stop_circle_outlined : Icons.volume_up,
                    size: 26,
                    color: AppTokens.deepGreen,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    label,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppTokens.deepGreen,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
