import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/family/state/family_providers.dart';
import '../presentation/providers/auth_provider.dart';

/// Route paths. Opaque ids are path parameters (T-MOB-08 contract).
class Routes {
  Routes._();

  static const welcome = '/welcome';
  static const login = '/login';
  static const loginCode = '/login/code';
  static const consent = '/consent';
  static const consentPolicy = '/consent/policy';
  static const join = '/join/:token';
  static const tutorial = '/tutorial';
  static const sessionExpired = '/session-expired';

  static const home = '/home';
  static const talk = '/talk';
  static const list = '/list';
  static const budget = '/budget';
  static const family = '/family';

  static const buzz = '/buzz';
  static const buzzIncoming = '/buzz/incoming/:nudgeId';
  static const conversation = '/talk/:conversationId';
  static const voiceNote = '/voice-note/:conversationId';
  static const call = '/call/:callId';
  static const add = '/add';
  static const addVoice = '/add/voice';
  static const addCategory = '/add/category';
  static const txn = '/txn/:id';
  static const receipt = '/receipt';
  static const ruleLearn = '/rule-learn';
  static const voiceFallback = '/voice-fallback';
  static const summary = '/summary';
  static const ask = '/ask';
  static const settings = '/settings';
  static const profile = '/profile';
  static const accounts = '/accounts';
  static const categories = '/categories';
  static const recurring = '/recurring';
  static const festivalNew = '/festival/new';
  static const reports = '/reports';
  static const remit = '/remit';
  static const plans = '/plans';
  static const dhar = '/dhar';
  static const families = '/families';
  static const notifications = '/notifications';
  static const sync = '/sync';
  static const bazaar = '/bazaar';
  static const deleteAccount = '/delete-account';
  static const simple = '/simple';

  /// Temporary: the old screens, kept reachable until their own tasks land.
  static const transactions = '/transactions';
}

/// `Meta('welcome_done')` is set. `main.dart` overrides this with the stored value.
final welcomeDoneProvider = StateProvider<bool>((ref) => false);

/// The invite token waiting for the person to sign in (`Meta('pending_invite')`).
final pendingInviteProvider = StateProvider<String?>((ref) => null);

/// `Meta('tutorial_done')` is set. Defaults to true so nothing forces the tutorial by accident.
final tutorialDoneProvider = StateProvider<bool>((ref) => true);

/// `Meta` key holding the privacy policy version the user accepted (FR-AUTH-10).
const consentVersionKey = 'consent_version';

/// The stored consent matches the current policy version. `bootstrap` sets it from
/// `Meta('consent_version')` and `checkConsent` compares it with `GET /v1/policy`. Defaults to
/// true so nothing forces the consent screen by accident (tests, signed-out screens).
final consentCurrentProvider = StateProvider<bool>((ref) => true);

const _signedOutPages = {Routes.welcome, Routes.login, Routes.loginCode};

/// `amarporibar://join/abc` becomes `/join/abc`.
String? _fromCustomScheme(Uri uri) {
  if (uri.scheme != 'amarporibar') return null;
  final path = '/${uri.host}${uri.path}';
  return uri.hasQuery ? '$path?${uri.query}' : path;
}

/// A `from` value is only followed when it is an in-app path that is not a sign-in page.
String? _safeFrom(String? from) {
  if (from == null || !from.startsWith('/') || from.startsWith('//')) {
    return null;
  }
  final path = Uri.parse(from).path;
  if (_signedOutPages.contains(path) || path == Routes.sessionExpired) {
    return null;
  }
  return from;
}

/// The single navigation guard (FR-NAV-01).
String? redirect(Ref ref, GoRouterState state) {
  final uri = state.uri;
  final link = _fromCustomScheme(uri);
  if (link != null) return link;

  final path = uri.path;
  if (path.startsWith('/join/')) return null; // invite links are always allowed

  final auth = ref.read(authProvider);
  if (!auth.loaded) return null;

  if (auth.expired) {
    if (_signedOutPages.contains(path) || path == Routes.sessionExpired) {
      return null;
    }
    return '${Routes.sessionExpired}?from=${Uri.encodeQueryComponent(uri.toString())}';
  }

  if (!auth.signedIn) {
    if (_signedOutPages.contains(path)) return null;
    if (ref.read(welcomeDoneProvider)) {
      final back = path == Routes.sessionExpired || path == Routes.home
          ? ''
          : '?from=${Uri.encodeQueryComponent(uri.toString())}';
      return '${Routes.login}$back';
    }
    return Routes.welcome;
  }

  final onConsent = path == Routes.consent || path == Routes.consentPolicy;
  if (auth.families.isEmpty || !ref.read(consentCurrentProvider)) {
    if (auth.families.isEmpty) {
      // A person with an invite joins instead of creating a family (T-MOB-18).
      final from = _safeFrom(uri.queryParameters['from']);
      if (from != null && from.startsWith('/join/')) return from;
      final pending = ref.read(pendingInviteProvider);
      if (pending != null && pending.isNotEmpty) return '/join/$pending';
    }
    return onConsent ? null : Routes.consent;
  }

  final onEntryPage = _signedOutPages.contains(path) ||
      path == Routes.sessionExpired ||
      path == Routes.consent;
  if (onEntryPage) {
    if (!ref.read(tutorialDoneProvider)) return Routes.tutorial;
    return _safeFrom(uri.queryParameters['from']) ?? Routes.home;
  }

  // A Viewer cannot write to the ledger (FR-FAM-03); the screen checks again when the role loads.
  if (path == Routes.add) {
    final role = ref.read(currentRoleFutureProvider).valueOrNull;
    if (role != null && !role.canWriteLedger) return Routes.home;
  }
  return null;
}
