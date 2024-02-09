/* eslint-disable @typescript-eslint/no-use-before-define */
import { Sns } from '@firestone-hs/aws-lambda-utils';
import { Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { BnetRegion, GameFormat, GameFormatString, GameType } from '@firestone-hs/reference-data';
import { ReplayUploadMetadata } from '@firestone-hs/replay-metadata';
import { GetSecretValueRequest } from 'aws-sdk/clients/secretsmanager';
import axios from 'axios';
import { SecretInfo, getSecret } from '../db/rds';
import { ReviewMessage } from '../review-message';
import { allCards } from '../stats-builder';
import { cardDrawn } from './json-events/parsers/cards-draw-parser';
import { cardsInHand } from './json-events/parsers/cards-in-hand-parser';
import { ReplayParser } from './json-events/replay-parser';
import { extractPlayedCards } from './played-card-extractor';

const secretRequest: GetSecretValueRequest = {
	SecretId: 'd0nkey',
};
let secret: SecretInfo;

const sns = new Sns();

export const toD0nkey = async (
	message: ReviewMessage,
	metadata: ReplayUploadMetadata,
	replay: Replay,
): Promise<void> => {
	const debug = message.userName === 'daedin';
	if (!message.allowGameShare) {
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

	let cardsAfterMulligan: { cardId: string; kept: boolean }[] = [];
	let cardsBeforeMulligan: string[] = [];
	let cardsDrawn: any[] = [];
	if (metadata) {
		cardsDrawn = metadata?.stats?.matchAnalysis?.cardsDrawn ?? [];
		cardsAfterMulligan = metadata?.stats?.matchAnalysis?.cardsAfterMulligan ?? [];
	} else {
		const parser = new ReplayParser(replay, [cardsInHand, cardDrawn]);
		parser.on('cards-in-hand', (event) => {
			if (cardsBeforeMulligan?.length === 0) {
				cardsBeforeMulligan = event.cardsInHand;
			} else {
				cardsAfterMulligan = event.cardsInHand.map((cardId) => ({
					cardId: cardId,
					cardDbfId: allCards.getCard(cardId)?.dbfId,
					kept: cardsBeforeMulligan.includes(cardId),
				}));
			}
		});
		parser.on('card-draw', (event) => {
			// console.debug('card drawn', event.cardId);
			cardsDrawn = [
				...cardsDrawn,
				{ cardId: event.cardId, cardDbfId: allCards.getCard(event.cardId)?.dbfId, turn: event.turn },
			];
		});
		parser.parse();
	}

	const stats = {
		player: {
			battleTag: message.playerName,
			class: message.playerClass,
			rank: playerRank,
			legendRank: playerLegendRank,
			deckcode: message.playerDecklist,
			cards: metadata
				? metadata.stats?.playerPlayedCards
				: extractPlayedCards(replay, message, replay.mainPlayerId),
			cardsInHandAfterMulligan: cardsAfterMulligan,
			cardsDrawnFromInitialDeck: cardsDrawn,
		},
		opposing_player: {
			battleTag: message.opponentName,
			class: message.opponentClass,
			rank: opponentRank,
			legendRank: opponentLegendRank,
			deckcode: null,
			cards: metadata
				? metadata.stats?.opponentPlayedCards
				: extractPlayedCards(replay, message, replay.opponentPlayerId),
		},
		game_id: message.reviewId,
		game_type: gameType,
		format: formatType,
		result: message.result.toUpperCase(),
		region: metadata?.meta ? metadata.meta.region : BnetRegion[replay.region?.toString()]?.toString(),
		source: 'firestone',
		source_version: message.appVersion,
	};
	debug && console.debug('sending to d0nkey', JSON.stringify(stats, null, 4));
	try {
		secret = secret ?? (await getSecret(secretRequest));
		// TODO: retrieve the archetype as return of the call
		const reply = await axios.put('https://www.d0nkey.top/api/dt/game', stats, {
			auth: {
				username: secret.username,
				password: secret.password,
			},
		});
		// console.debug('sent request to d0nkey', reply, reply?.status, reply?.statusText, reply?.data);
		const d0nkeyData: D0nkeyData = reply?.data;
		if (d0nkeyData?.player_deck?.name?.length > 0) {
			debug && console.debug('sending to SNS', JSON.stringify(d0nkeyData, null, 4));
			sns.notify(
				process.env.ARCHETYPE_ASSIGNED_TOPIC,
				JSON.stringify({
					...message,
					archetype: d0nkeyData?.player_deck?.name,
				}),
			);
		}
	} catch (e) {
		console.error('Could not send request to d0nkey', stats, e);
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

interface D0nkeyData {
	player_deck: {
		// Name has XL and rune shorthands, archetype doesn't, ie XL Control Priest vs Control Priest
		name: string;
		archetype: string;
		deckcode: string;
	};
}
