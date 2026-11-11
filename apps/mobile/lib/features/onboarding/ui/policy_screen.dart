import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/l10n/l10n_x.dart';
import '../../../core/l10n/locale_controller.dart';
import '../../../core/theme/tokens.dart';
import '../../../ui/app_header.dart';
import '../../../ui/big_button.dart';
import '../../../ui/listen_button.dart';
import '../data/onboarding_repository.dart';

/// The policy of the current language, fetched from `GET /v1/policy`.
final policyProvider = FutureProvider.autoDispose<PolicyDoc>(
  (ref) =>
      ref.watch(onboardingRepositoryProvider).policy(ref.watch(localeProvider)),
);

/// The full privacy policy: scrollable, with a "শুনুন" button that reads it (FR-PRIV-02).
/// Route `/consent/policy`.
class PolicyScreen extends ConsumerWidget {
  const PolicyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = context.l10n;
    final policy = ref.watch(policyProvider);
    return Scaffold(
      backgroundColor: AppTokens.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppHeader(title: l10n.onb_consent_policy),
            Expanded(
              child: policy.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, __) => Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        l10n.onb_consent_policyError,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 20),
                      ),
                      const SizedBox(height: 16),
                      BigButton(
                        label: l10n.onb_consent_retry,
                        onPressed: () => ref.invalidate(policyProvider),
                      ),
                    ],
                  ),
                ),
                data: (doc) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      child: Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: ListenButton(text: doc.body),
                      ),
                    ),
                    Expanded(
                      child: Scrollbar(
                        child: SingleChildScrollView(
                          key: const Key('policy_scroll'),
                          padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
                          child: Text(
                            doc.body,
                            style: const TextStyle(
                              fontSize: 18,
                              height: 1.5,
                              color: AppTokens.ink,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
