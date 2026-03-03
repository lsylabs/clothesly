import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAddItem: () => void;
  onCreateCloset: () => void;
};

type ActionRowProps = {
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

function ActionRow({ iconName, label, onPress }: ActionRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.actionRow}>
      <Ionicons color="#0A0A0A" name={iconName} size={24} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

export default function AddActionSheet({ visible, onClose, onAddItem, onCreateCloset }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <View pointerEvents="box-none" style={[styles.sheetWrapper, { paddingBottom: Math.max(insets.bottom, 8) + 74 }]}>
          <View style={styles.sheet}>
            <Text style={styles.heading}>Quick Add</Text>
            <ActionRow iconName="shirt-outline" label="Add Item" onPress={onAddItem} />
            <ActionRow iconName="grid-outline" label="Create Closet" onPress={onCreateCloset} />
          </View>
          <View style={styles.pointer} />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.35)',
    justifyContent: 'flex-end'
  },
  sheetWrapper: {
    paddingHorizontal: 22,
    alignItems: 'center'
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 34,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 20,
    gap: 6,
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 12
  },
  pointer: {
    width: 22,
    height: 22,
    backgroundColor: '#FAFAFA',
    marginTop: -11,
    transform: [{ rotate: '45deg' }],
    borderBottomRightRadius: 5
  },
  heading: {
    color: '#8C8C95',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6
  },
  actionRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    paddingHorizontal: 8
  },
  actionText: {
    color: '#0A0A0A',
    fontSize: 19,
    fontWeight: '500'
  }
});
