import 'package:amar_poribar/features/budgets/data/budget_repository.dart';
import 'package:amar_poribar/features/budgets/state/spoken_alert_controller.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_voice_service.dart';

BudgetStatus _b(String? id, int limit, int spent, String level) =>
    BudgetStatus(id, id == null ? 'মোট' : 'বাজার', limit, spent, level);

void main() {
  late FakeBudgetRepository repo;
  late FakeVoiceService voice;
  late Map<String, String> meta;

  SpokenAlertController make() => SpokenAlertController(
        watch: repo.watch,
        voice: voice,
        getMeta: (k) async => meta[k],
        setMeta: (k, v) async => meta[k] = v,
        month: () => '2026-11',
      );

  setUp(() {
    repo = FakeBudgetRepository();
    voice = FakeVoiceService();
    meta = {};
  });

  test('speaks each level once and again only when worse', () async {
    final c = make()..start();
    addTearDown(c.stop);
    repo.emit([_b('c1', 100000, 85000, 'warning')]);
    await pumpEventQueue();
    expect(voice.spoken, hasLength(1));
    repo.emit([_b('c1', 100000, 86000, 'warning')]);
    await pumpEventQueue();
    expect(voice.spoken, hasLength(1));
    repo.emit([_b('c1', 100000, 105000, 'exceeded')]);
    await pumpEventQueue();
    expect(voice.spoken, hasLength(2));
    repo.emit([_b('c1', 100000, 106000, 'exceeded')]);
    await pumpEventQueue();
    expect(voice.spoken, hasLength(2));
  });

  test(
    'AC-05: crossing 80% then 100% triggers exactly two alerts',
    () async {
      final c = make()..start();
      addTearDown(c.stop);
      repo.emit([_b(null, 100000, 50000, 'ok')]);
      await pumpEventQueue();
      repo.emit([_b(null, 100000, 80000, 'warning')]);
      await pumpEventQueue();
      repo.emit([_b(null, 100000, 100000, 'exceeded')]);
      await pumpEventQueue();
      expect(voice.spoken, hasLength(2));
      expect(meta['alerts_spoken:2026-11'], contains('exceeded'));
    },
  );

  test('remembers what was spoken across restarts', () async {
    repo.emit([_b('c1', 100000, 90000, 'warning')]);
    final first = make()..start();
    await pumpEventQueue();
    first.stop();
    expect(voice.spoken, hasLength(1));
    final second = make()..start();
    addTearDown(second.stop);
    await pumpEventQueue();
    expect(voice.spoken, hasLength(1));
  });

  test('speakAll speaks every non-ok alert even when already spoken', () async {
    repo.emit([
      _b('c1', 100000, 90000, 'warning'),
      _b('c2', 100000, 10000, 'ok'),
      _b(null, 500000, 600000, 'exceeded'),
    ]);
    final c = make();
    expect(await c.speakAll(), 2);
    expect(await c.speakAll(), 2);
    expect(voice.spoken, hasLength(4));
  });
}
