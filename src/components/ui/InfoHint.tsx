import { useState } from 'react';
import { Text } from 'react-native';
import { Button, Dialog, IconButton, Portal } from 'react-native-paper';

import { glossaryTerm, type GlossaryTermKey } from '@/domain/glossary/terms';
import { useTheme } from '@/theme';

type InfoHintProps = {
  term: GlossaryTermKey;
};

/** Inline "what does this mean" affordance next to a jargon term or abbreviation. */
export function InfoHint({ term }: InfoHintProps) {
  const { colors, typography } = useTheme();
  const [visible, setVisible] = useState(false);
  const entry = glossaryTerm(term);

  return (
    <>
      <IconButton
        icon="information-outline"
        size={16}
        style={{ margin: 0, marginLeft: -4 }}
        onPress={() => setVisible(true)}
        accessibilityLabel={`What does ${entry.label} mean?`}
      />
      <Portal>
        <Dialog visible={visible} onDismiss={() => setVisible(false)}>
          <Dialog.Title>{entry.label}</Dialog.Title>
          <Dialog.Content>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {entry.definition}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setVisible(false)}>Got it</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
