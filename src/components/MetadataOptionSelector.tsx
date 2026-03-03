import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import AppButton from './ui/AppButton';
import AppTextInput from './ui/AppTextInput';

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onAddCustomOption?: (value: string) => Promise<void>;
  allowCustomOption?: boolean;
  disabled?: boolean;
};

export default function MetadataOptionSelector({
  label,
  options,
  selected,
  onToggle,
  onAddCustomOption,
  allowCustomOption = true,
  disabled = false
}: Props) {
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customOptionText, setCustomOptionText] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);
  const canAddCustomOption = allowCustomOption && Boolean(onAddCustomOption);

  return (
    <View style={styles.group}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {canAddCustomOption ? (
          <AppButton
            disabled={disabled || savingCustom}
            label="+ Add"
            onPress={() => {
              setIsAddingCustom((current) => !current);
              setCustomOptionText('');
            }}
            style={styles.addButton}
            textStyle={styles.addButtonText}
            variant="ghost"
          />
        ) : null}
      </View>

      {canAddCustomOption && isAddingCustom ? (
        <View style={styles.addRow}>
          <AppTextInput
            editable={!disabled && !savingCustom}
            onChangeText={setCustomOptionText}
            placeholder={`Custom ${label.toLowerCase()}`}
            style={styles.addInput}
            value={customOptionText}
          />
          <AppButton
            disabled={disabled || savingCustom}
            label="Add"
            onPress={async () => {
              const trimmed = customOptionText.trim();
              if (!trimmed) return;
              if (!onAddCustomOption) return;
              setSavingCustom(true);
              try {
                await onAddCustomOption(trimmed);
                onToggle(trimmed);
                setCustomOptionText('');
                setIsAddingCustom(false);
              } catch (error) {
                Alert.alert('Could not add option', error instanceof Error ? error.message : 'Unknown error');
              } finally {
                setSavingCustom(false);
              }
            }}
            style={styles.addAction}
            variant="ghost"
          />
          <AppButton
            disabled={disabled || savingCustom}
            label="Cancel"
            onPress={() => {
              setCustomOptionText('');
              setIsAddingCustom(false);
            }}
            style={styles.addAction}
            variant="ghost"
          />
        </View>
      ) : null}

      <View style={styles.optionList}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          return (
            <Pressable
              key={`${label}:${option}`}
              disabled={disabled}
              onPress={() => onToggle(option)}
              style={[styles.chip, isSelected && styles.chipSelected, disabled && styles.disabled]}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A0A0A'
  },
  addButton: {
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10
  },
  addButtonText: {
    fontSize: 14
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  addInput: {
    flex: 1
  },
  addAction: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FAFAFA'
  },
  chipSelected: {
    backgroundColor: '#E0E0E0',
    borderColor: '#E0E0E0'
  },
  chipText: {
    color: '#0A0A0A',
    fontWeight: '500'
  },
  chipTextSelected: {
    color: '#0A0A0A'
  },
  disabled: {
    opacity: 0.65
  }
});
