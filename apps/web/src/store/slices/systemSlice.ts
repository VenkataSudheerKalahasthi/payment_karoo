import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { SystemHealthStatus, DatabaseHealthStatus } from '@trustpay/shared';

interface SystemState {
  apiStatus: 'unknown' | 'checking' | 'healthy' | 'degraded' | 'down';
  dbStatus: 'unknown' | 'checking' | 'connected' | 'disconnected' | 'error';
  systemDetails: SystemHealthStatus | null;
  databaseDetails: DatabaseHealthStatus | null;
  lastChecked: string | null;
}

const initialState: SystemState = {
  apiStatus: 'unknown',
  dbStatus: 'unknown',
  systemDetails: null,
  databaseDetails: null,
  lastChecked: null,
};

export const systemSlice = createSlice({
  name: 'system',
  initialState,
  reducers: {
    setChecking: (state) => {
      state.apiStatus = 'checking';
      state.dbStatus = 'checking';
    },
    setSystemHealth: (state, action: PayloadAction<SystemHealthStatus>) => {
      state.apiStatus = action.payload.status;
      state.systemDetails = action.payload;
      state.lastChecked = new Date().toISOString();
    },
    setApiFailed: (state) => {
      state.apiStatus = 'down';
      state.lastChecked = new Date().toISOString();
    },
    setDatabaseHealth: (state, action: PayloadAction<DatabaseHealthStatus>) => {
      state.dbStatus = action.payload.status;
      state.databaseDetails = action.payload;
    },
    setDatabaseFailed: (state) => {
      state.dbStatus = 'disconnected';
    },
  },
});

export const { setChecking, setSystemHealth, setApiFailed, setDatabaseHealth, setDatabaseFailed } =
  systemSlice.actions;

export default systemSlice.reducer;
