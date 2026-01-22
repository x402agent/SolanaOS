import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  Linking,
  TouchableOpacity,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FontAwesome5 } from '@expo/vector-icons';
import { styles } from './ActionDetailModal.style';
import COLORS from '../../../../assets/colors';


export interface ActionDetailModalProps {
  visible: boolean;
  action: any;
  onClose: () => void;
  walletAddress?: string;
}

/**
 * Returns an accent color based on the action label.
 */
function getActionColor(actionLabel: string): string {
  const label = actionLabel.toLowerCase();
  if (label.includes('transfer')) {
    return COLORS.brandBlue; // Blue for transfers
  } else if (label.includes('swap')) {
    return '#9c27b0'; // Purple for swaps
  } else if (label.includes('buy')) {
    return '#4caf50'; // Green for buys
  } else if (label.includes('sell')) {
    return COLORS.errorRed; // Red for sells
  } else if (label.includes('stake')) {
    return '#ff9800'; // Orange for staking
  } else if (label.includes('nft')) {
    return '#673ab7'; // Deep purple for NFTs
  }
  return COLORS.greyMid; // Default grey for unknown actions
}

/**
 * Format lamports as SOL with appropriate decimal places.
 */
function formatSolAmount(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4);
}

/**
 * Format date to a human-readable string.
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

/**
 * Truncate address for display
 */
function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return address.slice(0, 4) + '...' + address.slice(-4);
}

