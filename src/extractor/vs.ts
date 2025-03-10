/* eslint-disable no-extra-boolean-cast */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { extractTotalDuration, extractTotalTurns, Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { BnetRegion, GameFormat, GameFormatString, GameType } from '@firestone-hs/reference-data';
import { ReplayUploadMetadata } from '@firestone-hs/replay-metadata';
import axios from 'axios';
import { ReviewMessage } from '../review-message';
import { extractPlayedCardsByTurn } from './played-card-extractor';

export const extractViciousSyndicateStats = async (
	message: ReviewMessage,
	metadata: ReplayUploadMetadata, // This is empty when reprocessing
	replay: Replay,
): Promise<string> => {
	const debug = message.userName === 'daedin';
	if (!message.allowGameShare) {
		return;
	}

	if (message.gameMode !== 'ranked') {
		return;
	}

	// Not syncing CN games for now to reduce costs
	const bnetRegion = !!metadata?.meta ? metadata.meta.region : replay.region;
	if (!bnetRegion) {
		return;
	}

	const formatType = getFormatType(message.gameFormat);
	const gameType = getGameType(message.gameMode);
	if (formatType === GameFormat[GameFormat.FT_UNKNOWN] || gameType === GameType[GameType.GT_UNKNOWN]) {
		return;
	}

	if (!message.playerClass || !message.opponentClass) {
		return;
	}

	const [playerRank, playerLegendRank] = convertLeagueToRank(message.playerRank);
	if (bnetRegion === BnetRegion.REGION_CN && (playerRank !== 51 || playerLegendRank > 10000)) {
		return;
	}

	const [opponentRank, opponentLegendRank] = convertLeagueToRank(message.opponentRank);
	const playerCardsFromMetadata = metadata?.stats?.playerPlayedCardsByTurn?.filter((c) => !c.createdBy);
	const playerCards =
		(metadata ? playerCardsFromMetadata : extractPlayedCardsByTurn(replay, replay.mainPlayerId)) ?? [];
	const opponentCardsFromMetadata = metadata?.stats?.opponentPlayedCardsByTurn?.filter((c) => !c.createdBy);
	const opponentCards =
		(metadata ? opponentCardsFromMetadata : extractPlayedCardsByTurn(replay, replay.opponentPlayerId)) ?? [];
	const vsStats = {
		game_id: message.reviewId,
		timestamp: Date.now(),
		game_duration_in_seconds: metadata?.game ? metadata.game.totalDurationSeconds : extractTotalDuration(replay),
		game_duration_in_turns: metadata?.game ? metadata.game.totalDurationTurns : extractTotalTurns(replay),
		patchNumber: parseInt(message.buildNumber),
		firestoneVersion: message.appVersion,
		game_meta: {
			BuildNumber: parseInt(message.buildNumber),
			FormatType: GameFormat[formatType],
			GameType: GameType[gameType],
			ScenarioID: parseInt(message.scenarioId),
			BnetRegion: bnetRegion,
		},
		friendly_player: {
			player_id: metadata?.game.mainPlayerId ?? replay?.mainPlayerId,
			class: message.playerClass.toUpperCase(),
			PLAYSTATE: message.result.toUpperCase(),
			cards: playerCards.map((c) => c.cardId),
			cardsByTurn: playerCards ?? [],
			cardsWithCreatedBy: metadata?.stats?.playerPlayedCardsByTurn,
			deckstring: message.playerDecklist,
			rank: playerRank,
			legendRank: playerLegendRank,
			going_first: metadata?.game.playCoin ? metadata?.game.playCoin === 'play' : replay.playCoin === 'play',
		},
		opposing_player: {
			player_id: metadata?.game.opponentPlayerId ?? replay?.opponentPlayerId,
			class: message.opponentClass.toUpperCase(),
			PLAYSTATE: getOpponentPlaystate(message.result),
			cards: opponentCards.map((c) => c.cardId),
			cardsByTurn: opponentCards,
			cardsWithCreatedBy: metadata?.stats?.opponentPlayedCardsByTurn,
			rank: opponentRank,
			legendRank: opponentLegendRank,
			going_first: metadata?.game ? metadata?.game.playCoin === 'coin' : replay.playCoin === 'coin',
		},
	};
	// console.debug('sending to VS', JSON.stringify(vsStats, null, 4));
	if (vsStats.friendly_player.cards.length === 0) {
		return;
	}
	try {
		await axios.post('http://datareaper.vicioussyndicate.com/fs', vsStats);
	} catch (e) {
		console.error('Could not send request to VS', JSON.stringify(vsStats, null, 4), e);
	}
};

const convertLeagueToRank = (playerRank: string): [number, number] => {
	if (!playerRank || playerRank === '-1--1') {
		return [null, 0];
	}
	if (playerRank.indexOf('legend-') !== -1) {
		return [51, parseInt(playerRank.split('legend-')[1])];
	}
	if (playerRank.indexOf('-') === -1) {
		return [null, 0];
	}
	const league = (5 - parseInt(playerRank.split('-')[0])) * 10;
	const rank = 10 - parseInt(playerRank.split('-')[1]) + 1;
	return [league + rank, 0];
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
			return GameType[GameType.GT_ARENA];
		case 'battlegrounds':
			return GameType[GameType.GT_BATTLEGROUNDS];
		case 'casual':
			return GameType[GameType.GT_CASUAL];
		case 'friendly':
			return GameType[GameType.GT_VS_FRIEND];
		case 'practice':
			return GameType[GameType.GT_VS_AI];
		case 'ranked':
			return GameType[GameType.GT_RANKED];
		case 'tavern-brawl':
		case 'tavernbrawl':
			return GameType[GameType.GT_TAVERNBRAWL];
		default:
			return GameType[GameType.GT_UNKNOWN];
	}
};

const getFormatType = (gameFormat: GameFormatString): string => {
	switch (gameFormat) {
		case 'standard':
			return GameFormat[GameFormat.FT_STANDARD];
		case 'wild':
			return GameFormat[GameFormat.FT_WILD];
		case 'classic':
			return GameFormat[GameFormat.FT_CLASSIC];
		case 'twist':
			return GameFormat[GameFormat.FT_TWIST];
		default:
			return GameFormat[GameFormat.FT_UNKNOWN];
	}
};

export interface VSStat {
	game_id: string;
	timestamp: number;
	game_duration_in_seconds: number;
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
		rank: number;
		legendRank: number;
		going_first: boolean;
	};
	opposing_player: {
		player_id: number;
		class: string;
		PLAYSTATE: string;
		cards: string[];
		rank: number;
		legendRank: number;
		going_first: boolean;
	};
}
