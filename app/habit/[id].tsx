import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { format, subDays, parseISO } from 'date-fns';
import { useHabitStore } from '../../store/habitStore';
import { HabitCompletion } from '../../types';
import { isCompletedOnDate } from '../../lib/streakUtils';

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { habits, completions, fetchCompletions, archiveHabit } = useHabitStore();

  const habit = habits.find((h) => h.id === id);
  const [habitCompletions, setHabitCompletions] = useState<HabitCompletion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (habit) navigation.setOptions({ title: habit.name });
  }, [habit?.name]);

  useEffect(() => {
    if (!id) return;
    fetchCompletions(id).then((data) => {
      setHabitCompletions(data);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    setHabitCompletions(completions[id] ?? []);
  }, [completions, id]);

  const handleArchive = () => {
    Alert.alert('Archive Habit', `Archive "${habit?.name}"? It won't appear in your daily list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          await archiveHabit(id);
          router.back();
        },
      },
    ]);
  };

  if (!habit) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Habit not found.</Text>
      </View>
    );
  }

  // Build a 35-day grid
  const calendarDays = Array.from({ length: 35 }, (_, i) => subDays(new Date(), 34 - i));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.heroCard, { backgroundColor: habit.color }]}>
        <Text style={styles.heroIcon}>{habit.icon}</Text>
        <Text style={styles.heroName}>{habit.name}</Text>
        {habit.description && <Text style={styles.heroDesc}>{habit.description}</Text>}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>🔥 {habit.current_streak}</Text>
          <Text style={styles.statLabel}>Current Streak</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>🏆 {habit.longest_streak}</Text>
          <Text style={styles.statLabel}>Longest Streak</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Last 35 Days</Text>
      {loading ? (
        <ActivityIndicator color="#4F46E5" />
      ) : (
        <View style={styles.calendar}>
          {calendarDays.map((day, i) => {
            const completed = isCompletedOnDate(habitCompletions, day);
            const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            return (
              <View
                key={i}
                style={[
                  styles.calDay,
                  completed && { backgroundColor: habit.color },
                  isToday && styles.calDayToday,
                ]}
              >
                {isToday && !completed && <View style={styles.todayDot} />}
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionTitle}>Details</Text>
      <View style={styles.detailCard}>
        <DetailRow label="Frequency" value={habit.frequency} />
        <DetailRow
          label="Days"
          value={
            habit.frequency === 'daily'
              ? 'Every day'
              : habit.frequency_days.map((d) => ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join(', ')
          }
        />
        <DetailRow label="Created" value={format(parseISO(habit.created_at), 'MMM d, yyyy')} />
        {habit.last_completed_at && (
          <DetailRow
            label="Last done"
            value={format(parseISO(habit.last_completed_at), 'MMM d, yyyy')}
          />
        )}
      </View>

      <TouchableOpacity style={styles.archiveBtn} onPress={handleArchive}>
        <Text style={styles.archiveBtnText}>Archive Habit</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: '#64748B' },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  heroIcon: { fontSize: 48 },
  heroName: { fontSize: 22, fontWeight: '700', color: '#fff' },
  heroDesc: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statValue: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  statLabel: { fontSize: 12, color: '#64748B', marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#64748B', marginTop: 4 },
  calendar: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  calDay: {
    width: '12%',
    aspectRatio: 1,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calDayToday: { borderWidth: 2, borderColor: '#4F46E5' },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4F46E5' },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: { fontSize: 14, color: '#64748B' },
  detailValue: { fontSize: 14, fontWeight: '500', color: '#0F172A' },
  archiveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    marginTop: 8,
  },
  archiveBtnText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },
});
