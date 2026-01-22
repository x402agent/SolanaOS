import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface NotificationState {
  visible: boolean;
  message: string | null;
  type: 'success' | 'error';
  signature?: string;
}

const initialState: NotificationState = {
  visible: false,
  message: null,
  type: 'success',
  signature: undefined,
};

/**
 * Redux slice for transaction notifications
 */
const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    showSuccessNotification: (
      state,
      action: PayloadAction<{ message: string; signature?: string }>
    ) => {
      state.visible = true;
      state.message = action.payload.message;
      state.type = 'success';
      state.signature = action.payload.signature;
    },
    showErrorNotification: (
      state,
      action: PayloadAction<{ message: string }>
    ) => {
      state.visible = true;
      state.message = action.payload.message;
      state.type = 'error';
      state.signature = undefined;
    },
    clearNotification: (state) => {
      state.visible = false;
      state.message = null;
      // We keep the signature in case we need it
    },
  },
});

export const {
  showSuccessNotification,
  showErrorNotification,
  clearNotification,
} = notificationSlice.actions;

export default notificationSlice.reducer; 