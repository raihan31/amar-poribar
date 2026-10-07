import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';

import '../providers/providers.dart';
import '../widgets/glassmorphism_card.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appState = ref.watch(appStateProvider);
    final recentTransactions = ref.watch(recentTransactionsProvider);
    
    // Derived state for the UI
    final budgetUsedPercent = appState.totalExpense / appState.monthlyBudget;
    
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: const Text('Amar Poribar', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.pushNamed(context, '/settings'),
          ),
        ],
      ),
      body: Container(
        decoration: BoxDecoration(
          // Soft gradient background for premium look
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Theme.of(context).colorScheme.primaryContainer,
              Theme.of(context).colorScheme.surface,
            ],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 10),
                      Text('Welcome back, ${appState.activeRole.name.toUpperCase()}', 
                           style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.grey),),
                      const SizedBox(height: 20),
                      
                      // Hero Budget Card
                      _buildHeroBudgetCard(context, appState, budgetUsedPercent),
                      
                      const SizedBox(height: 30),
                      Text('Monthly Analytics', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 10),
                      
                      // Charts Segment
                      _buildAnalyticsChart(context),
                      
                      const SizedBox(height: 30),
                      Text('Recent Transactions', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 10),
                    ],
                  ),
                ),
                
                // Transactions List
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final item = recentTransactions[index];
                      final isExpense = item['type'] == 'expense';
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8.0),
                        elevation: 0,
                        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.5),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: isExpense ? Colors.red.withValues(alpha: 0.1) : Colors.green.withValues(alpha: 0.1),
                            child: Icon(
                              isExpense ? Icons.arrow_outward : Icons.arrow_downward,
                              color: isExpense ? Colors.red : Colors.green,
                            ),
                          ),
                          title: Text(item['category'] as String, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text(item['date'] as String),
                          trailing: Text(
                            "${isExpense ? '-' : '+'} ৳${item['amount']}",
                            style: TextStyle(
                              color: isExpense ? Colors.red : Colors.green,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                        ),
                      );
                    },
                    childCount: recentTransactions.length,
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 100)), // Space for FAB
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.pushNamed(context, '/transactions'),
        label: const Text('Add Txn'),
        icon: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildHeroBudgetCard(BuildContext context, AppState state, double percentUsed) {
    return GlassmorphismCard(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Total Balance', style: TextStyle(color: Colors.grey, fontSize: 14)),
                  Text('৳${(state.totalIncome - state.totalExpense).toStringAsFixed(2)}', 
                       style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: percentUsed > 0.85 ? Colors.red.withValues(alpha: 0.2) : Colors.green.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${(percentUsed * 100).toStringAsFixed(0)}% Used',
                  style: TextStyle(
                    color: percentUsed > 0.85 ? Colors.red : Colors.green,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          LinearProgressIndicator(
            value: percentUsed,
            backgroundColor: Colors.grey.withValues(alpha: 0.2),
            color: percentUsed > 0.85 ? Colors.red : Theme.of(context).colorScheme.primary,
            minHeight: 8,
            borderRadius: BorderRadius.circular(4),
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Spent: ৳${state.totalExpense.toStringAsFixed(0)}', style: const TextStyle(fontSize: 12)),
              Text('Budget: ৳${state.monthlyBudget.toStringAsFixed(0)}', style: const TextStyle(fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAnalyticsChart(BuildContext context) {
    return SizedBox(
      height: 200,
      child: GlassmorphismCard(
        child: LineChart(
          LineChartData(
            gridData: FlGridData(show: false),
            titlesData: FlTitlesData(show: false),
            borderData: FlBorderData(show: false),
            minX: 0,
            maxX: 6,
            minY: 0,
            maxY: 6,
            lineBarsData: [
              LineChartBarData(
                spots: const [
                  FlSpot(0, 3), FlSpot(1, 1), FlSpot(2, 4), FlSpot(3, 2), FlSpot(4, 5), FlSpot(5, 1), FlSpot(6, 4),
                ],
                isCurved: true,
                color: Theme.of(context).colorScheme.primary,
                barWidth: 3,
                isStrokeCapRound: true,
                dotData: FlDotData(show: false),
                belowBarData: BarAreaData(
                  show: true,
                  color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
