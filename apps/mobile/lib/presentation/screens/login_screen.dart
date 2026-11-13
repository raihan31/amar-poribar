import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n/l10n_x.dart';
import '../../data/api/api_client.dart';
import '../providers/auth_provider.dart';

/// Phone + OTP sign-in (SRS FR-AUTH-01).
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  bool _sent = false;
  bool _busy = false;
  String? _hint;
  String? _error;

  Future<void> _run(Future<void> Function() fn) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await fn();
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _requestOtp() => _run(() async {
        final dev =
            await ref.read(apiClientProvider).requestOtp(_phone.text.trim());
        setState(() {
          _sent = true;
          _hint = dev == null ? null : context.l10n.auth_login_devOtp(dev);
        });
      });

  Future<void> _verify() => _run(() async {
        await ref
            .read(authProvider.notifier)
            .signIn(_phone.text.trim(), _code.text.trim());
        // The router guard moves on from here: tutorial on first sign-in, else `from` or home.
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.auth_login_title)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: context.l10n.auth_login_phoneLabel,
                hintText: context.l10n.auth_login_phoneHint,
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            if (_sent) ...[
              TextField(
                controller: _code,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: context.l10n.auth_login_codeLabel,
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
            ],
            SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: _busy ? null : (_sent ? _verify : _requestOtp),
                child: Text(
                  _sent
                      ? context.l10n.auth_login_submit
                      : context.l10n.auth_login_sendOtp,
                ),
              ),
            ),
            if (_hint != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(_hint!),
              ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
