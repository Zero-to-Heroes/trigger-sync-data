/* eslint-disable no-extra-boolean-cast */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { extractTotalDuration, Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { BnetRegion, GameFormat, GameFormatString, GameType } from '@firestone-hs/reference-data';
import { ReplayUploadMetadata } from '@firestone-hs/replay-metadata';
import axios from 'axios';
import { ReviewMessage } from '../review-message';
import { extractPlayedCards } from './played-card-extractor';

export const extractViciousSyndicateStats = async (
	message: ReviewMessage,
	metadata: ReplayUploadMetadata, // This is empty when reprocessing
	replay: Replay,
): Promise<void> => {
	const debug = message.userName === 'daedin';
	if (!message.allowGameShare) {
		return;
	}

	if (message.gameMode !== 'ranked') {
		return;
	}

	// Not syncing CN games for now to reduce costs
	const bnetRegion = !!metadata?.meta ? metadata.meta.region : replay.region;
	if (!bnetRegion || bnetRegion === BnetRegion.REGION_CN) {
		return;
	}

	const formatType = getFormatType(message.gameFormat);
	const gameType = getGameType(message.gameMode);
	if (formatType === GameFormat.FT_UNKNOWN.toString() || gameType === GameType.GT_UNKNOWN.toString()) {
		return;
	}

	if (!message.playerClass || !message.opponentClass) {
		return;
	}

	const [playerRank, playerLegendRank] = convertLeagueToRank(message.playerRank);
	const [opponentRank, opponentLegendRank] = convertLeagueToRank(message.opponentRank);
	const vsStats = {
		game_id: message.reviewId,
		timestamp: Date.now(),
		game_duration_in_seconds: metadata?.game ? metadata.game.totalDurationSeconds : extractTotalDuration(replay),
		patchNumber: parseInt(message.buildNumber),
		game_meta: {
			BuildNumber: parseInt(message.buildNumber),
			FormatType: formatType,
			GameType: gameType,
			ScenarioID: parseInt(message.scenarioId),
			BnetRegion: bnetRegion,
		},
		friendly_player: {
			player_id: metadata?.game.mainPlayerId ?? replay?.mainPlayerId,
			class: message.playerClass.toUpperCase(),
			PLAYSTATE: message.result.toUpperCase(),
			cards:
				(metadata
					? metadata.stats?.playerPlayedCards
					: extractPlayedCards(replay, message, replay.mainPlayerId)) ?? [],
			deckstring: message.playerDecklist,
			rank: playerRank,
			legendRank: playerLegendRank,
			going_first: metadata?.game.playCoin ? metadata?.game.playCoin === 'play' : replay.playCoin === 'play',
		},
		opposing_player: {
			player_id: metadata?.game.opponentPlayerId ?? replay?.opponentPlayerId,
			class: message.opponentClass.toUpperCase(),
			PLAYSTATE: getOpponentPlaystate(message.result),
			cards:
				(metadata
					? metadata.stats?.opponentPlayedCards
					: extractPlayedCards(replay, message, replay.opponentPlayerId)) ?? [],
			rank: opponentRank,
			legendRank: opponentLegendRank,
			going_first: metadata?.game ? metadata?.game.playCoin === 'coin' : replay.playCoin === 'coin',
		},
	};
	debug && console.debug('sending to VS', JSON.stringify(vsStats, null, 4));
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
			return GameType.GT_TAVERNBRAWL.toString();
		default:
			return GameType.GT_UNKNOWN.toString();
	}
};

const getFormatType = (gameFormat: GameFormatString): string => {
	switch (gameFormat) {
		case 'standard':
			return GameFormat.FT_STANDARD.toString();
		case 'wild':
			return GameFormat.FT_WILD.toString();
		case 'classic':
			return GameFormat.FT_CLASSIC.toString();
		case 'twist':
			return GameFormat.FT_TWIST.toString();
		default:
			return GameFormat.FT_UNKNOWN.toString();
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
