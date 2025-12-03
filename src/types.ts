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
  id: string;
  name: string;
  groupNumber: number;
  chips: number;
  cards: number[];
  score: number;
  lastAction?: 'PASS' | 'TAKE' | null;
  members: TeamMember[];
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
  pot: number;
  hiddenCard: number | null;
  teams: Team[];
  currentTurnIndex: number;
  logs: string[];
  winnerId: string | null;
}

export type NetworkMessage =
  | { type: 'STATE_UPDATE'; payload: GameState }
  | { type: 'JOIN_REQUEST'; payload: { name: string; group: number; clientId: string } }
  | { type: 'LEAVE_NOTIFY'; payload: { clientId: string } }
  | { type: 'ACTION_PASS'; payload: { teamId: string } }
  | { type: 'ACTION_TAKE'; payload: { teamId: string } }
  | { type: 'ADMIN_START_GAME'; payload: object }
  | { type: 'ADMIN_RESET'; payload: object };

export const STARTING_CHIPS = 9;
export const MIN_CARD = -50;
export const MAX_CARD = -26;
export const MIN_TEAMS = 3;
export const MAX_TEAMS_LIMIT = 15;
