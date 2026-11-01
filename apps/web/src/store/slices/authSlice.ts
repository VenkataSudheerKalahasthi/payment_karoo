import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserDto, UserRole } from '@trustpay/shared';

interface AuthState {
  user: UserDto | null;
  role: UserRole | null;
  isSynchronized: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  role: null,
  isSynchronized: false,
  isLoading: false,
  error: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setAuthUser: (state, action: PayloadAction<UserDto>) => {
      state.user = action.payload;
      state.role = action.payload.role.name;
      state.isSynchronized = true;
      state.isLoading = false;
      state.error = null;
    },
    clearAuthUser: (state) => {
      state.user = null;
      state.role = null;
      state.isSynchronized = false;
      state.isLoading = false;
      state.error = null;
    },
    setAuthError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const { setAuthLoading, setAuthUser, clearAuthUser, setAuthError } = authSlice.actions;
export default authSlice.reducer;

