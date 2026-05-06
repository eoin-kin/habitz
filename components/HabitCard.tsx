import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { HabitWithStats } from '../types';

type Props = {
  habit: HabitWithStats;
  onToggle: () => void;
  onPress: () => void;
};

export function HabitCard({ habit, onToggle, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.colorBar, { backgroundColor: habit.color }]} />

      <View style={styles.body}>
        <Text style={styles.icon}>{habit.icon}</Text>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{habit.name}</Text>
          {habit.current_streak > 0 && (
            <Text style={styles.streak}>🔥 {habit.current_streak} day streak</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.checkBtn, habit.completed_today && { backgroundColor: habit.color }]}
          onPress={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.checkMark, habit.completed_today && styles.checkMarkDone]}>
            {habit.completed_today ? '✓' : ''}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  colorBar: { width: 4 },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  icon: { fontSize: 24 },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  streak: { fontSize: 12, color: '#EA580C', marginTop: 2 },
  checkBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 16, color: 'transparent' },
  checkMarkDone: { color: '#fff', fontWeight: '700' },
});
