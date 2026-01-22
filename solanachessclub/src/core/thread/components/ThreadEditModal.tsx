// FILE: src/components/thread/ThreadEditModal.tsx

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleProp,
  TextStyle,
  ViewStyle,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  FlatList,
} from 'react-native';
import { ThreadPost, ThreadUser } from './thread.types';
import { useAppDispatch } from '@/shared/hooks/useReduxHooks';
import { updatePostAsync } from '@/shared/state/thread/reducer';
import { createThreadStyles } from './thread.styles';
import editModalStyles from './ThreadEditModal.style';

/**
 * Props for the ThreadEditModal
 */
interface ThreadEditModalProps {
  /** The post to edit */
  post: ThreadPost;
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when the user closes the modal */
  onClose: () => void;
  /** The current user. We use it if needed for permissions. */
  currentUser: ThreadUser;
  /** Optional theming overrides */
  themeOverrides?: Partial<Record<string, any>>;
  /** Optional style overrides */
  styleOverrides?: { [key: string]: object };
}

/**
 * A modal that lets the user edit *only the text sections* of a post.
 */
export default function ThreadEditModal({
  post,
  visible,
  onClose,
  currentUser,
  themeOverrides,
  styleOverrides,
}: ThreadEditModalProps) {
  const dispatch = useAppDispatch();
  const baseStyles = createThreadStyles(styleOverrides);

  // We'll collect new text for every text-only section
  const initialTextStates = post.sections.map(s => s.type === 'TEXT_ONLY' ? s.text ?? '' : '');
  const [textValues, setTextValues] = useState<string[]>(initialTextStates);

  const handleSave = async () => {
    // Build updated sections:
    const newSections = [...post.sections].map((section, idx) => {
      if (section.type === 'TEXT_ONLY') {
        // Replace with new text
        return {
          ...section,
          text: textValues[idx],
        };
      }
      return section;
    });

    try {
      await dispatch(updatePostAsync({
        postId: post.id,
        sections: newSections,
      })).unwrap();
    } catch (err: any) {
      console.warn('[ThreadEditModal] update failed:', err);
    } finally {
      onClose();
    }
  };

  const renderSectionEditor = ({ item, index }: { item: string; index: number }) => {
    return (
      <View style={editModalStyles.inputContainer}>
        <Text style={editModalStyles.label}>Text Section #{index + 1}:</Text>
        <TextInput
          style={editModalStyles.textInput}
          multiline
          value={textValues[index]}
          onChangeText={(txt) => {
            const updated = [...textValues];
            updated[index] = txt;
            setTextValues(updated);
          }}
        />
      </View>
    );
  };

  // Identify how many text-only sections exist:
  const textSectionCount = post.sections.filter(s => s.type === 'TEXT_ONLY').length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={editModalStyles.overlay}
      >
        <View style={editModalStyles.container}>
          <Text style={editModalStyles.title}>
            Edit Post
          </Text>

          {textSectionCount === 0 ? (
            <Text style={editModalStyles.noEditsText}>
              No text sections to edit.
            </Text>
          ) : (
            <FlatList
              data={textValues}
              keyExtractor={(item, idx) => `edit-section-${idx}`}
              renderItem={renderSectionEditor}
              style={{ width: '100%', marginBottom: 8 }}
            />
          )}

          <View style={editModalStyles.buttonRow}>
            <TouchableOpacity
              style={[editModalStyles.button, { backgroundColor: '#aaa' }]}
              onPress={onClose}
            >
              <Text style={editModalStyles.buttonText}>Cancel</Text>
            </TouchableOpacity>

            {textSectionCount > 0 && (
              <TouchableOpacity
                style={[editModalStyles.button, { backgroundColor: '#1d9bf0' }]}
                onPress={handleSave}
              >
                <Text style={editModalStyles.buttonText}>Save</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
