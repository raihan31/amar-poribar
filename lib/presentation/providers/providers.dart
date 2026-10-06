import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/models/enums.dart';

// -----------------------------------------------------
// Basic Mock State Providers for UI Development Let's you
// build the UI independent of actual Drift database logic
// -----------------------------------------------------

class AppState {
  final Role activeRole;
  final double monthlyBudget;
  final double totalIncome;
  final double totalExpense;

  AppState({
    this.activeRole = Role.father, // Default admin view
    this.monthlyBudget = 100000.0,
    this.totalIncome = 120000.0,
    this.totalExpense = 45000.0,
  });

  AppState copyWith({
    Role? activeRole,
    double? monthlyBudget,
    double? totalIncome,
    double? totalExpense,
  }) {
    return AppState(
      activeRole: activeRole ?? this.activeRole,
      monthlyBudget: monthlyBudget ?? this.monthlyBudget,
      totalIncome: totalIncome ?? this.totalIncome,
      totalExpense: totalExpense ?? this.totalExpense,
    );
  }
}

class AppStateNotifier extends StateNotifier<AppState> {
  AppStateNotifier() : super(AppState());

  void setRole(Role role) {
    state = state.copyWith(activeRole: role);
  }

  void addExpense(double amount) {
    state = state.copyWith(totalExpense: state.totalExpense + amount);
  }

  void addIncome(double amount) {
    state = state.copyWith(totalIncome: state.totalIncome + amount);
  }
}

final appStateProvider = StateNotifierProvider<AppStateNotifier, AppState>((ref) {
  return AppStateNotifier();
});

// A provider mocking recent transactions for the dashboard
final recentTransactionsProvider = Provider((ref) {
  return [
    {'type': 'expense', 'category': 'Groceries', 'amount': 4500.0, 'date': '2 hours ago'},
    {'type': 'expense', 'category': 'Electricity', 'amount': 1200.0, 'date': 'Yesterday'},
    {'type': 'income', 'category': 'Salary', 'amount': 120000.0, 'date': '3 days ago'},
    {'type': 'expense', 'category': 'School Fee', 'amount': 8000.0, 'date': '1 week ago'},
  ];
});
