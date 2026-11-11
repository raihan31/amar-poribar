import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../presentation/providers/auth_provider.dart';

/// Route paths. Opaque ids are path parameters (T-MOB-08 contract).
class Routes {
  Routes._();

  static const welcome = '/welcome';
  static const login = '/login';
  static const loginCode = '/login/code';
  static const consent = '/consent';
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
  static const pendingSms = '/pending-sms';
}

/// `Meta('welcome_done')` is set. `main.dart` overrides this with the stored value.
final welcomeDoneProvider = StateProvider<bool>((ref) => false);

/// `Meta('tutorial_done')` is set. Defaults to true so nothing forces the tutorial by accident.
final tutorialDoneProvider = StateProvider<bool>((ref) => true);

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

  if (auth.families.isEmpty) {
    return path == Routes.consent ? null : Routes.consent;
  }

  final onEntryPage = _signedOutPages.contains(path) ||
      path == Routes.sessionExpired ||
      path == Routes.consent;
  if (onEntryPage) {
    if (!ref.read(tutorialDoneProvider)) return Routes.tutorial;
    return _safeFrom(uri.queryParameters['from']) ?? Routes.home;
  }
  return null;
}
