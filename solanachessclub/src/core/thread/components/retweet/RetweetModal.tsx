// FILE: src/components/thread/retweet/RetweetModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { ThreadUser, ThreadSection } from '../thread.types';
import {
  createRetweetAsync,
  addRetweetLocally,
  updatePostAsync,
} from '@/shared/state/thread/reducer';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/useReduxHooks';
import { useAuth } from '@/modules/wallet-providers/hooks/useAuth';
import retweetModalStyles from './RetweetModal.styles';
import { nanoid } from '@reduxjs/toolkit';

/**
 * Props for the RetweetModal.
 */
interface RetweetModalProps {
  visible: boolean;
  onClose: () => void;
  retweetOf: string; // postId of the post we retweet
  currentUser: ThreadUser;
  // New customizable text props
  headerText?: string;
  placeholderText?: string;
  buttonText?: string;
  buttonTextWithContent?: string;
  styleOverrides?: {
    container?: StyleProp<ViewStyle>;
    input?: StyleProp<TextStyle>;
    button?: StyleProp<ViewStyle>;
    buttonText?: StyleProp<TextStyle>;
  };
}

/**
 * RetweetModal - allows user to optionally add text ("quote retweet").
 */
export default function RetweetModal({
  visible,
  onClose,
  retweetOf,
  currentUser,
  // Default values for the text props
  headerText = 'Retweet',
  placeholderText = 'Add a comment (optional)',
  buttonText = 'Retweet',
  buttonTextWithContent = 'Quote Retweet',
  styleOverrides,
}: RetweetModalProps) {
  const dispatch = useAppDispatch();
  const { solanaWallet } = useAuth();

  const [loading, setLoading] = useState(false);
  const [retweetText, setRetweetText] = useState('');

  // Get target post information
  const targetPost = useAppSelector(state =>
    state.thread.allPosts.find(p => p.id === retweetOf)
  );

  // Check if it's a retweet
  const isRetweet = targetPost?.retweetOf !== undefined;

  // If target is a retweet, use the original post ID
  const originalPostId = isRetweet
    ? targetPost?.retweetOf?.id
    : retweetOf;

  // Check if user already retweeted this post
  const existingRetweet = useAppSelector(state =>
    state.thread.allPosts.find(p =>
      p.retweetOf?.id === (originalPostId || retweetOf) &&
      p.user.id === currentUser.id
    )
  );

  // Set initial text if editing an existing quote retweet
  useEffect(() => {
    if (visible && existingRetweet && existingRetweet.sections && existingRetweet.sections.length > 0) {
      const quoteSection = existingRetweet.sections.find((s: ThreadSection) => s.type === 'TEXT_ONLY');
      if (quoteSection && quoteSection.text) {
        setRetweetText(quoteSection.text);
      } else {
        setRetweetText('');
      }
    } else if (visible) {
      setRetweetText('');
    }
  }, [visible, existingRetweet]);

  const handleRetweet = async () => {
    // Build optional sections if user has typed text
    let sections: ThreadSection[] = [];
    if (retweetText.trim()) {
      sections.push({
        id: `section-${nanoid()}`,
        type: 'TEXT_ONLY',
        text: retweetText.trim(),
      });
    }

    try {
      setLoading(true);

      // If user already retweeted this post, update the existing retweet
      if (existingRetweet) {
        await dispatch(updatePostAsync({
          postId: existingRetweet.id,
          sections,
        })).unwrap();
      } else {
        // If not, create a new retweet
        await dispatch(
          createRetweetAsync({
            retweetOf: originalPostId || retweetOf,
            userId: currentUser.id,
            sections,
          }),
        ).unwrap();
      }

      onClose();
      setRetweetText('');
    } catch (err: any) {
      // Fallback approach: add retweet locally with minimal user info
      console.warn(
        '[RetweetModal] Network error, adding retweet locally:',
        err.message,
      );
      const fallbackPost = {
        id: 'local-' + nanoid(),
        parentId: null,
        user: {
          id: currentUser.id,
          username: '', // details will be fetched from the users table
          handle: '',
          verified: false,
          avatar: {} as any,
        },
        sections,
        createdAt: new Date().toISOString(),
        replies: [],
        reactionCount: 0,
        retweetCount: 0,
        quoteCount: 0,
        reactions: {},
        retweetOf: {
          id: originalPostId || retweetOf,
          parentId: undefined,
          user: {
            id: 'unknown-user',
            username: '',
            handle: '',
            verified: false,
            avatar: {} as any,
          },
          sections: [],
          createdAt: new Date().toISOString(),
          replies: [],
          reactionCount: 0,
          retweetCount: 0,
          quoteCount: 0,
          reactions: {},
          retweetOf: null,
        },
      };

      dispatch(addRetweetLocally(fallbackPost));
      onClose();
      setRetweetText('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      {/* Background overlay that closes the modal on press */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={retweetModalStyles.overlay} />
      </TouchableWithoutFeedback>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={retweetModalStyles.centeredContainer}>
        {/* Tap inside won't close modal */}
        <TouchableWithoutFeedback onPress={() => { }}>
          <View
            style={[
              retweetModalStyles.modalContainer,
              styleOverrides?.container,
            ]}>
            <Text style={retweetModalStyles.modalTitle}>{headerText}</Text>
            <TextInput
              style={[retweetModalStyles.textInput, styleOverrides?.input]}
              placeholder={placeholderText}
              multiline
              value={retweetText}
              onChangeText={setRetweetText}
              keyboardAppearance="dark"
            />
            {loading ? (
              <ActivityIndicator style={{ marginTop: 10 }} />
            ) : (
              <TouchableOpacity
                style={[
                  retweetModalStyles.retweetButton,
                  styleOverrides?.button,
                ]}
                onPress={handleRetweet}>
                <Text
                  style={[
                    retweetModalStyles.retweetButtonText,
                    styleOverrides?.buttonText,
                  ]}>
                  {retweetText.trim() ? buttonTextWithContent : buttonText}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}
