// ==========================================
// Stone Age Board Game - Type Definitions
// ==========================================

// --- Resources ---

export type ResourceType = 'wood' | 'brick' | 'stone' | 'gold';

export const RESOURCE_DIVISORS: Record<ResourceType | 'food', number> = {
  food: 2,
  wood: 3,
  brick: 4,
  stone: 5,
  gold: 6,
};

export const RESOURCE_VALUES: Record<ResourceType, number> = {
  wood: 3,
  brick: 4,
  stone: 5,
  gold: 6,
};

export const INITIAL_SUPPLY: Record<ResourceType, number> = {
  wood: 28,
  brick: 18,
  stone: 12,
  gold: 10,
};

// --- Board Locations ---

export type ResourceLocation = 'huntingGrounds' | 'forest' | 'clayPit' | 'quarry' | 'river';
export type VillageLocation = 'toolMaker' | 'hut' | 'field';
export type BuildingLocation = 'building_0' | 'building_1' | 'building_2' | 'building_3';
export type CardLocation = 'civCard_0' | 'civCard_1' | 'civCard_2' | 'civCard_3';

export type LocationId = ResourceLocation | VillageLocation | BuildingLocation | CardLocation;

export const RESOURCE_LOCATIONS: ResourceLocation[] = ['huntingGrounds', 'forest', 'clayPit', 'quarry', 'river'];
export const VILLAGE_LOCATIONS: VillageLocation[] = ['toolMaker', 'hut', 'field'];

export const LOCATION_RESOURCE_MAP: Record<ResourceLocation, ResourceType | 'food'> = {
  huntingGrounds: 'food',
  forest: 'wood',
  clayPit: 'brick',
  quarry: 'stone',
  river: 'gold',
};

export const LOCATION_MAX_WORKERS: Record<LocationId, number> = {
  huntingGrounds: 40, // effectively unlimited
  forest: 7,
  clayPit: 7,
  quarry: 7,
  river: 7,
  toolMaker: 1,
  hut: 2,
  field: 1,
  building_0: 1,
  building_1: 1,
  building_2: 1,
  building_3: 1,
  civCard_0: 1,
  civCard_1: 1,
  civCard_2: 1,
  civCard_3: 1,
};

// Card position costs (1-indexed position -> resource cost)
export const CARD_POSITION_COST: Record<CardLocation, number> = {
  civCard_0: 1,
  civCard_1: 2,
  civCard_2: 3,
  civCard_3: 4,
};

// --- Player Colors ---

export type PlayerColor = 'red' | 'blue' | 'green' | 'yellow';
export const PLAYER_COLORS: PlayerColor[] = ['red', 'blue', 'green', 'yellow'];

// --- Tools ---

export interface Tool {
  level: number; // 0-4
  usedThisRound: boolean;
}

// --- Civilization Cards ---

export type CultureSymbol =
  | 'writing' | 'medicine' | 'pottery' | 'art'
  | 'music' | 'weaving' | 'transport' | 'sundial';

export type MultiplierCategory = 'farmer' | 'toolMaker' | 'hutBuilder' | 'shaman';

export type ImmediateEffect =
  | { type: 'food'; amount: number }
  | { type: 'resource'; resource: ResourceType; amount: number }
  | { type: 'resourceDice'; diceCount: number }
  | { type: 'points'; amount: number }
  | { type: 'tool' }
  | { type: 'foodProduction' }
  | { type: 'cardDraw' }
  | { type: 'oneUseTool'; value: number }
  | { type: 'flexResources'; amount: number }
  | { type: 'diceForItems' };

export type ScoringBottom =
  | { type: 'culture'; symbol: CultureSymbol }
  | { type: 'multiplier'; category: MultiplierCategory; figureCount: number };

export interface CivilizationCard {
  id: string;
  immediateEffect: ImmediateEffect;
  scoringBottom: ScoringBottom;
}

// --- Building Tiles ---

export type BuildingCost =
  | { type: 'fixed'; resources: Partial<Record<ResourceType, number>>; points: number }
  | { type: 'flexible'; count: number; differentTypes: number }
  | { type: 'variable'; minResources: number; maxResources: number };

export interface BuildingTile {
  id: string;
  cost: BuildingCost;
}

// --- Player State ---

export interface PlayerResources {
  food: number;
  wood: number;
  brick: number;
  stone: number;
  gold: number;
}

export interface PlacedWorker {
  location: LocationId;
  count: number;
}

export interface PlayerState {
  id: string;
  name: string;
  color: PlayerColor;
  connected: boolean;

  // Workers
  totalWorkers: number;
  availableWorkers: number;
  placedWorkers: PlacedWorker[];

  // Resources
  resources: PlayerResources;

  // Tracks
  foodProduction: number; // 0-10
  score: number;

  // Tools (3 slots max)
  tools: Tool[];
  oneUseTools: number[];

  // Collected cards and buildings
  civilizationCards: CivilizationCard[];
  buildings: BuildingTile[];

  // Round tracking
  placedLocations: LocationId[];
  hasFed: boolean;

  // Action resolution tracking
  unresolvedLocations: LocationId[];
  currentDiceRoll: DiceRollState | null;
}

