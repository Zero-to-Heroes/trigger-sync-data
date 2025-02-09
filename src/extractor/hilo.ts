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

// const secretRequest: GetSecretValueRequest = {
// 	SecretId: 'hilo',
// };
// let secret: SecretInfo;

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

	const battleTags = [
		'Lii#11987',
		'Daedin#2991',
		'HurryMyCurry#1399',
		'HapaBear#1923',
		'funkyluan#1276',
		'HapaIsTilted#1545',
		'Bartellini#2728',
	];
	if (!battleTags.includes(message.playerName)) {
		debug && console.debug('not correct user', message.playerName);
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

	try {
		// secret = secret ?? (await getSecret(secretRequest));
		// TODO: retrieve the archetype as return of the call
		const reply = await axios.post(
			'https://hilo-backend.azurewebsites.net/api/hearthstone-battlegrounds/submit-game-data/',
			data,
			{
				// auth: {
				// 	username: secret.username,
				// 	password: secret.password,
				// },
			},
		);
		console.debug('sent request to hilo', reply, reply?.status, reply?.statusText, reply?.data);
	} catch (e) {
		console.error('Could not send request to hilo', e.message, e);
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
