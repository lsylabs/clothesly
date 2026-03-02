import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
          <Pressable onPress={onAddItem} style={styles.action}>
            <Text style={styles.actionText}>Add Item</Text>
          </Pressable>
          <Pressable onPress={onCreateCloset} style={styles.action}>
            <Text style={styles.actionText}>Create Closet</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#fffdf7',
    paddingHorizontal: 18,
    paddingTop: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    gap: 10
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2a2a2a',
    marginBottom: 6
  },
  action: {
    backgroundColor: '#eff4f1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  actionText: {
    color: '#1f4d3d',
    fontWeight: '600'
  },
  cancel: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d7d2c8',
    marginTop: 4
  },
  cancelText: {
    color: '#333333',
    fontWeight: '600'
  }
});
