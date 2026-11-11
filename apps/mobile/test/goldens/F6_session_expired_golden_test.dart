// ignore_for_file: file_names
import 'package:amar_poribar/features/auth/ui/invite_expired_card.dart';
import 'package:amar_poribar/features/auth/ui/session_expired_screen.dart';
import 'package:flutter/material.dart';

import 'golden_config.dart';

void main() {
  goldenScreen('F6_session_expired', const SessionExpiredScreen());
  goldenScreen(
    'F6_invite_expired',
    const Scaffold(
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(20, 48, 20, 0),
          child: InviteExpiredCard(inviterName: 'আব্বু'),
        ),
      ),
    ),
  );
}