// --- Dice ---

export interface DiceRollState {
  location: LocationId;
  dice: number[];
  total: number;
  toolsApplied: number[];
  finalTotal: number;
  resourcesEarned: number;
  resolved: boolean;
}

// --- Board State ---

export interface LocationState {
  totalWorkers: number;
  workersByPlayer: Record<string, number>; // playerId -> count
}

export interface BoardState {
  locations: Record<LocationId, LocationState>;
}

// --- Game Phases ---

export type GamePhase = 'workerPlacement' | 'actionResolution' | 'feeding';

// --- Game State ---

export interface ResourceSupply {
  wood: number;
  brick: number;
  stone: number;
  gold: number;
}

export interface GameState {
  gameId: string;
  roundNumber: number;
  phase: GamePhase;
  currentPlayerIndex: number;
  firstPlayerIndex: number;
  players: PlayerState[];
  board: BoardState;
  civilizationDeck: CivilizationCard[];
  civilizationDisplay: (CivilizationCard | null)[];
  buildingStacks: BuildingTile[][];
  supply: ResourceSupply;
  supplyFood: number;
  gameOver: boolean;
  winner: string | null;
  finalScores: FinalScore[] | null;

  // Village blocking for 2-3 players
  blockedVillageLocation: VillageLocation | null;

  // Action resolution sub-state
  pendingDiceForItems: DiceForItemsState | null;

  // Game log
  log: GameLogEntry[];
}

export interface DiceForItemsState {
  cardPlayerId: string;
  dice: number[];
  playerChoices: Record<string, DiceForItemsChoice | null>; // playerId -> choice
}

export type DiceForItemsChoice =
  | { type: 'resource'; resource: ResourceType }
  | { type: 'tool' }
  | { type: 'foodProduction' };

// --- Scoring ---

export interface FinalScore {
  playerId: string;
  playerName: string;
  inGameScore: number;
  cultureSetScore: number;
  multiplierScore: MultiplierBreakdown;
  resourceScore: number;
  totalScore: number;
}

export interface MultiplierBreakdown {
  farmer: { figures: number; value: number; score: number };
  toolMaker: { figures: number; value: number; score: number };
  hutBuilder: { figures: number; value: number; score: number };
  shaman: { figures: number; value: number; score: number };
  total: number;
}

// --- Game Log ---

export interface GameLogEntry {
  timestamp: number;
  playerId?: string;
  message: string;
  type: 'placement' | 'dice' | 'resource' | 'building' | 'card' | 'feeding' | 'phase' | 'system';
}

// --- Room Types ---

export interface GameRoom {
  id: string;
  name: string;
  hostId: string;
  players: RoomPlayer[];
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number;
  createdAt: string;
  gameState: GameState | null;
  isPrivate: boolean;
  passcode?: string;
}

export interface RoomPlayer {
  id: string;
  name: string;
  picture?: string;
  connected: boolean;
  socketId?: string;
}

// --- Config ---

export interface StoneAgeConfig {
  dbPath: string;
  getUserById: (id: string) => Promise<StoneAgeUser | null>;
  corsOrigins: string[];
  validateSession?: (token: string) => Promise<string | null>; // returns userId or null
}

export interface StoneAgeUser {
  id: string;
  name: string;
  email?: string;
  picture?: string;
}

// --- Socket Events ---

export interface ClientToServerEvents {
  createRoom: (data: { name: string; maxPlayers: number; passcode?: string }) => void;
  joinRoom: (data: { roomId: string; passcode?: string }) => void;
  leaveRoom: () => void;
  startGame: () => void;
  placeWorkers: (data: { location: LocationId; count: number }) => void;
  resolveAction: (data: { location: LocationId }) => void;
  rollDice: () => void;
  useTools: (data: { toolIndices: number[] }) => void;
  confirmResourceGathering: () => void;
  payForBuilding: (data: { resources: Partial<Record<ResourceType, number>> }) => void;
  payForCard: (data: { resources: ResourceType[] }) => void;
  skipAction: () => void;
  feedWorkers: (data: { resourcesAsFood?: Partial<Record<ResourceType, number>> }) => void;
  acceptStarvation: () => void;
  chooseDiceReward: (data: { choice: DiceForItemsChoice }) => void;
}

export interface ServerToClientEvents {
  roomUpdate: (room: GameRoom) => void;
  roomList: (rooms: GameRoom[]) => void;
  gameState: (state: GameState) => void;
  diceResult: (data: { playerId: string; dice: number[]; location: LocationId }) => void;
  phaseChange: (data: { phase: GamePhase; roundNumber: number }) => void;
  turnChange: (data: { playerId: string }) => void;
  gameOver: (data: { finalScores: FinalScore[] }) => void;
  error: (data: { message: string }) => void;
  playerDisconnected: (data: { playerId: string }) => void;
  playerReconnected: (data: { playerId: string }) => void;
  notification: (data: { message: string }) => void;
}

// --- Validation ---

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// --- Player Stats ---

export interface PlayerStats {
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  highestScore: number;
  updatedAt: string;
}
