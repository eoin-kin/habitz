import { View, TouchableOpacity, StyleSheet } from 'react-native';

const COLORS = [
  '#4F46E5', // indigo
  '#7C3AED', // violet
  '#DB2777', // pink
  '#E11D48', // rose
  '#EA580C', // orange
  '#D97706', // amber
  '#059669', // emerald
  '#0284C7', // sky
  '#0D9488', // teal
  '#64748B', // slate
];

type Props = {
  selected: string;
  onSelect: (color: string) => void;
};

export function ColorPicker({ selected, onSelect }: Props) {
  return (
    <View style={styles.row}>
      {COLORS.map((c) => (
        <TouchableOpacity
          key={c}
          style={[styles.swatch, { backgroundColor: c }, selected === c && styles.swatchActive]}
          onPress={() => onSelect(c)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  swatchActive: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
