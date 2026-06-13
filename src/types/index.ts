/**
 * Khumpai domain model — the single source of truth for all non-UI modules.
 *
 * Conventions:
 * - All timestamps are ISO 8601 strings (JSON-safe for sessionStorage persistence).
 * - `timestamp` = when the real-world event HAPPENED.
 * - `createdAt` = when it was registered in the app (may differ for retroactive logs).
 * - User-facing strings live in src/data/i18n/agent-es.ts, never inline here.
 */

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export type PersonRelation = 'self' | 'father' | 'mother';

export interface Person {
  id: string;
  name: string;
  relation: PersonRelation;
  /** Hex color used by the UI to distinguish people in caregiver mode. */
  color: string;
}

/** The account holder currently using the app (patient or caregiver). */
export interface AppUser {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Log entries (discriminated union on `type`)
// ---------------------------------------------------------------------------

export type LogType =
  | 'meal'
  | 'glucose'
  | 'medication'
  | 'symptom'
  | 'sleep'
  | 'mood'
  | 'stress'
  | 'activity';

export type LogSource = 'conversation' | 'quick_action' | 'notification' | 'seed';

export type MealContext = 'casa' | 'fuera';
export type GlucoseMoment = 'ayunas' | 'post-desayuno' | 'post-almuerzo' | 'post-cena';

/** Escalation level from the red-flag evaluator. */
export type RedFlagLevel = 'ok' | 'watch' | 'urgent' | 'emergency';

export interface MealPayload {
  description: string;
  context: MealContext;
}

export interface GlucosePayload {
  /** mg/dL */
  value: number;
  moment: GlucoseMoment;
}

export interface MedicationPayload {
  name: string;
  taken: boolean;
}

export interface SymptomPayload {
  description: string;
  redFlag: boolean;
  level?: RedFlagLevel;
}

export interface SleepPayload {
  hours: number;
}

/** 1 (muy mal) .. 5 (muy bien) */
export type MoodScore = 1 | 2 | 3 | 4 | 5;
export interface MoodPayload {
  score: MoodScore;
}

/** 1 (bajo) .. 3 (alto) */
export type StressLevel = 1 | 2 | 3;
export interface StressPayload {
  level: StressLevel;
}

export interface ActivityPayload {
  type: string;
  minutes?: number;
}

interface BaseLogEntry {
  id: string;
  personId: string;
  /** When the event happened (ISO 8601). */
  timestamp: string;
  /** When it was registered (ISO 8601). */
  createdAt: string;
  /** Set when the entry was edited after creation (ISO 8601). */
  editedAt?: string;
  source: LogSource;
  /** Pending entries (confirmed=false) are never persisted as truth until confirmed. */
  confirmed: boolean;
  /** True when captured while offline and queued for sync. */
  isOfflineCapture: boolean;
}

export interface MealLog extends BaseLogEntry {
  type: 'meal';
  payload: MealPayload;
}
export interface GlucoseLog extends BaseLogEntry {
  type: 'glucose';
  payload: GlucosePayload;
}
export interface MedicationLog extends BaseLogEntry {
  type: 'medication';
  payload: MedicationPayload;
}
export interface SymptomLog extends BaseLogEntry {
  type: 'symptom';
  payload: SymptomPayload;
}
export interface SleepLog extends BaseLogEntry {
  type: 'sleep';
  payload: SleepPayload;
}
export interface MoodLog extends BaseLogEntry {
  type: 'mood';
  payload: MoodPayload;
}
export interface StressLog extends BaseLogEntry {
  type: 'stress';
  payload: StressPayload;
}
export interface ActivityLog extends BaseLogEntry {
  type: 'activity';
  payload: ActivityPayload;
}

export type LogEntry =
  | MealLog
  | GlucoseLog
  | MedicationLog
  | SymptomLog
  | SleepLog
  | MoodLog
  | StressLog
  | ActivityLog;

/** Maps a LogType to its payload shape (useful for generic helpers). */
export interface PayloadByType {
  meal: MealPayload;
  glucose: GlucosePayload;
  medication: MedicationPayload;
  symptom: SymptomPayload;
  sleep: SleepPayload;
  mood: MoodPayload;
  stress: StressPayload;
  activity: ActivityPayload;
}

// ---------------------------------------------------------------------------
// Medications
// ---------------------------------------------------------------------------

export interface AdherenceRecord {
  /** ISO date (YYYY-MM-DD) of the scheduled dose. */
  date: string;
  /** "HH:mm" scheduled time. */
  scheduledTime: string;
  taken: boolean;
}

export interface Medication {
  id: string;
  personId: string;
  name: string;
  dose: string;
  /** Human-readable frequency, e.g. "2 veces al día". */
  frequency: string;
  /** "HH:mm" times, e.g. ["08:00", "20:00"]. */
  schedule: string[];
  adherenceLog: AdherenceRecord[];
}

// ---------------------------------------------------------------------------
// Doctor-facing artifacts
// ---------------------------------------------------------------------------

export type DoctorNoteSource = 'guardrail' | 'user' | 'khumpi' | 'pattern';

export interface DoctorNote {
  id: string;
  personId: string;
  text: string;
  timestamp: string;
  source: DoctorNoteSource;
  /** True when this note is a question to ask the doctor. */
  forQuestion: boolean;
}

export interface DoctorVisit {
  id: string;
  personId: string;
  /** ISO date of the visit. */
  date: string;
  whatDoctorSaid: string;
  indications: string[];
  /** ISO date of the next appointment, if scheduled. */
  nextAppointment?: string;
}

// ---------------------------------------------------------------------------
// Insights / patterns
// ---------------------------------------------------------------------------

export type InsightConfidence = 'clear' | 'possible';

export interface ChartPoint {
  label: string;
  value: number;
  /** Optional grouping/series key for the UI chart. */
  category?: string;
}

export interface Insight {
  id: string;
  personId: string;
  /** Machine key for the pattern, e.g. "sleep_glucose". */
  pattern: string;
  confidence: InsightConfidence;
  /** How many matching data pairs support this insight. */
  basedOnCount: number;
  /** Plain Peruvian-Spanish explanation, with honesty about sample size. */
  text: string;
  chartData: ChartPoint[];
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export type InputMode = 'text' | 'voice' | 'quick_action';

export interface UserPrefs {
  preferredInputMode: InputMode;
  /** Counters used to learn the preferred input mode. */
  inputModeCounts: Record<InputMode, number>;
  /** Hours (0-23) at which the user is typically active. */
  activeHours: number[];
  /** Counters per hour-of-day used to learn active hours. */
  activeHourCounts: Record<string, number>;
  /** suggestionType -> times accepted. */
  acceptedSuggestionTypes: Record<string, number>;
  /** suggestionType -> times rejected. */
  rejectedSuggestionTypes: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Emergency / contacts
// ---------------------------------------------------------------------------

export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
  /** True when this contact is also a caregiver app user. */
  isCaregiverUser: boolean;
}

// ---------------------------------------------------------------------------
// Education snippets (RAG result shape)
// ---------------------------------------------------------------------------

export interface EducationSnippet {
  content: string;
  /** Attribution, e.g. "MINSA" or "ADA". Required for every educational answer. */
  source: string;
}

// ---------------------------------------------------------------------------
// Precomputed package (generated for offline / fast morning experience)
// ---------------------------------------------------------------------------

export interface PrecomputedPackage {
  generatedAt: string;
  validUntil: string;
  morningGreeting: string;
  morningCheckin: string;
  mealGuidance: string;
  motivationalMessage: string;
  educationSnippet: EducationSnippet;
  redFlagReminders: string[];
}

// ---------------------------------------------------------------------------
// Achievements (celebration-only; never streaks/missed days)
// ---------------------------------------------------------------------------

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlockedAt: string;
  /** Optional icon key for the UI. */
  icon?: string;
}

// ---------------------------------------------------------------------------
// Chat & agent message shapes
// ---------------------------------------------------------------------------

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  /** True while the assistant message is still streaming. */
  pending?: boolean;
}

