/* eslint-disable no-extra-boolean-cast */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import {
	AllCardsService,
	BnetRegion,
	GameType,
	isBattlegrounds,
	isBattlegroundsDuo,
	normalizeHeroCardId,
} from '@firestone-hs/reference-data';
import { ReplayUploadMetadata } from '@firestone-hs/replay-metadata';
import axios from 'axios';
import { ReviewMessage } from '../review-message';

const environments = [
	{
		name: 'dev',
		battleTagsUrl: 'https://hilo-backend.azurewebsites.net/api/hearthstone-battlegrounds/firestone-battletags/',
		postUrl: 'https://hilo-backend.azurewebsites.net/api/hearthstone-battlegrounds/submit-game-data/',
		battleTags: [],
		lastRefresh: null,
	},
	{
		name: 'prod',
		battleTagsUrl: 'https://hilo-production.azurewebsites.net/api/hearthstone-battlegrounds/firestone-battletags/',
		postUrl: 'https://hilo-production.azurewebsites.net/api/hearthstone-battlegrounds/submit-game-data/',
		battleTags: [],
		lastRefresh: null,
	},
];

const BATTLE_TAG_REFRESH_INTERVAL = 1000 * 60 * 10; // 10 minutes

export const toHilo = async (
	message: ReviewMessage,
	metadata: ReplayUploadMetadata,
	replay: Replay,
	allCards: AllCardsService,
): Promise<string> => {
	const debug = message.userName === 'daedin';
	debug && console.debug('processing hilo?', message, metadata, replay);
	if (!message.allowGameShare) {
		return;
	}

	const gameType = getGameType(message.gameMode);
	if (!isBattlegrounds(gameType) || isBattlegroundsDuo(gameType)) {
		debug && console.debug('not correct type', gameType);
		return;
	}
	if (!message.additionalResult || isNaN(+message.additionalResult)) {
		debug && console.debug('not correct additionalResult', message.additionalResult);
		return;
	}

	const allBattleTags = environments.flatMap((env) => env.battleTags);
	if (!allBattleTags.includes(message.playerName)) {
		return;
	}

	const playerIdentifier = message.playerName;
	const placement = +message.additionalResult;
	const startingMmr = +metadata.game.playerRank;
	const mmrGained = +metadata.game.newPlayerRank - startingMmr;
	const gameDurationInSeconds = metadata.game.totalDurationSeconds;
	const gameEndDate = message.creationDate;
	const heroPlayed = normalizeHeroCardId(message.playerCardId, allCards);
	const heroName = allCards.getCard(heroPlayed).name;
	const triplesCreated = metadata.bgs.postMatchStats?.tripleTimings.length;
	const battleLuck = metadata.bgs.postMatchStats?.luckFactor;
	const server = BnetRegion[metadata.meta.region];

	// Find last turn
	const lastTurn =
		metadata.bgs.postMatchStats?.boardHistory[metadata.bgs.postMatchStats.boardHistory.length - 1]?.turn ?? 0;
	const finalBoard =
		metadata.bgs.postMatchStats?.boardHistory[metadata.bgs.postMatchStats.boardHistory.length - 1]?.board ?? [];
	const turnInfos = [];
	for (let i = 1; i <= lastTurn; i++) {
		const faceOff = metadata.bgs.postMatchStats.faceOffs.find((f) => f.turn === i);
		const simulationData = metadata.bgs.postMatchStats.battleResultHistory.find((b) => b.turn === i);
		const turnInfo = {
			turn: i,
			heroDamage:
				faceOff == null
					? null
					: faceOff.result === 'tied'
					? 0
					: faceOff.result === 'won'
					? faceOff.damage
					: -faceOff.damage,
			winOdds: simulationData?.simulationResult?.wonPercent,
			tieOdds: simulationData?.simulationResult?.tiedPercent,
			lossOdds: simulationData?.simulationResult?.lostPercent,
			averageDamageTaken: simulationData?.simulationResult?.averageDamageLost,
			averageDamageDealt: simulationData?.simulationResult?.averageDamageWon,
		};
		turnInfos.push(turnInfo);
	}

	const data = {
		playerIdentifier: playerIdentifier,
		placement: placement,
		startingMmr: startingMmr,
		mmrGained: mmrGained,
		gameDurationInSeconds: gameDurationInSeconds,
		gameEndDate: gameEndDate,
		heroPlayed: heroPlayed,
		heroPlayedName: heroName,
		triplesCreated: triplesCreated,
		battleLuck: battleLuck,
		server: server,
		turns: turnInfos,
		finalComp: {
			board: finalBoard,
			turn: lastTurn,
		},
	};
	console.debug('sending to hilo', JSON.stringify(data, null, 4));

	for (const env of environments) {
		if (!env.battleTags.includes(message.playerName)) {
			continue;
		}

		try {
			const reply = await axios.post(env.postUrl, data);
			console.debug('sent request to hilo', env.name, reply?.status, reply?.statusText, reply?.data);
		} catch (e) {
			console.error('Could not send request to hilo', e.message, e);
		}
	}
};

const getGameType = (gameMode: string): GameType => {
	switch (gameMode) {
		case 'arena':
			return GameType.GT_ARENA;
		case 'battlegrounds':
			return GameType.GT_BATTLEGROUNDS;
		case 'casual':
			return GameType.GT_CASUAL;
		case 'friendly':
			return GameType.GT_VS_FRIEND;
		case 'practice':
			return GameType.GT_VS_AI;
		case 'ranked':
			return GameType.GT_RANKED;
		case 'tavern-brawl':
		case 'tavernbrawl':
			return GameType.GT_TAVERNBRAWL;
		default:
			return GameType.GT_UNKNOWN;
	}
};

export const refresHiloBattleTags = async () => {
	const now = Date.now();
	for (const env of environments) {
		if (env.lastRefresh && now - env.lastRefresh < BATTLE_TAG_REFRESH_INTERVAL) {
			continue;
		}
		try {
			env.lastRefresh = now;
			const reply = await axios.get(env.battleTagsUrl);
			env.battleTags = reply.data?.battletags ?? [];
			console.debug('refreshed battle tags', env.name, env.battleTags.length);
		} catch (e) {
			console.error('Could not refresh battle tags', e.message, e);
		}
	}
};
