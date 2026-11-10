// Copies the shared API vectors into test/contract/fixtures so the contract
// test has a local copy. Run from apps/mobile: `dart run tool/sync_fixtures.dart`.
// When `packages/shared/test-vectors/api` does not exist the committed copies stay as they are.
import 'dart:io';

void main() {
  final src = Directory('../../packages/shared/test-vectors/api');
  final dst = Directory('test/contract/fixtures');
  if (!src.existsSync()) {
    stdout.writeln('No shared vectors at ${src.path}; keeping ${dst.path}.');
    return;
  }
  dst.createSync(recursive: true);
  final keep = <String>{};
  var n = 0;
  for (final f in src.listSync().whereType<File>()) {
    final name = f.uri.pathSegments.last;
    if (!name.endsWith('.json')) continue;
    keep.add(name);
    f.copySync('${dst.path}/$name');
    n++;
  }
  for (final f in dst.listSync().whereType<File>()) {
    if (!keep.contains(f.uri.pathSegments.last)) f.deleteSync();
  }
  stdout.writeln('Copied $n fixtures to ${dst.path}.');
}
