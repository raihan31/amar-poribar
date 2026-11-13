import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/redirects.dart';
import '../../core/l10n/l10n_x.dart';
import '../../core/money/money.dart';
import '../../core/money/money_format.dart';
import '../../features/family/state/family_providers.dart';
import '../providers/providers.dart';
import '../widgets/glassmorphism_card.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final appState = ref.watch(appStateProvider);
    final recentTransactions = ref.watch(recentTransactionsProvider);
    final name = ref.watch(meProvider).valueOrNull?.user.name ?? '';

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        title: Text(
          context.l10n.common_appName,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => context.push(Routes.settings),
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
                      Text(
                        context.l10n.home_welcome(name),
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(color: Colors.grey),
                      ),
                      const SizedBox(height: 20),

                      // Hero Budget Card
                      _buildHeroBudgetCard(context, appState),

                      const SizedBox(height: 30),
                      Text(
                        context.l10n.home_dashboard_analytics,
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 10),

                      // Charts Segment
                      _buildAnalyticsChart(context),

                      const SizedBox(height: 30),
                      Text(
                        context.l10n.home_dashboard_recent,
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      Text(
                        context.l10n.txn_dashboard_count(
                          recentTransactions.length,
                        ),
                        style: const TextStyle(color: Colors.grey),
                      ),
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
                        color: Theme.of(context)
                            .colorScheme
                            .surface
                            .withValues(alpha: 0.5),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: isExpense
                                ? Colors.red.withValues(alpha: 0.1)
                                : Colors.green.withValues(alpha: 0.1),
                            child: Icon(
                              isExpense
                                  ? Icons.arrow_outward
                                  : Icons.arrow_downward,
                              color: isExpense ? Colors.red : Colors.green,
                            ),
                          ),
                          title: Text(
                            item['category'] as String,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          subtitle: Text(item['date'] as String),
                          trailing: Text(
                            '${isExpense ? '−' : '+'}${formatMoney(item['amount'] as Money, style: NumeralStyle.bangla)}',
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
                const SliverToBoxAdapter(
                  child: SizedBox(height: 100),
                ), // Space for FAB
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(Routes.transactions),
        label: Text(context.l10n.txn_dashboard_add),
        icon: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildHeroBudgetCard(BuildContext context, AppState state) {
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
                  Text(
                    context.l10n.home_dashboard_totalBalance,
                    style: const TextStyle(color: Colors.grey, fontSize: 14),
                  ),
                  Text(
                    formatMoney(
                      state.totalIncome - state.totalExpense,
                      style: NumeralStyle.bangla,
                    ),
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                context.l10n.home_dashboard_spent(
                  formatMoney(state.totalExpense, style: NumeralStyle.bangla),
                ),
                style: const TextStyle(fontSize: 12),
              ),
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
            gridData: const FlGridData(show: false),
            titlesData: const FlTitlesData(show: false),
            borderData: FlBorderData(show: false),
            minX: 0,
            maxX: 6,
            minY: 0,
            maxY: 6,
            lineBarsData: [
              LineChartBarData(
                spots: const [
                  FlSpot(0, 3),
                  FlSpot(1, 1),
                  FlSpot(2, 4),
                  FlSpot(3, 2),
                  FlSpot(4, 5),
                  FlSpot(5, 1),
                  FlSpot(6, 4),
                ],
                isCurved: true,
                color: Theme.of(context).colorScheme.primary,
                barWidth: 3,
                isStrokeCapRound: true,
                dotData: const FlDotData(show: false),
                belowBarData: BarAreaData(
                  show: true,
                  color: Theme.of(context)
                      .colorScheme
                      .primary
                      .withValues(alpha: 0.2),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
