
export enum GamePhase {
  LOBBY = 'LOBBY',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface TeamMember {
  clientId: string;
  name: string;
}

export interface Team {
  id: string; // UUID or simple ID
  name: string; // Team Name (Representative) or Group Name
  groupNumber: number; // Selected Group Number (1-12)
  chips: number; // Resources (1억 unit)
  cards: number[]; // Projects taken
  score: number; // Current Net Profit calculation
  lastAction?: 'PASS' | 'TAKE' | null;
  members: TeamMember[]; // List of connected users
}

export interface RoomConfig {
  roomName: string;
  maxTeams: number;
}

export interface GameState {
  phase: GamePhase;
  roomConfig: RoomConfig;
  deck: number[];
  currentCard: number | null;
  pot: number; // Resources on the current project
  hiddenCard: number | null;
  teams: Team[];
  currentTurnIndex: number;
  logs: string[];
  winnerId: string | null;
}

// Network Message Types for BroadcastChannel
export type NetworkMessage = 
  | { type: 'STATE_UPDATE'; payload: GameState }
  | { type: 'JOIN_REQUEST'; payload: { name: string; group: number; clientId: string } }
  | { type: 'LEAVE_NOTIFY'; payload: { clientId: string } }
  | { type: 'ACTION_PASS'; payload: { teamId: string } }
  | { type: 'ACTION_TAKE'; payload: { teamId: string } }
  | { type: 'ADMIN_START_GAME'; payload: {} }
  | { type: 'ADMIN_RESET'; payload: {} };

export const STARTING_CHIPS = 9;

// Updated Rule: -50 to -26
export const MIN_CARD = -50;
export const MAX_CARD = -26;

// Team constraints
export const MIN_TEAMS = 3;
export const MAX_TEAMS_LIMIT = 15; // Increased limit
