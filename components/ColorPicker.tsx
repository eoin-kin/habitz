import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../lib/theme';

const COLORS = [
  colors.primary,        // primary purple
  colors.primaryDark,    // darker purple
  colors.primaryLight,   // lighter purple
  colors.accent.green,   // green accent
  colors.accent.pink,    // pink accent
  '#EA580C',             // orange (keeping for variety)
  '#059669',             // emerald (keeping for variety)
  '#0284C7',             // sky blue (keeping for variety)
  '#0D9488',             // teal (keeping for variety)
  colors.dark.text.secondary, // neutral for subtle option
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
    borderColor: colors.dark.text.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
