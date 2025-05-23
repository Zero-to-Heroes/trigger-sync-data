/* eslint-disable no-extra-boolean-cast */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { Sns, Sqs } from '@firestone-hs/aws-lambda-utils';
import { Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { GameFormat, GameFormatString, GameType } from '@firestone-hs/reference-data';
import { ReplayUploadMetadata } from '@firestone-hs/replay-metadata';
import { GetSecretValueRequest } from 'aws-sdk/clients/secretsmanager';
import axios from 'axios';
import { SecretInfo, getSecret } from '../db/rds';
import { ReviewMessage } from '../review-message';
import { allCards } from '../stats-builder';
import { cardDrawn } from './json-events/parsers/cards-draw-parser';
import { cardsInHand } from './json-events/parsers/cards-in-hand-parser';
import { ReplayParser } from './json-events/replay-parser';
import { extractPlayedCardsByTurn } from './played-card-extractor';

const secretRequest: GetSecretValueRequest = {
	SecretId: 'd0nkey',
};
let secret: SecretInfo;

const sns = new Sns();
const sqs = new Sqs();

export const toD0nkey = async (
	message: ReviewMessage,
	metadata: ReplayUploadMetadata,
	replay: Replay,
): Promise<string> => {
	const debug = message.userName === 'daedin';
	if (!message.allowGameShare) {
		return;
	}

	const gameType = getGameType(message.gameMode);
	if (![GameType.GT_RANKED, GameType.GT_TAVERNBRAWL].includes(GameType[gameType])) {
		return;
	}

	const formatType = getFormatType(message.gameFormat);
	if (GameFormat[formatType] === GameFormat.FT_UNKNOWN || GameType[gameType] === GameType.GT_UNKNOWN) {
		return;
	}

	if (!message.playerClass || !message.opponentClass) {
		return;
	}

	const [playerRank, playerLegendRank] = convertLeagueToRank(message.playerRank);
	const [opponentRank, opponentLegendRank] = convertLeagueToRank(message.opponentRank);

	let cardsAfterMulligan: { cardId: string; kept: boolean }[] = [];
	let cardsBeforeMulligan: readonly string[] = [];
	let cardsDrawn: any[] = [];
	if (metadata) {
		cardsDrawn = metadata?.stats?.matchAnalysis?.cardsDrawn ?? [];
		cardsAfterMulligan = metadata?.stats?.matchAnalysis?.cardsAfterMulligan ?? [];
		cardsBeforeMulligan = metadata?.stats?.matchAnalysis?.cardsBeforeMulligan ?? [];
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

	const bnetRegion = !!metadata?.meta ? metadata.meta.region : replay.region;
	const playerCardsFromMetadata = metadata?.stats?.playerPlayedCardsByTurn?.filter((c) => !c.createdBy);
	const playerCards =
		(metadata ? playerCardsFromMetadata : extractPlayedCardsByTurn(replay, replay.mainPlayerId)) ?? [];
	const opponentCardsFromMetadata = metadata?.stats?.opponentPlayedCardsByTurn?.filter((c) => !c.createdBy);
	const opponentCards =
		(metadata ? opponentCardsFromMetadata : extractPlayedCardsByTurn(replay, replay.opponentPlayerId)) ?? [];
	const stats = {
		player: {
			battleTag: message.playerName,
			class: message.playerClass,
			rank: playerRank,
			legendRank: playerLegendRank,
			deckcode: message.playerDecklist,
			cards: playerCards.map((c) => c.cardId),
			cardsWithCreatedBy: metadata?.stats?.playerPlayedCardsByTurn,
			cardsInHandAfterMulligan: cardsAfterMulligan,
			cardsBeforeMulligan: cardsBeforeMulligan,
			cardsDrawnFromInitialDeck: cardsDrawn,
			hasCoin: metadata?.game?.playCoin === 'coin' ? true : metadata?.game?.playCoin === 'play' ? false : null,
		},
		opposing_player: {
			battleTag: message.opponentName,
			class: message.opponentClass,
			rank: opponentRank,
			legendRank: opponentLegendRank,
			deckcode: null,
			cards: opponentCards.map((c) => c.cardId),
			cardsWithCreatedBy: metadata?.stats?.opponentPlayedCardsByTurn,
		},
		game_id: message.reviewId,
		game_type: GameType[gameType],
		format: GameFormat[formatType],
		result: message.result.toUpperCase(),
		region: bnetRegion,
		source: 'firestone',
		source_version: message.appVersion,
		duration_seconds: metadata?.game?.totalDurationSeconds,
		duration_turns: metadata?.game?.totalDurationTurns,
	};
	// debug && console.debug('sending to d0nkey', JSON.stringify(stats, null, 4));
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
		if (
			d0nkeyData?.player_deck?.name?.length > 0 &&
			!!message.playerRank?.length &&
			!!message.playerDecklist?.length &&
			!!message.replayKey?.length
		) {
			// if (
			// 	message.playerDecklist ===
			// 	'AAECAaoIBo31BcekBtTABvzABrrOBqXTBgzl5AX26AWQgwazjQbDjwaopwbrqQbWwAb2wAatxQbR0Abk6gYAAQPzswbHpAb2swbHpAbo3gbHpAYAAA=='
			// ) {
			// 	console.debug('swarm archetype 2', d0nkeyData);
			// }
			return d0nkeyData?.player_deck?.name;
			// debug && console.debug('sending to SNS', JSON.stringify(d0nkeyData, null, 4));
			// sqs.sendMessageToQueue(
			// 	{
			// 		...message,
			// 		archetype: d0nkeyData?.player_deck?.name,
			// 	},
			// 	process.env.ARCHETYPE_ASSIGNED_QUEUE,
			// );
			// sns.notify(
			// 	process.env.ARCHETYPE_ASSIGNED_TOPIC,
			// 	JSON.stringify({
			// 		...message,
			// 		archetype: d0nkeyData?.player_deck?.name,
			// 	}),
			// );
		}
	} catch (e) {
		console.error('Could not send request to d0nkey', stats, e.config);
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

interface D0nkeyData {
	player_deck: {
		// Name has XL and rune shorthands, archetype doesn't, ie XL Control Priest vs Control Priest
		name: string;
		archetype: string;
		deckcode: string;
	};
}
