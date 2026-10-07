import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'presentation/navigation/app_router.dart';

void main() {
  // Ensure Flutter engine is initialized before CRDT database or Nearby connections
  WidgetsFlutterBinding.ensureInitialized();
  
  // App entry point with Riverpod for DI
  runApp(
    const ProviderScope(
      child: AmarPoribarApp(),
    ),
  );
}

class AmarPoribarApp extends ConsumerWidget {
  const AmarPoribarApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'Amar Poribar',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1B5E20), // A stable green
          brightness: Brightness.light,
        ),
        // Glassmorphism components and modern UI settings would go here
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF4CAF50),
          brightness: Brightness.dark,
        ),
      ),
      themeMode: ThemeMode.system,
      initialRoute: AppRouter.onboardingRoute,
      onGenerateRoute: AppRouter.generateRoute,
      debugShowCheckedModeBanner: false,
    );
  }
}
