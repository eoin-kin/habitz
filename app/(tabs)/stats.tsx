import { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useHabitStore } from '../../store/habitStore';
import { getCompletionRate } from '../../lib/streakUtils';
import { colors } from '../../lib/theme';

export default function StatsScreen() {
  const { habits, completions, loading, fetchHabits } = useHabitStore();

  useEffect(() => {
    fetchHabits();
  }, []);

  const totalHabits = habits.length;
  const completedToday = habits.filter((h) => h.completed_today).length;
  const bestStreak = Math.max(0, ...habits.map((h) => h.longest_streak));
  const avgCurrent = totalHabits
    ? Math.round(habits.reduce((sum, h) => sum + h.current_streak, 0) / totalHabits)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={fetchHabits} tintColor={colors.primary} />
      }
    >
      <View style={styles.grid}>
        <StatCard label="Today" value={`${completedToday}/${totalHabits}`} emoji="☀️" />
        <StatCard label="Best Streak" value={`${bestStreak}d`} emoji="🏆" />
        <StatCard label="Avg Streak" value={`${avgCurrent}d`} emoji="🔥" />
        <StatCard label="Habits" value={`${totalHabits}`} emoji="📋" />
      </View>

      <Text style={styles.sectionTitle}>Habit Performance</Text>

      {habits.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Add habits to see your stats here.</Text>
        </View>
      )}

      {habits.map((habit) => {
        const habitCompletions = completions[habit.id] ?? [];
        const rate7 = getCompletionRate(habitCompletions, 7);
        const rate30 = getCompletionRate(habitCompletions, 30);

        return (
          <View key={habit.id} style={styles.habitRow}>
            <View style={styles.habitHeader}>
              <View style={[styles.habitDot, { backgroundColor: habit.color }]} />
              <Text style={styles.habitIcon}>{habit.icon}</Text>
              <Text style={styles.habitName} numberOfLines={1}>{habit.name}</Text>
              <View style={styles.streakBadge}>
                <Text style={styles.streakText}>🔥 {habit.current_streak}</Text>
              </View>
            </View>
            <View style={styles.rateRow}>
              <RateBar label="7d" value={rate7} />
              <RateBar label="30d" value={rate30} />
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function StatCard({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RateBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.rateContainer}>
      <Text style={styles.rateLabel}>{label}</Text>
      <View style={styles.rateBarBg}>
        <View style={[styles.rateBarFill, { width: `${value}%` }]} />
      </View>
      <Text style={styles.rateValue}>{value}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark.bg.primary },
  content: { padding: 16, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.dark.bg.secondary,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  statEmoji: { fontSize: 24, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '700', color: colors.dark.text.primary },
  statLabel: { fontSize: 12, color: colors.dark.text.secondary, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: colors.dark.text.primary, marginTop: 8 },
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { color: colors.dark.text.tertiary, fontSize: 14 },
  habitRow: {
    backgroundColor: colors.dark.bg.secondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.dark.border,
    gap: 10,
  },
  habitHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  habitDot: { width: 10, height: 10, borderRadius: 5 },
  habitIcon: { fontSize: 16 },
  habitName: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.dark.text.primary },
  streakBadge: {
    backgroundColor: '#7C2D12',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  streakText: { fontSize: 12, color: '#FDBA74', fontWeight: '600' },
  rateRow: { gap: 6 },
  rateContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rateLabel: { width: 28, fontSize: 11, color: colors.dark.text.secondary, fontWeight: '500' },
  rateBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.dark.bg.tertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  rateBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  rateValue: { width: 36, fontSize: 11, color: colors.dark.text.secondary, textAlign: 'right' },
});