export interface AgentResponse {
  text: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
}

// ---------------------------------------------------------------------------
// Offline rules result
// ---------------------------------------------------------------------------

export type OfflineSeverity = 'info' | 'warning' | 'urgent' | 'emergency';

export interface OfflineResponse {
  severity: OfflineSeverity;
  message: string;
  /** Machine key for the rule that fired, e.g. "glucose_high". */
  rule: string;
  /** True when the UI should surface the emergency contact / call action. */
  showEmergencyContact: boolean;
}

// ---------------------------------------------------------------------------
// Top-level application state
// ---------------------------------------------------------------------------

export type AppMode = 'patient' | 'caregiver';

export interface AppState {
  mode: AppMode;
  user: AppUser;
  persons: Person[];
  currentPersonId: string;
  logs: LogEntry[];
  medications: Medication[];
  doctorNotes: DoctorNote[];
  doctorVisits: DoctorVisit[];
  insights: Insight[];
  prefs: UserPrefs;
  emergencyContact: EmergencyContact;
  isOffline: boolean;
  /** Entries captured offline, awaiting flush in chronological order. */
  syncQueue: LogEntry[];
  precomputedPackage: PrecomputedPackage | null;
  chatHistory: ChatMessage[];
  achievements: Achievement[];
}

// ---------------------------------------------------------------------------
// Notifications (in-app reminder system)
//
// Notifications are NOT part of AppState: like pill stock (usePillboxStore),
// they live in a dedicated store (useNotificationStore) since they are a
// UI/session concern, not authoritative health data.
// ---------------------------------------------------------------------------

export type NotificationKind =
  | 'medication'
  | 'red_flag'
  | 'caregiver'
  | 'checkin'
  | 'achievement';

export type NotificationSeverity = 'info' | 'warn' | 'urgent';

export type NotificationStatus = 'pending' | 'shown' | 'read' | 'dismissed';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  severity: NotificationSeverity;
  /** ISO timestamp the notification became due. */
  createdAt: string;
  /** Stable key; a second push with the same key is ignored. */
  dedupeKey: string;
  status: NotificationStatus;
  /** medicationId / logId / achievementId, by kind. */
  relatedId?: string;
  /** Caregiver multi-person attribution. */
  personId?: string;
}
