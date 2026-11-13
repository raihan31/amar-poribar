import 'package:amar_poribar/core/l10n/l10n_x.dart';
import 'package:amar_poribar/core/theme/ui_scale.dart';
import 'package:amar_poribar/data/database/local_store.dart';
import 'package:amar_poribar/presentation/providers/providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'pump_app.dart';

class _Probe extends StatelessWidget {
  const _Probe();
  @override
  Widget build(BuildContext context) {
    final h = Theme.of(context)
        .elevatedButtonTheme
        .style!
        .minimumSize!
        .resolve({})!.height;
    final size = MediaQuery.of(context).size;
    return Column(
      children: [
        Text(context.l10n.common_appName),
        Text('h=$h'),
        Text('size=${size.width.toInt()}x${size.height.toInt()}'),
      ],
    );
  }
}

void main() {
  testWidgets('defaults: 390x844, Bangla, normal button height', (t) async {
    await pumpApp(t, const _Probe());
    expect(find.text('আমার পরিবার'), findsOneWidget);
    expect(find.text('size=390x844'), findsOneWidget);
    expect(find.text('h=56.0'), findsOneWidget);
  });

  testWidgets('simple scale, English and size are honoured', (t) async {
    await pumpApp(
      t,
      const _Probe(),
      scale: UiScale.simple,
      locale: const Locale('en'),
      size: const Size(360, 640),
    );
    expect(find.text('h=72.0'), findsOneWidget);
    expect(find.text('size=360x640'), findsOneWidget);
    expect(find.text('আমার পরিবার'), findsNothing);
  });

  testWidgets('default fakes are installed', (t) async {
    await pumpApp(t, const _Probe());
    final store = appContainer(t).read(localStoreProvider);
    expect(store, isA<LocalStore>());
    expect(await store.recent(), isEmpty);
  });
}
