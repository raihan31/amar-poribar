import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../core/l10n/l10n_x.dart';
import '../../../data/database/local_store.dart';
import '../../../ui/permission_explainer.dart';

const pushAskedKey = 'push_permission_asked';

/// Asks for `POST_NOTIFICATIONS` (Android 13+) once, the first time after login, behind the
/// explainer sheet (T-MOB-72 board). Returns true when the permission is granted.
/// [request] is injectable for tests.
Future<bool> askPushPermissionOnce(
  BuildContext context,
  LocalStore store, {
  Future<bool> Function()? request,
}) async {
  if (await store.getMeta(pushAskedKey) != null) return false;
  if (!context.mounted) return false;
  final l10n = context.l10n;
  var allowed = false;
  await PermissionExplainer.show<void>(
    context,
    PermissionExplainer(
      icon: Icons.notifications_active,
      title: l10n.push_permission_title,
      body: l10n.push_permission_body,
      allowLabel: l10n.push_permission_allow,
      onAllow: () {
        allowed = true;
        Navigator.of(context).pop();
      },
      onLater: () => Navigator.of(context).pop(),
    ),
  );
  await store.setMeta(pushAskedKey, '1');
  if (!allowed) return false;
  return (request ?? _systemRequest)();
}

Future<bool> _systemRequest() async =>
    (await Permission.notification.request()).isGranted;
