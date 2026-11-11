import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'redirects.dart';

/// Visible stand-in for a screen a later task builds.
class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen(this.routeName, {super.key});

  final String routeName;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('শীঘ্রই আসছে', style: TextStyle(fontSize: 22)),
            const SizedBox(height: 8),
            Text(routeName),
          ],
        ),
      ),
    );
  }
}

/// Shown for an unknown route or id.
class ErrorScreen extends StatelessWidget {
  const ErrorScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'এটি খুঁজে পাওয়া যায়নি',
              style: TextStyle(fontSize: 22),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => context.go(Routes.home),
              child: const Text('হোমে যান'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Tells the person the sign-in ended and brings them back to where they were.
class SessionExpiredScreen extends StatelessWidget {
  const SessionExpiredScreen({super.key, this.from});

  final String? from;

  @override
  Widget build(BuildContext context) {
    final target = from == null
        ? Routes.login
        : '${Routes.login}?from=${Uri.encodeQueryComponent(from!)}';
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('আপনার লগইনের সময় শেষ', style: TextStyle(fontSize: 22)),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => context.go(target),
              child: const Text('আবার লগইন করুন'),
            ),
          ],
        ),
      ),
    );
  }
}
