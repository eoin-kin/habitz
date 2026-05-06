import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useHabitStore } from '../../store/habitStore';
import { HabitCard } from '../../components/HabitCard';
import { HabitWithStats } from '../../types';
import { colors } from '../../lib/theme';

export default function HabitsScreen() {
  const router = useRouter();
  const { habits, loading, fetchHabits, toggleCompletion } = useHabitStore();
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  useEffect(() => {
    fetchHabits();
  }, []);

  const displayed = filter === 'active' ? habits : habits;

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'active' && styles.filterBtnActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
      </View>

      {loading && !habits.length ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} size="large" />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={fetchHabits} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No habits yet</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/habit/new')}
              >
                <Text style={styles.emptyButtonText}>Add Your First Habit</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }: { item: HabitWithStats }) => (
            <HabitCard
              habit={item}
              onToggle={() => toggleCompletion(item.id)}
              onPress={() => router.push(`/habit/${item.id}`)}
            />
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/habit/new')}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dark.bg.primary },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: colors.dark.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.dark.border,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.dark.bg.tertiary,
  },
  filterBtnActive: { backgroundColor: colors.primary },
  filterText: { fontSize: 13, fontWeight: '500', color: colors.dark.text.secondary },
  filterTextActive: { color: '#fff' },
  loader: { marginTop: 60 },
  list: { padding: 16, gap: 10 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.dark.text.primary, marginBottom: 20 },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  emptyButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
});
