# Amar Poribar

A private, offline-first family finance app built with Flutter.

## Stack

- Flutter + Riverpod (state management)
- Drift / SQLite with CRDT-based sync
- Peer-to-peer sync via Nearby Connections
- SMS parsing for bank messages

## Getting started

```sh
flutter pub get
dart run build_runner build --delete-conflicting-outputs
flutter test
flutter run
```

Generated files (`*.g.dart`, `*.freezed.dart`) are not committed; run `build_runner` after cloning.

## Structure

```
lib/
  core/          SMS parser
  data/          Drift database, sync engine, P2P adapter
  domain/        Models and enums
  presentation/  Providers, navigation, screens, widgets
test/
```
