import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { calendarApi } from '../../services/api';
import { getErrorMessage } from '../../utils/errorMessage';
import {
  CalendarItem,
  MeetingDetail,
  MeetingFormPayload,
  ParticipantSearchResult,
  RsvpStatus,
  UpcomingItem,
} from '../../types/calendar';

const rangeKey = (start: string, end: string) => `${start}|${end}`;

interface PickerState {
  searchQuery: string;
  searchResults: ParticipantSearchResult[];
  selectedParticipants: ParticipantSearchResult[];
  availabilityMap: Record<string, boolean>;
  loading: boolean;
  windowStart: string | null;
  windowEnd: string | null;
  page: number;
  total: number;
}

interface CurrentMeetingState {
  meeting: MeetingDetail | null;
  loading: boolean;
  error: string | null;
}

interface CalendarState {
  currentMonth: string; // 'YYYY-MM'
  selectedDate: string | null; // 'YYYY-MM-DD'
  rangeCache: Record<string, CalendarItem[]>;
  upcoming: UpcomingItem[];
  loading: boolean;
  error: string | null;
  picker: PickerState;
  current: CurrentMeetingState;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const initialState: CalendarState = {
  currentMonth: monthKey(new Date()),
  selectedDate: null,
  rangeCache: {},
  upcoming: [],
  loading: false,
  error: null,
  picker: {
    searchQuery: '',
    searchResults: [],
    selectedParticipants: [],
    availabilityMap: {},
    loading: false,
    windowStart: null,
    windowEnd: null,
    page: 1,
    total: 0,
  },
  current: {
    meeting: null,
    loading: false,
    error: null,
  },
};

/* ── Month / Agenda ── */

export const fetchRange = createAsyncThunk(
  'calendar/fetchRange',
  async ({ start, end }: { start: string; end: string }, { rejectWithValue }) => {
    try {
      const { data } = await calendarApi.listRange(start, end);
      return { key: rangeKey(start, end), items: (data as CalendarItem[]) ?? [] };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Could not load the calendar'));
    }
  },
);

export const fetchUpcoming = createAsyncThunk('calendar/fetchUpcoming', async (_: void, { rejectWithValue }) => {
  try {
    const { data } = await calendarApi.upcoming();
    return (data as UpcomingItem[]) ?? [];
  } catch (err) {
    return rejectWithValue(getErrorMessage(err, 'Could not load upcoming meetings'));
  }
});

/* ── Meeting detail ── */

export const fetchMeeting = createAsyncThunk('calendar/fetchMeeting', async (id: string, { rejectWithValue }) => {
  try {
    const { data } = await calendarApi.getOne(id);
    return data as MeetingDetail;
  } catch (err) {
    return rejectWithValue(getErrorMessage(err, 'Could not load this meeting'));
  }
});

/* ── Mutations — each invalidates the range/upcoming cache on success so the
 * next screen focus refetches fresh data instead of showing stale state. ── */

export const createMeeting = createAsyncThunk(
  'calendar/create',
  async (payload: MeetingFormPayload, { dispatch, rejectWithValue }) => {
    try {
      const { data } = await calendarApi.create(payload);
      dispatch(invalidateCache());
      return data as { success: true; eventId: string; conflicts: unknown[] };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Could not create the meeting'));
    }
  },
);

export const updateMeeting = createAsyncThunk(
  'calendar/update',
  async ({ id, payload }: { id: string; payload: Partial<MeetingFormPayload> }, { dispatch, rejectWithValue }) => {
    try {
      const { data } = await calendarApi.update(id, payload);
      dispatch(invalidateCache());
      return data;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Could not update the meeting'));
    }
  },
);

export const cancelMeeting = createAsyncThunk(
  'calendar/cancel',
  async (id: string, { dispatch, rejectWithValue }) => {
    try {
      await calendarApi.cancel(id);
      dispatch(invalidateCache());
      return id;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Could not cancel the meeting'));
    }
  },
);

export const rsvpMeeting = createAsyncThunk(
  'calendar/rsvp',
  async ({ id, status }: { id: string; status: RsvpStatus }, { dispatch, rejectWithValue }) => {
    try {
      await calendarApi.rsvp(id, status);
      dispatch(invalidateCache());
      const { data } = await calendarApi.getOne(id);
      return data as MeetingDetail;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Could not update your RSVP'));
    }
  },
);

/* ── Participant picker ── */

export const searchParticipants = createAsyncThunk(
  'calendar/searchParticipants',
  async (
    params: { q?: string; start?: string; end?: string; page?: number; limit?: number; excludeEventId?: string },
    { rejectWithValue },
  ) => {
    try {
      const { data } = await calendarApi.searchEmployees(params);
      return data as { data: ParticipantSearchResult[]; total: number; page: number; limit: number };
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, 'Could not search employees'));
    }
  },
);

