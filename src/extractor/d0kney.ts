/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { BnetRegion, GameFormat, GameFormatString, GameType } from '@firestone-hs/reference-data';
import { GetSecretValueRequest } from 'aws-sdk/clients/secretsmanager';
import axios from 'axios';
import { getSecret, SecretInfo } from '../db/rds';
import { Preferences } from '../preferences';
import { ReviewMessage } from '../review-message';

export const toD0nkey = async (
	message: ReviewMessage,
	replay: Replay,
	replayString: string,
	prefs: Preferences,
): Promise<void> => {
	if (!prefs.d0nkeySync) {
		return;
	}

	const gameType = getGameType(message.gameMode);
	if (![GameType.GT_RANKED.toString()].includes(gameType)) {
		return;
	}

	const formatType = getFormatType(message.gameFormat);
	if (formatType === GameFormat.FT_UNKNOWN.toString() || gameType === GameType.GT_UNKNOWN.toString()) {
		return;
	}

	if (!message.playerClass || !message.opponentClass) {
		return;
	}

	const [playerRank, playerLegendRank] = convertLeagueToRank(message.playerRank);
	const [opponentRank, opponentLegendRank] = convertLeagueToRank(message.opponentRank);
	const stats = {
		player: {
			battleTag: message.playerName,
			class: message.playerClass,
			rank: playerRank,
			legendRank: playerLegendRank,
			deckcode: message.playerDecklist,
		},
		opposing_player: {
			battleTag: message.opponentName,
			class: message.opponentClass,
			rank: opponentRank,
			legendRank: opponentLegendRank,
			deckcode: null,
		},
		game_id: message.reviewId,
		game_type: gameType,
		format: formatType,
		result: message.result.toUpperCase(),
		region: BnetRegion[replay.region?.toString()]?.toString(),
	};
	try {
		const secretRequest: GetSecretValueRequest = {
			SecretId: 'd0nkey',
		};
		const secret: SecretInfo = await getSecret(secretRequest);
		console.log('sending auth', {
			username: secret.username,
			password: secret.password,
		});
		await axios.put('https://www.d0nkey.top/api/dt/game', stats, {
			auth: {
				username: secret.username,
				password: secret.password,
			},
		});
	} catch (e) {
		console.error('Could not send request to d0nkey', JSON.stringify(stats, null, 4), e);
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
