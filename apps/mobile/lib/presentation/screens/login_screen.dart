import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
          _hint = dev == null ? null : 'Dev OTP: $dev';
        });
      });

  Future<void> _verify() => _run(() async {
        await ref
            .read(authProvider.notifier)
            .signIn(_phone.text.trim(), _code.text.trim());
        if (mounted) Navigator.pushReplacementNamed(context, '/ai-entry');
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('লগইন / Sign in')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                  labelText: 'মোবাইল নম্বর',
                  hintText: '01XXXXXXXXX',
                  border: OutlineInputBorder()),
            ),
            const SizedBox(height: 12),
            if (_sent) ...[
              TextField(
                controller: _code,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: '৬ সংখ্যার কোড', border: OutlineInputBorder()),
              ),
              const SizedBox(height: 12),
            ],
            SizedBox(
              height: 52,
              child: ElevatedButton(
                onPressed: _busy ? null : (_sent ? _verify : _requestOtp),
                child: Text(_sent ? 'লগইন' : 'OTP পাঠান'),
              ),
            ),
            if (_hint != null)
              Padding(
                  padding: const EdgeInsets.only(top: 12), child: Text(_hint!)),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(_error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
              ),
          ],
        ),
      ),
    );
  }
}
