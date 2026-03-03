import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from './ui/AppButton';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAddItem: () => void;
  onCreateCloset: () => void;
};

export default function AddActionSheet({ visible, onClose, onAddItem, onCreateCloset }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 12, 34) }]}>
          <Text style={styles.heading}>Quick Add</Text>
          <AppButton label="Add Item" onPress={onAddItem} />
          <AppButton label="Create Closet" onPress={onCreateCloset} />
          <AppButton label="Cancel" onPress={onClose} style={styles.cancel} variant="secondary" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 10, 10, 0.3)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 18,
    paddingTop: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 10
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0A0A0A',
    marginBottom: 6
  },
  cancel: {
    marginTop: 4
  }
});
