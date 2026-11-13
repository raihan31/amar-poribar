import 'package:amar_poribar/features/entry/data/entry_repository.dart';
import 'package:amar_poribar/features/entry/data/fake_entry_repository.dart';
import 'package:amar_poribar/features/entry/domain/quick_parser.dart';
import 'package:flutter_test/flutter_test.dart';

// 2026-11-09 10:00 in Dhaka.
final _now = DateTime.utc(2026, 11, 9, 4);

void main() {
  test('AC-08: amount, keyword, account and date from one sentence', () async {
    const text = 'আজ বাজারে আটশো পঞ্চাশ টাকা ক্যাশে';
    final r = quickParse(text, _now)!;
    expect(r.amountPaisa, 85000);
    expect(r.categoryKey, 'bazaar');
    expect(r.accountType, 'cash');
    expect(r.occurredAt, _now);
    expect(r.confidence, 0.8);

    final repo = FakeEntryRepository();
    final drafts = await repo.parse(text, source: EntrySource.voice);
    expect(drafts.single.amountPaisa, 85000);
    expect(drafts.single.source, 'voice');
    expect(
      repo.apiCalls,
      0,
      reason: 'the quick parser must not use the network',
    );
  });

  test('AC-09: amount without a keyword has no category', () async {
    final r = quickParse('পাঁচশো টাকা দিলাম', _now)!;
    expect(r.amountPaisa, 50000);
    expect(r.categoryKey, isNull);
    final repo = FakeEntryRepository();
    final drafts =
        await repo.parse('পাঁচশো টাকা দিলাম', source: EntrySource.voice);
    expect(drafts.single.categoryKey, isNull);
    expect(repo.apiCalls, 0);
  });

  test('half amounts: দেড় হাজার টাকা ওষুধ', () {
    final r = quickParse('দেড় হাজার টাকা ওষুধ', _now)!;
    expect(r.amountPaisa, 150000);
    expect(r.categoryKey, 'medical');
  });

  test('lakh and digits', () {
    expect(
      quickParse('এক লাখ পঁচিশ হাজার টাকা বাসা ভাড়া', _now)!.amountPaisa,
      12500000,
    );
    expect(quickParse('বাজার ৮৫০ টাকা', _now)!.amountPaisa, 85000);
    expect(quickParse('1,200 টাকা', _now)!.amountPaisa, 120000);
  });

  test('yesterday', () {
    final r = quickParse('গতকাল রিকশা ভাড়া একশো টাকা', _now)!;
    expect(r.occurredAt, _now.subtract(const Duration(days: 1)));
  });

  test('two amounts fall through to the AI', () async {
    const text = 'বাজারে পাঁচশো টাকা আর ওষুধে দুইশো টাকা';
    expect(quickParse(text, _now), isNull);
    final repo = FakeEntryRepository(
      remote: (t) async => [
        quickParse('বাজার পাঁচশো টাকা', _now)!.toDraft(source: 'voice'),
      ],
    );
    final drafts = await repo.parse(text, source: EntrySource.voice);
    expect(drafts, hasLength(1));
    expect(repo.apiCalls, 1);
  });

  test('no amount returns null', () {
    expect(quickParse('আজ বাজারে গেলাম', _now), isNull);
  });

  test('offline text is queued and quota is reported', () async {
    final offline = FakeEntryRepository(offline: true);
    await expectLater(
      offline.parse('দুই কেজি চাল আর মাছ', source: EntrySource.voice),
      throwsA(isA<QueuedOffline>()),
    );
    expect(offline.queued, ['দুই কেজি চাল আর মাছ']);
    final quota = FakeEntryRepository(quota: true);
    await expectLater(
      quota.parse('দুই কেজি চাল আর মাছ', source: EntrySource.voice),
      throwsA(isA<QuotaExceeded>()),
    );
  });
}
