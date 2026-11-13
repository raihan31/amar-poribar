import 'package:amar_poribar/app/push_wiring.dart';
import 'package:amar_poribar/core/push/push_service.dart';
import 'package:amar_poribar/domain/models/api/me.dart';
import 'package:amar_poribar/features/family/data/fake_family_repository.dart';
import 'package:amar_poribar/features/family/state/active_family.dart';
import 'package:amar_poribar/features/home/ui/home_screen.dart';
import 'package:amar_poribar/features/notifications/data/inbox_repository.dart';
import 'package:amar_poribar/features/notifications/state/inbox_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/pump_app.dart';

void main() {
  testWidgets('Home bell shows the unread count in Bangla digits', (t) async {
    final repo = FakeInboxRepository(
      items: [
        for (var n = 0; n < 3; n++)
          InboxItem(
            id: 'i$n',
            kind: 'budget',
            title: 't',
            body: 'b',
            createdAt: '2026-11-09T0$n:00:00Z',
          ),
      ],
    );
    await pumpApp(
      t,
      const HomeScreen(),
      overrides: [
        inboxRepositoryProvider.overrideWithValue(repo),
        activeFamilyProvider.overrideWithValue(
          const FamilyInfo(
            FakeFamilyRepository.familyId,
            'রহিম পরিবার',
            'owner',
          ),
        ),
      ],
    );
    await t.pump();
    await t.pump(const Duration(milliseconds: 50));
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('bell-count')),
        matching: find.text('৩'),
      ),
      findsOneWidget,
    );
  });

  test('a foreground push becomes an inbox item with the server id', () {
    final item = inboxItemFromPush(
      const PushMessage({
        'type': 'budget',
        'id': 'srv-1',
        'title': 'বাজেট',
        'body': 'শেষ',
        'speech': 'বাজেট শেষ',
        'familyId': 'f1',
      }),
      DateTime.utc(2026, 11, 9),
    );
    expect(item.id, 'srv-1');
    expect(item.kind, 'budget');
    expect(item.speechText, 'বাজেট শেষ');
    expect(item.data, {'familyId': 'f1', 'id': 'srv-1'});
  });
}
