import { MatchAnalysis, ReplayUploadMetadata } from '@firestone-hs/replay-metadata';
import serverlessMysql from 'serverless-mysql';
import { ReviewMessage } from '../review-message';
import { allCards } from '../stats-builder';

const deckstringArchetypeCache: { [deckstring: string]: { id: number; lastUpdate: Date } } = {};

export const addConstructedMatchStat = async (
	mysql: serverlessMysql.ServerlessMysql,
	message: ReviewMessage,
	metadata: ReplayUploadMetadata,
	archetypeId: number,
): Promise<ReplayUploadMetadata> => {
	const matchAnalysis: MatchAnalysis = metadata?.stats?.matchAnalysis;
	if (!matchAnalysis) {
		return metadata;
	}

	const normalizedDecklist =
		metadata?.game?.normalizedDeckstring ?? allCards.normalizeDeckList(message.playerDecklist);
	const insertQuery = `
		INSERT IGNORE INTO constructed_match_stats
		(
			creationDate,
			buildNumber,
			reviewId,
			format,
			isLegend,
			playerRank,
			playerClass,
			playerArchetypeId,
			opponentClass,
			opponentArchetypeId,
			result,
			playerDecklist,
			opponentDecklist,
			durationTurns,
			durationSeconds,
            matchAnalysis,
			playerHeroCardId,
			opponentHeroCardId,
			coinPlay
		)
		VALUES
		(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`;
	const isLegend = message.playerRank?.includes('legend');
	const playerRank = isLegend
		? parseInt(message.playerRank.split('legend-')[1])
		: buildNumericalRankValue(message.playerRank);
	const debug =
		message.playerDecklist ===
		'AAECAaoIBo31BcekBtTABvzABrrOBqXTBgzl5AX26AWQgwazjQbDjwaopwbrqQbWwAb2wAatxQbR0Abk6gYAAQPzswbHpAb2swbHpAbo3gbHpAYAAA==';
	// console.debug('trying to insert rank', playerRank, message.playerRank, message);
	const result = await mysql.query(insertQuery, [
		message.creationDate,
		message.buildNumber,
		message.reviewId,
		message.gameFormat,
		isLegend,
		playerRank,
		message.playerClass,
		archetypeId,
		message.opponentClass,
		null,
		message.result,
		normalizedDecklist,
		null,
		null,
		null,
		JSON.stringify(matchAnalysis),
		message.playerCardId,
		message.opponentCardId,
		message.coinPlay,
	]);

	const decklistForArchetypes = normalizedDecklist.replaceAll('/', '-');
	const cachedInfo = deckstringArchetypeCache[decklistForArchetypes];
	if (
		archetypeId > 0 &&
		(!cachedInfo || cachedInfo.lastUpdate.getTime() < new Date().getTime() - 10 * 60 * 60 * 1000)
	) {
		// Also add a decklist/archetype mapping
		const deckArchetypeQuery = `
			INSERT INTO constructed_deck_archetype
			(
				deckstring,
				archetypeId
			)
			VALUES (?, ?)
			ON DUPLICATE KEY UPDATE archetypeId = VALUES(archetypeId)    
		`;
		await mysql.query(deckArchetypeQuery, [decklistForArchetypes, archetypeId]);
		deckstringArchetypeCache[decklistForArchetypes] = { id: archetypeId, lastUpdate: new Date() };
	}

	return metadata;
};

// 1 is Diamond 1, 50 is bronze 10
const buildNumericalRankValue = (rank: string): number => {
	const [league, position] = rank.split('-');
	if (isNaN(parseInt(league)) || isNaN(parseInt(position))) {
		return null;
	}
	return 10 * (parseInt(league) - 1) + parseInt(position);
};
