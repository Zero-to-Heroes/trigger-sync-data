import { MatchAnalysis, ReplayUploadMetadata } from '@firestone-hs/replay-metadata';
import serverlessMysql from 'serverless-mysql';
import { ReviewMessage } from '../review-message';
import { allCards } from '../stats-builder';

const deckstringArchetypeCache: { [deckstring: string]: number } = {};

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
			opponentHeroCardId
		)
		VALUES
		(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`;
	const isLegend = message.playerRank?.includes('legend');
	const playerRank = isLegend
		? parseInt(message.playerRank.split('legend-')[1])
		: buildNumericalRankValue(message.playerRank);
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
	]);

	const decklistForArchetypes = normalizedDecklist.replaceAll('/', '-');
	if (archetypeId > 0 && !deckstringArchetypeCache[decklistForArchetypes]) {
		// Also add a decklist/archetype mapping
		const deckArchetypeQuery = `
			INSERT IGNORE INTO constructed_deck_archetype
			(
				deckstring,
				archetypeId
			)
			VALUES
			(?, ?)
		`;
		await mysql.query(deckArchetypeQuery, [decklistForArchetypes, archetypeId]);
		deckstringArchetypeCache[decklistForArchetypes] = archetypeId;
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
