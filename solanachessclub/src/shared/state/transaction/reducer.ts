import {createSlice, PayloadAction} from '@reduxjs/toolkit';

interface TransactionState {
  transactionMode: 'jito' | 'priority';
  selectedFeeTier: 'low' | 'medium' | 'high' | 'very-high';
}

const initialState: TransactionState = {
  transactionMode: 'priority',
  selectedFeeTier: 'medium',
};

const transactionSlice = createSlice({
  name: 'transaction',
  initialState,
  reducers: {
    setTransactionMode(state, action: PayloadAction<'jito' | 'priority'>) {
      state.transactionMode = action.payload;
    },
    setSelectedFeeTier(
      state,
      action: PayloadAction<'low' | 'medium' | 'high' | 'very-high'>,
    ) {
      state.selectedFeeTier = action.payload;
    },
  },
});

export const {setTransactionMode, setSelectedFeeTier} =
  transactionSlice.actions;
export default transactionSlice.reducer;