const ActionDetailModal: React.FC<ActionDetailModalProps> = ({
  visible,
  action,
  onClose,
  walletAddress,
}) => {
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFromTooltip, setShowFromTooltip] = useState(false);
  const [showToTooltip, setShowToTooltip] = useState(false);
  const tooltipAnimation = useRef(new Animated.Value(0)).current;

  // Hide tooltip animation function - defined before useEffect
  const hideTooltip = () => {
    Animated.timing(tooltipAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowFromTooltip(false);
      setShowToTooltip(false);
    });
  };

  // Add effect to dismiss tooltip when user taps outside
  useEffect(() => {
    // Hide tooltip when modal is closed
    if (!visible) {
      hideTooltip();
    }
  }, [visible]);

  if (!action) return null;

  // Determine the action label using enriched type if available
  let actionType =
    action.enrichedType ||
    action.transactionType ||
    action.type ||
    'Transaction';

  // Prettier action type name for display
  if (actionType === 'SWAP') actionType = 'Swap';
  if (actionType === 'TRANSFER') actionType = 'Transfer';
  if (actionType === 'TOKEN_TRANSFER') actionType = 'Token Transfer';

  const accentColor = getActionColor(actionType);
  const signature = action.signature || '';
  const truncatedSignature = truncateAddress(signature);
  const fee = action.fee !== undefined ? formatSolAmount(action.fee) : '—';
  const date = action.timestamp ? formatDate(action.timestamp) : '—';
  const solscanURL = `https://solscan.io/tx/${signature}`;

  // Get transaction details - prefer enriched data if available
  let fromAddress = '';
  let toAddress = '';
  let amount = '';
  let symbol = 'SOL';
  let direction = 'neutral';
  let swapDetails = null;

  // Get the original address before truncation
  let originalFromAddress = '';
  let originalToAddress = '';

  if (action.enrichedData) {
    // Get details from enriched data
    if (action.enrichedType === 'SWAP') {
      const {
        swapType,
        inputSymbol,
        outputSymbol,
        inputAmount,
        outputAmount,
        direction: enrichedDirection,
      } = action.enrichedData;

      swapDetails = {
        inputAmount: inputAmount?.toFixed(4) || '?',
        inputSymbol: inputSymbol || '?',
        outputAmount: outputAmount?.toFixed(4) || '?',
        outputSymbol: outputSymbol || '?',
        direction: enrichedDirection || 'neutral',
      };

      direction = enrichedDirection || 'neutral';
    } else if (
      action.enrichedType === 'TRANSFER' ||
      action.enrichedType === 'TOKEN_TRANSFER'
    ) {
      const {
        transferType,
        amount: txAmount,
        tokenSymbol,
        counterparty,
        direction: enrichedDirection,
      } = action.enrichedData;

      // For display in the transaction detail view
      amount = txAmount
        ? transferType === 'SOL'
          ? txAmount.toFixed(4)
          : txAmount.toString()
        : '?';
      symbol = transferType === 'SOL' ? 'SOL' : tokenSymbol || 'tokens';
      direction = enrichedDirection || 'neutral';

      // Set from/to based on direction
      if (enrichedDirection === 'OUT' && walletAddress) {
        fromAddress = truncateAddress(walletAddress);
        originalFromAddress = walletAddress;
        toAddress = counterparty || '?';
        originalToAddress = counterparty || '?';
      } else if (enrichedDirection === 'IN' && walletAddress) {
        toAddress = truncateAddress(walletAddress);
        originalToAddress = walletAddress;
        fromAddress = counterparty || '?';
        originalFromAddress = counterparty || '?';
      }
    }
  }
  // Fall back to original implementation for non-enriched data
  else {
    if (action.nativeTransfers && action.nativeTransfers.length > 0) {
      const transfer = action.nativeTransfers[0];
      fromAddress = truncateAddress(transfer.fromUserAccount);
      originalFromAddress = transfer.fromUserAccount;
      toAddress = truncateAddress(transfer.toUserAccount);
      originalToAddress = transfer.toUserAccount;
      amount = formatSolAmount(transfer.amount);
      symbol = 'SOL';

      if (walletAddress) {
        if (transfer.fromUserAccount === walletAddress) {
          direction = 'out';
        } else if (transfer.toUserAccount === walletAddress) {
          direction = 'in';
        }
      }
    } else if (action.tokenTransfers && action.tokenTransfers.length > 0) {
      const transfer = action.tokenTransfers[0];
      fromAddress = truncateAddress(transfer.fromUserAccount);
      originalFromAddress = transfer.fromUserAccount;
      toAddress = truncateAddress(transfer.toUserAccount);
      originalToAddress = transfer.toUserAccount;
      amount = transfer.tokenAmount.toString();
      symbol = transfer.symbol || truncateAddress(transfer.mint);

      if (walletAddress) {
        if (transfer.fromUserAccount === walletAddress) {
          direction = 'out';
        } else if (transfer.toUserAccount === walletAddress) {
          direction = 'in';
        }
      }
    }

    // For swaps, get input and output details
    if (action.events?.swap) {
      const swap = action.events.swap;
      let inputAmount = '';
      let inputSymbol = '';
      let outputAmount = '';
      let outputSymbol = '';

      if (swap.nativeInput) {
        inputAmount = formatSolAmount(
          parseInt(String(swap.nativeInput.amount), 10),
        );
        inputSymbol = 'SOL';
      } else if (swap.tokenInputs && swap.tokenInputs.length > 0) {
        const input = swap.tokenInputs[0];
        const decimals = parseInt(String(input.rawTokenAmount.decimals), 10);
        inputAmount = (
          parseFloat(input.rawTokenAmount.tokenAmount) / Math.pow(10, decimals)
        ).toFixed(4);
        inputSymbol = truncateAddress(input.mint);
      }

      if (swap.nativeOutput) {
        outputAmount = formatSolAmount(
          parseInt(String(swap.nativeOutput.amount), 10),
        );
        outputSymbol = 'SOL';
      } else if (swap.tokenOutputs && swap.tokenOutputs.length > 0) {
        const output = swap.tokenOutputs[0];
        const decimals = parseInt(String(output.rawTokenAmount.decimals), 10);
        outputAmount = (
          parseFloat(output.rawTokenAmount.tokenAmount) / Math.pow(10, decimals)
        ).toFixed(4);
        outputSymbol = truncateAddress(output.mint);
      }

      if (inputAmount && outputAmount) {
        swapDetails = {
          inputAmount,
          inputSymbol,
          outputAmount,
          outputSymbol,
          direction: 'neutral',
        };
      }
    }
  }

  const copySignature = async () => {
    if (signature) {
      await Clipboard.setStringAsync(signature);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openSolscan = () => {
    Linking.openURL(solscanURL).catch(err =>
      console.error('Failed to open Solscan:', err),
    );
  };

  // Format direction for display
  const directionDisplay =
    direction === 'IN' || direction === 'in'
      ? 'Received'
      : direction === 'OUT' || direction === 'out'
        ? 'Sent'
        : '';

  // Set color based on direction
  const amountColor =
    direction === 'IN' || direction === 'in'
      ? '#14F195'
      : direction === 'OUT' || direction === 'out'
        ? COLORS.errorRed
        : COLORS.white;

  // Show tooltip animation
  const showTooltip = (tooltipType: 'from' | 'to') => {
    if (tooltipType === 'from') {
      setShowFromTooltip(true);
      setShowToTooltip(false);
    } else {
      setShowFromTooltip(false);
      setShowToTooltip(true);
    }

    Animated.timing(tooltipAnimation, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableWithoutFeedback onPress={hideTooltip}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContainer}>
              {/* Draggable Handle */}
              <View style={styles.handleBar} />

              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  activeOpacity={0.7}>
                  <FontAwesome5 name="times" size={18} color={COLORS.greyMid} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Transaction Details</Text>
              </View>

              <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}>
                {/* Transaction Type Banner */}
                <View
                  style={[
                    styles.typeBanner,
                    { backgroundColor: `${accentColor}20` },
                  ]}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: `${accentColor}40` },
                    ]}>
                    <FontAwesome5
                      name={
                        actionType.toLowerCase().includes('transfer')
                          ? 'exchange-alt'
                          : actionType.toLowerCase().includes('swap')
                            ? 'sync-alt'
                            : 'receipt'
                      }
                      size={16}
                      color={accentColor}
                    />
                  </View>
                  <View style={styles.typeInfo}>
                    <Text style={[styles.typeTitle, { color: accentColor }]}>
                      {actionType}
                    </Text>
                    <Text style={styles.dateText}>{date}</Text>
                  </View>
                </View>

                {/* Transaction Amount for Transfers */}
                {direction !== 'neutral' && amount && (
                  <View style={styles.amountContainer}>
                    <Text
                      style={[styles.amountText, { color: amountColor }]}>
                      {direction === 'IN' || direction === 'in'
                        ? '+ '
                        : direction === 'OUT' || direction === 'out'
                          ? '- '
                          : ''}
                      {amount} {symbol}
                    </Text>
                    {directionDisplay && (
                      <Text style={styles.directionLabel}>
                        {directionDisplay}
                      </Text>
                    )}
                  </View>
                )}

                {/* Swap Details */}
                {swapDetails && (
                  <View style={styles.swapContainer}>
                    <View style={styles.swapRow}>
                      <View style={styles.swapAmount}>
                        <Text style={styles.swapValue}>
                          {swapDetails.inputAmount} {swapDetails.inputSymbol}
                        </Text>
                        <Text style={styles.swapLabel}>Paid</Text>
                      </View>
                      <View style={styles.swapArrow}>
                        <FontAwesome5
                          name="arrow-right"
                          size={14}
                          color={COLORS.accessoryDarkColor}
                        />
                      </View>
                      <View style={styles.swapAmount}>
                        <Text style={styles.swapValue}>
                          {swapDetails.outputAmount} {swapDetails.outputSymbol}
                        </Text>
                        <Text style={styles.swapLabel}>Received</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Transaction Details */}
                <View style={styles.detailsSection}>
                  <Text style={styles.sectionTitle}>Details</Text>

                  {/* Fee */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Fee</Text>
                    <Text style={styles.detailValue}>{fee} SOL</Text>
                  </View>

                  {/* From / To for transfers */}
                  {fromAddress && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>From</Text>
                      <TouchableOpacity
                        onPressIn={() => showTooltip('from')}
                        onPressOut={hideTooltip}
                        activeOpacity={0.7}>
                        <Text style={styles.detailValue}>
                          {fromAddress}
                        </Text>

                        {showFromTooltip && (
                          <Animated.View
                            style={[
                              styles.tooltip,
                              {
                                opacity: tooltipAnimation,
                                transform: [
                                  {
                                    translateY: tooltipAnimation.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [-5, 0],
                                    }),
                                  },
                                ],
                              },
                            ]}>
                            <Text style={styles.tooltipText}>
                              {originalFromAddress}
                            </Text>
                            <View style={styles.tooltipArrow} />
                          </Animated.View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {toAddress && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>To</Text>
                      <TouchableOpacity
                        onPressIn={() => showTooltip('to')}
                        onPressOut={hideTooltip}
                        activeOpacity={0.7}>
                        <Text style={styles.detailValue}>{toAddress}</Text>

                        {showToTooltip && (
                          <Animated.View
                            style={[
                              styles.tooltip,
                              {
                                opacity: tooltipAnimation,
                                transform: [
                                  {
                                    translateY: tooltipAnimation.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [-5, 0],
                                    }),
                                  },
                                ],
                              },
                            ]}>
                            <Text style={styles.tooltipText}>
                              {originalToAddress}
                            </Text>
                            <View style={styles.tooltipArrow} />
                          </Animated.View>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Signature with copy button */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Signature</Text>
                    <View style={styles.signatureContainer}>
                      <Text style={styles.detailValue}>
                        {truncatedSignature}
                      </Text>
                      <TouchableOpacity
                        onPress={copySignature}
                        style={styles.copyButton}>
                        <FontAwesome5
                          name={copied ? 'check' : 'copy'}
                          size={14}
                          color={copied ? '#4caf50' : COLORS.brandBlue}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Slot */}
                  {action.slot && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Slot</Text>
                      <Text style={styles.detailValue}>{action.slot}</Text>
                    </View>
                  )}
                </View>

                {/* View on Solscan Button */}
                <TouchableOpacity
                  onPress={openSolscan}
                  style={styles.solscanButton}
                  activeOpacity={0.8}>
                  <FontAwesome5
                    name="external-link-alt"
                    size={14}
                    color={COLORS.brandBlue}
                    style={styles.solscanIcon}
                  />
                  <Text style={styles.solscanText}>View on Solscan</Text>
                </TouchableOpacity>

                {/* Instructions Section */}
                {action.instructions && action.instructions.length > 0 && (
                  <View style={styles.instructionsContainer}>
                    <View style={styles.instructionHeader}>
                      <Text style={styles.sectionTitle}>Instructions</Text>
                      <TouchableOpacity
                        onPress={() => setShowInstructions(!showInstructions)}
                        style={styles.toggleButton}>
                        <Text style={styles.toggleButtonText}>
                          {showInstructions ? 'Hide' : 'Show'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {showInstructions && (
                      <View style={styles.instructionsList}>
                        {action.instructions.map((instr: any, idx: number) => (
                          <View key={idx} style={styles.instructionItem}>
                            <Text style={styles.instructionProgram}>
                              Program:{' '}
                              {instr.programId || instr.program || 'Unknown'}
                            </Text>
                            <View style={styles.instructionData}>
                              <Text style={styles.instructionDataText}>
                                {JSON.stringify(instr.data || instr, null, 2)}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default ActionDetailModal;