const calendarSlice = createSlice({
  name: 'calendar',
  initialState,
  reducers: {
    /** Wipe on sign-out — meetings are per-user and must not leak across sessions. */
    clearCalendar: () => initialState,
    setCurrentMonth: (state, action: PayloadAction<string>) => {
      state.currentMonth = action.payload;
    },
    setSelectedDate: (state, action: PayloadAction<string | null>) => {
      state.selectedDate = action.payload;
    },
    /** Drops every cached range + the upcoming list so the next fetch is fresh. */
    invalidateCache: (state) => {
      state.rangeCache = {};
      state.upcoming = [];
    },
    clearCurrentMeeting: (state) => {
      state.current = { meeting: null, loading: false, error: null };
    },
    setPickerWindow: (state, action: PayloadAction<{ start: string | null; end: string | null }>) => {
      state.picker.windowStart = action.payload.start;
      state.picker.windowEnd = action.payload.end;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.picker.searchQuery = action.payload;
    },
    /** Full replace — used to pre-fill from an existing meeting's participants on edit. */
    setSelectedParticipants: (state, action: PayloadAction<ParticipantSearchResult[]>) => {
      state.picker.selectedParticipants = action.payload;
    },
    toggleParticipant: (state, action: PayloadAction<ParticipantSearchResult>) => {
      const p = action.payload;
      const idx = state.picker.selectedParticipants.findIndex((x) => x.employeeId === p.employeeId);
      if (idx >= 0) state.picker.selectedParticipants.splice(idx, 1);
      else state.picker.selectedParticipants.push(p);
    },
    removeParticipant: (state, action: PayloadAction<string>) => {
      state.picker.selectedParticipants = state.picker.selectedParticipants.filter((p) => p.employeeId !== action.payload);
    },
    clearPicker: (state) => {
      state.picker = { ...initialState.picker };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRange.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchRange.fulfilled, (state, action) => {
        state.loading = false;
        state.rangeCache[action.payload.key] = action.payload.items;
      })
      .addCase(fetchRange.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(fetchUpcoming.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchUpcoming.fulfilled, (state, action) => {
        state.loading = false;
        state.upcoming = action.payload;
      })
      .addCase(fetchUpcoming.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(fetchMeeting.pending, (state) => { state.current.loading = true; state.current.error = null; })
      .addCase(fetchMeeting.fulfilled, (state, action) => {
        state.current.loading = false;
        state.current.meeting = action.payload;
      })
      .addCase(fetchMeeting.rejected, (state, action) => {
        state.current.loading = false;
        state.current.error = action.payload as string;
      })

      .addCase(rsvpMeeting.fulfilled, (state, action) => {
        state.current.meeting = action.payload;
      })

      .addCase(searchParticipants.pending, (state) => { state.picker.loading = true; })
      .addCase(searchParticipants.fulfilled, (state, action) => {
        state.picker.loading = false;
        // page > 1 is a "load more" continuation — append instead of replace.
        const page = action.meta.arg.page ?? 1;
        state.picker.searchResults = page > 1 ? [...state.picker.searchResults, ...action.payload.data] : action.payload.data;
        state.picker.page = action.payload.page;
        state.picker.total = action.payload.total;
        const map: Record<string, boolean> = {};
        for (const r of action.payload.data) map[r.employeeId] = r.busy;
        state.picker.availabilityMap = { ...state.picker.availabilityMap, ...map };
      })
      .addCase(searchParticipants.rejected, (state) => { state.picker.loading = false; });
  },
});

export const {
  clearCalendar,
  setCurrentMonth,
  setSelectedDate,
  invalidateCache,
  clearCurrentMeeting,
  setPickerWindow,
  setSearchQuery,
  setSelectedParticipants,
  toggleParticipant,
  removeParticipant,
  clearPicker,
} = calendarSlice.actions;
export default calendarSlice.reducer;
