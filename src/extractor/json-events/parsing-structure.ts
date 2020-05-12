export interface ParsingStructure {
	currentTurn: number;

	entities: {
		[entityId: string]: {
			cardId: string;
			tribe: number;
			controller: number;
			zone: number;
			zonePosition: number;
			cardType: number;
			atk: number;
			health: number;
			divineShield: boolean;
			poisonous: boolean;
			taunt: boolean;
			reborn: boolean;
		};
	};
	// playerHps: {
	// 	[cardId: string]: number;
	// };
	// leaderboardPositions: {
	// 	[cardId: string]: number;
	// };
	// rerollsIds: string[];
	// rerollsForTurn: number;
	// minionsSoldIds: string[];
	// minionsSoldForTurn: number;

	// boardOverTurn: Map<number, readonly { cardId: string; tribe: number }[]>;
	// minionsDamageDealt: { [cardId: string]: number };
	// minionsDamageReceived: { [cardId: string]: number };
	// rerollOverTurn: Map<number, number>;
	// minionsSoldOverTurn: Map<number, number>;
	// totalStatsOverTurn: Map<number, number>;
	// hpOverTurn: { [playerCardId: string]: readonly NumericTurnInfo[] };
	// leaderboardPositionOverTurn: { [playerCardId: string]: readonly NumericTurnInfo[] };
}
