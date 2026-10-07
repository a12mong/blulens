/**
 * E2E test selectors for @blulens/web Playwright smoke tests (bl-21).
 *
 * Official data-testid values agreed with Dwight (dwight-muxsq5jb) & Andy (andy-muxsqkra).
 * Reflects final bl-21 4-step wizard at /events/new + Admin-created doubles entry -> forward -> Committee approve/reject.
 *
 * Routes:
 *   /login
 *   /events
 *   /events/new
 *   /admin/events/[eventId]/entries/new
 *   /admin/events/[eventId]/entries
 *   /committee/events/[eventId]/entries
 *   /events/[eventId]/entries
 */

import path from 'path';

export const AUTH_DIR = path.join(__dirname, '.auth');
export const ADMIN_AUTH_FILE = path.join(AUTH_DIR, 'admin.json');
export const COMMITTEE_AUTH_FILE = path.join(AUTH_DIR, 'committee.json');
export const MEMBER_AUTH_FILE = path.join(AUTH_DIR, 'member1.json');

export const SELECTORS = {
  // --- Auth / Login ---
  login: {
    identifier: 'login-identifier',
    password: 'login-password',
    submit: 'login-submit',
    error: 'login-error',
    logout: 'nav-logout',
  },

  // --- Tournament List & Cards (/events) ---
  tournament: {
    list: 'tournament-list',
    card: 'tournament-card', // attr data-tournament-id
    createOpen: 'tournament-create-open', // link to /events/new
    name: 'tournament-name',
    status: 'tournament-status', // attr data-status (draft | open)
    eventChip: 'tournament-event-chip',
    open: 'tournament-open', // link to /events/[id]
    publish: 'tournament-publish', // button (draft -> open)
  },

  // --- 4-Step Tournament Wizard (/events/new) ---
  wizard: {
    stepper: 'stepper',
    stepperStep: 'stepper-step', // attr data-state (done | current | todo)
    // Step 1: General Info
    name: 'tournament-name',
    venue: 'tournament-venue',
    // Step 2: Schedule
    startsOn: 'tournament-starts-on', // type=date
    entriesClose: 'tournament-entries-close', // type=datetime-local
    // Step 3: Event Types
    eventTypeCard: 'event-type-card', // wrapper per event type (repeatable)
    etcDiscipline: 'etc-discipline', // <select> MS|WS|MD|WD|XD
    gradeMin: 'grade-min', // <select> GradeKey
    gradeMax: 'grade-max', // <select> GradeKey
    etcMaxEntries: 'etc-max-entries', // number input
    etcFresh: 'etc-fresh', // checkbox
    etcFormatKnockout: 'etc-format-knockout', // radio
    etcFormatGroupsKnockout: 'etc-format-groups_knockout', // radio
    etcRemove: 'etc-remove', // button
    addEventType: 'wizard-add-event-type', // button
    // Step 4 & Navigation
    summary: 'wizard-summary',
    back: 'wizard-back',
    next: 'wizard-next',
    create: 'wizard-create', // submit button, text 'สร้างทัวร์นาเมนต์'
    error: 'wizard-error',
  },

  // --- Common Player & Team Pickers ---
  playerPicker: {
    input: 'player-input',
    options: 'player-options',
    option: 'player-option',
    empty: 'player-empty',
  },

  teamPicker: {
    input: 'team-input',
    options: 'team-options',
    option: 'team-option',
    requestNew: 'team-request-new',
    requestSent: 'team-request-sent',
  },

  // --- Admin Doubles Entry Creation (/admin/events/[eventId]/entries/new) ---
  entryForm: {
    player1: 'entry-player-1',
    player2: 'entry-player-2',
    team1: 'entry-team-1',
    team2: 'entry-team-2',
    name: 'entry-name',
    saveDraft: 'entry-save-draft',
    warnings: 'entry-warnings',
    error: 'entry-error',
  },

  // --- Entry Table & Actions (/admin or /committee/events/[eventId]/entries) ---
  entryList: {
    table: 'entry-table',
    row: 'entry-row', // attr data-entry-id, data-status
    status: 'entry-status',
    players: 'entry-players',
    gradeHidden: 'entry-grade-hidden',
    multiteam: 'entry-multiteam',
    empty: 'entry-empty',
    edit: 'entry-edit',
    forward: 'entry-forward',
    approve: 'entry-approve',
    reject: 'entry-reject',
  },

  // --- Reason Dialog (Reject or out-of-band reason) ---
  reasonDialog: {
    input: 'reason-input',
    submit: 'reason-submit',
    cancel: 'reason-cancel',
    error: 'reason-error',
  },
} as const;

export const ROUTES = {
  login: '/login',
  events: '/events',
  eventsNew: '/events/new',
  adminEntryNew: (eventId: string) => `/admin/events/${eventId}/entries/new`,
  adminEntries: (eventId: string) => `/admin/events/${eventId}/entries`,
  committeeEntries: (eventId: string) => `/committee/events/${eventId}/entries`,
  publicEntries: (eventId: string) => `/events/${eventId}/entries`,
  forbidden: '/403',
} as const;
