/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser';
import { BnetRegion, GameFormat, GameType } from '@firestone-hs/reference-data';
import { ReviewMessage } from '../review-message';
import { extractPlayedCards } from './played-card-extractor';

export const extractViciousSyndicateStats = (message: ReviewMessage, replay: Replay, replayString: string): VSStat => {
	return {
		game_id: message.reviewId,
		timestamp: Date.now(),
		game_meta: {
			BuildNumber: parseInt(message.buildNumber),
			FormatType: getFormatType(message.gameFormat),
			GameType: getGameType(message.gameMode),
			ScenarioID: parseInt(message.scenarioId),
			BnetRegion: BnetRegion[replay.region?.toString()]?.toString(),
		},
		friendly_player: {
			player_id: replay.mainPlayerId,
			class: message.playerClass.toUpperCase(),
			PLAYSTATE: message.result.toUpperCase(),
			cards: extractPlayedCards(replay, message, replay.mainPlayerId),
			deckstring: message.playerDecklist,
		},
		opposing_player: {
			player_id: replay.opponentPlayerId,
			class: message.opponentClass.toUpperCase(),
			PLAYSTATE: getOpponentPlaystate(message.result),
			cards: extractPlayedCards(replay, message, replay.opponentPlayerId),
		},
	};
};

const getOpponentPlaystate = (playerPlayState: 'lost' | 'won' | 'tied'): string => {
	switch (playerPlayState) {
		case 'lost':
			return 'WON';
		case 'tied':
			return 'TIED';
		case 'won':
			return 'LOST';
	}
};

const getGameType = (gameMode: string): string => {
	switch (gameMode) {
		case 'arena':
			return GameType.GT_ARENA.toString();
		case 'battlegrounds':
			return GameType.GT_BATTLEGROUNDS.toString();
		case 'casual':
			return GameType.GT_CASUAL.toString();
		case 'friendly':
			return GameType.GT_VS_FRIEND.toString();
		case 'practice':
			return GameType.GT_VS_AI.toString();
		case 'ranked':
			return GameType.GT_RANKED.toString();
		case 'tavern-brawl':
		case 'tavernbrawl':
			return GameType.GT_RANKED.toString();
		case 'ranked':
			return GameType.GT_RANKED.toString();
		default:
			return GameType.GT_UNKNOWN.toString();
	}
};
const getFormatType = (gameFormat: string): string => {
	switch (gameFormat) {
		case 'standard':
			return GameFormat.FT_STANDARD.toString();
		case 'wild':
			return GameFormat.FT_WILD.toString();
		default:
			return GameFormat.FT_UNKNOWN.toString();
	}
};

export interface VSStat {
	game_id: string;
	timestamp: number;
	game_meta: {
		BuildNumber: number;
		GameType: string;
		FormatType: string;
		ScenarioID: number;
		BnetRegion: string;
	};
	friendly_player: {
		player_id: number;
		class: string;
		PLAYSTATE: string;
		cards: string[];
		deckstring: string;
	};
	opposing_player: {
		player_id: number;
		class: string;
		PLAYSTATE: string;
		cards: string[];
	};
}
