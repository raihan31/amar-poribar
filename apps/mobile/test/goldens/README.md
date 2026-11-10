# Golden tests (T-MOB-52, NFR-24)

Screens must look like the design boards in `docs/design/screens/` within 2% of pixels.

## Add a golden

```dart
import 'golden_config.dart';

void main() {
  goldenScreen('A1_login', const LoginScreen(), overrides: [/* fakes */]);
  goldenScreen('A1_login', const LoginScreen(), dark: true); // A1_login_dark.png
}
```

- Size is `kGoldenSize` (390 x 844), Bangla locale, bundled Hind Siliguri.
- File names are `<code>_<name>.png` and `<code>_<name>_dark.png`, stored in `goldens/ci/`.
- The comparison is `ToleranceComparator(0.02)`: it fails only when more than 2% of pixels differ.

## Update goldens

```
flutter test --update-goldens test/goldens/<file>_test.dart
```

Commit only images produced inside the pinned CI image so fonts and rasterisation are identical:

```
tool/update_goldens.sh test/goldens/<file>_test.dart
```

The Flutter version is pinned in `.fvmrc` and used by `.github/workflows/ci.yml`. When a CI golden
fails, download the `golden-failures` artifact (`test/goldens/failures/**`) to see the diff images.
