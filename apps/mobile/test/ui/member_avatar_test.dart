import 'package:amar_poribar/domain/models/member.dart';
import 'package:amar_poribar/ui/member_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _app(Widget c) => MaterialApp(home: Scaffold(body: Center(child: c)));
const _m = Member(id: '1', name: 'রহিম', avatarIndex: 1);

void main() {
  testWidgets('online shows word অনলাইন', (t) async {
    await t.pumpWidget(
      _app(const MemberAvatar(m: _m, online: true, showLabel: true)),
    );
    expect(find.text('অনলাইন'), findsOneWidget);
  });

  testWidgets('offline shows অফলাইন', (t) async {
    await t.pumpWidget(
      _app(const MemberAvatar(m: _m, online: false, showLabel: true)),
    );
    expect(find.text('অফলাইন'), findsOneWidget);
  });

  testWidgets('no presence when online is null', (t) async {
    await t.pumpWidget(_app(const MemberAvatar(m: _m)));
    expect(find.text('অনলাইন'), findsNothing);
    expect(find.text('র'), findsOneWidget);
  });
}
