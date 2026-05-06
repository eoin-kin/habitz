import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useHabitStore } from '../../store/habitStore';
import { ColorPicker } from '../../components/ColorPicker';
import { ValidationErrors } from '../../api/sanitize';

const ICONS = ['✅', '💪', '📚', '🏃', '💧', '🧘', '🎯', '✍️', '🌿', '🎵', '🍎', '💤'];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function NewHabitScreen() {
  const router = useRouter();
  const { createHabit } = useHabitStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#4F46E5');
  const [icon, setIcon] = useState('✅');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [selectedDays, setSelectedDays] = useState([1, 2, 3, 4, 5, 6, 7]);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleCreate = async () => {
    setLoading(true);
    setFieldErrors({});
    const { error, validationErrors } = await createHabit({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      icon,
      frequency,
      frequency_days: frequency === 'daily' ? [1, 2, 3, 4, 5, 6, 7] : selectedDays,
      target_count: 1,
    });
    setLoading(false);
    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
    } else if (error) {
      Alert.alert('Error', error);
    } else {
      router.back();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Habit Name</Text>
      <TextInput
        style={[styles.input, fieldErrors.name ? styles.inputError : null]}
        placeholder="e.g. Morning run"
        placeholderTextColor="#94A3B8"
        value={name}
        onChangeText={(v) => { setName(v); setFieldErrors((e) => ({ ...e, name: '' })); }}
        maxLength={60}
      />
      {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="What's this habit about?"
        placeholderTextColor="#94A3B8"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        maxLength={200}
      />

      <Text style={styles.label}>Icon</Text>
      <View style={styles.iconGrid}>
        {ICONS.map((i) => (
          <TouchableOpacity
            key={i}
            style={[styles.iconBtn, icon === i && styles.iconBtnActive]}
            onPress={() => setIcon(i)}
          >
            <Text style={styles.iconText}>{i}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Color</Text>
      <ColorPicker selected={color} onSelect={setColor} />

      <Text style={styles.label}>Frequency</Text>
      <View style={styles.freqRow}>
        {(['daily', 'weekly', 'custom'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.freqBtn, frequency === f && styles.freqBtnActive]}
            onPress={() => setFrequency(f)}
          >
            <Text style={[styles.freqText, frequency === f && styles.freqTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {(frequency === 'weekly' || frequency === 'custom') && (
        <>
          <Text style={styles.label}>Days</Text>
          <View style={styles.daysRow}>
            {DAYS.map((d, i) => {
              const day = i + 1;
              const active = selectedDays.includes(day);
              return (
                <TouchableOpacity
                  key={`${d}-${i}`}
                  style={[styles.dayBtn, active && styles.dayBtnActive]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[styles.dayText, active && styles.dayTextActive]}>{d}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <TouchableOpacity
        style={[styles.createBtn, loading && styles.createBtnDisabled]}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.createBtnText}>Create Habit</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 8, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  inputError: { borderColor: '#EF4444' },
  fieldError: { fontSize: 12, color: '#EF4444', marginTop: 2 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  iconText: { fontSize: 20 },
  freqRow: { flexDirection: 'row', gap: 8 },
  freqBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  freqBtnActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  freqText: { fontSize: 13, fontWeight: '500', color: '#64748B' },
  freqTextActive: { color: '#fff' },
  daysRow: { flexDirection: 'row', gap: 6 },
  dayBtn: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  dayText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  dayTextActive: { color: '#fff' },
  createBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  createBtnDisabled: { opacity: 0.6 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
