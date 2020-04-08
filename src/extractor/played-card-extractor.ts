/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser';
import { GameTag, Zone } from '@firestone-hs/reference-data';
import { Element } from 'elementtree';
import { ReviewMessage } from '../review-message';

const validZones = [Zone.PLAY, Zone.GRAVEYARD, Zone.REMOVEDFROMGAME, Zone.SETASIDE];

export const extractPlayedCards = (replay: Replay, message: ReviewMessage, playerId: number): string[] => {
	// const playerCardId: string = extractPlayerCardId(replay, playerId);
	const idControllerMapping = buildIdToControllerMapping(replay);
	// console.log('idControllerMapping', idControllerMapping);
	const entitiesWithCards = replay.replay.findall(`.//*[@cardID]`).filter(entity => isEntityValid(entity));

	// Because cards can change controllers during the game, we need to only consider the
	// first time we see them
	const uniqueEntities = [];
	for (const entity of entitiesWithCards) {
		// Don't add duplicate entities
		if (uniqueEntities.map(entity => getId(entity)).indexOf(getId(entity)) !== -1) {
			continue;
		}
		// Only add cards
		uniqueEntities.push(entity);
	}

	const validZoneChangeTags = replay.replay
		.findall(`.//TagChange[@tag='${GameTag.ZONE}']`)
		.filter(tag => validZones.indexOf(parseInt(tag.get('value'))) !== -1);
	const entityIdsWithValidZoneChanges = validZoneChangeTags.map(tagChange => parseInt(tagChange.get('entity')));

	const validEntities = uniqueEntities.filter(
		entity =>
			validZones.indexOf(getId(entity)) !== -1 || entityIdsWithValidZoneChanges.indexOf(getId(entity)) !== -1,
	);

	const playerEntities: Element[] = validEntities.filter(
		entity => idControllerMapping[getId(entity)] && idControllerMapping[getId(entity)] === playerId,
	);
	const playedCards = playerEntities.map(entity => getCardId(entity));
	console.log('playedCards', playedCards);
	return playedCards;
};

const getCardId = (entity: Element): string => {
	for (const mappedCards of mappedCardIds) {
		const mappedCardId = mappedCards[0];
		if (mappedCardId === entity.get('cardID')) {
			return mappedCards[1];
		}
	}
	return entity.get('cardID');
};

const getId = (entity: Element): number => {
	return parseInt(entity.get('id') || entity.get('entity'));
};

const isEntityValid = (entity: Element): boolean => {
	return (
		(!entity.find(`.Tag[@tag='${GameTag.TOPDECK}']`) ||
			entity.find(`.Tag[@tag='${GameTag.TOPDECK}']`).get('value') === '0') &&
		(!entity.find(`.Tag[@tag='${GameTag.REVEALED}']`) ||
			entity.find(`.Tag[@tag='${GameTag.REVEALED}']`).get('value') === '0') &&
		(!entity.find(`.Tag[@tag='${GameTag.CREATOR}']`) ||
			entity.find(`.Tag[@tag='${GameTag.CREATOR}']`).get('value') === '0') &&
		(!entity.find(`.Tag[@tag='${GameTag.CREATOR_DBID}']`) ||
			entity.find(`.Tag[@tag='${GameTag.CREATOR_DBID}']`).get('value') === '0') &&
		(!entity.find(`.Tag[@tag='${GameTag.TRANSFORMED_FROM_CARD}']`) ||
			entity.find(`.Tag[@tag='${GameTag.TRANSFORMED_FROM_CARD}']`).get('value') === '0')
	);
};

const buildIdToControllerMapping = (replay: Replay): any => {
	const idControllerMapping = {};
	for (const entity of replay.replay.findall('.//FullEntity')) {
		// Only consider cards that start in the deck
		if (parseInt(entity.find(`.Tag[@tag='${GameTag.ZONE}']`).get('value')) !== Zone.DECK) {
			continue;
		}
		const controllerId = parseInt(entity.find(`.Tag[@tag='${GameTag.CONTROLLER}']`).get('value'));
		if (idControllerMapping[getId(entity)]) {
			continue;
		}
		idControllerMapping[getId(entity)] = controllerId;
	}
	return idControllerMapping;
};

// const extractPlayerCardId = (replay: Replay, playerId: number): string => {
// 	const heroEntityId = parseInt(
// 		replay.replay
// 			.findall(`.//Player`)
// 			.find(player => parseInt(player.get('playerID')) === playerId)
// 			.find(`Tag[@tag='${GameTag.HERO_ENTITY}']`)
// 			.get('value'),
// 	);
// 	return replay.replay.find(`.//FullEntity[@id='${heroEntityId}']`).get('cardID');
// };

const mappedCardIds = [
	// The upgraded version of spellstones should never start in deck
	['LOOT_103t1', 'LOOT_103'],
	['LOOT_103t2', 'LOOT_103'],
	['LOOT_043t2', 'LOOT_043'],
	['LOOT_043t3', 'LOOT_043'],
	['LOOT_051t1', 'LOOT_051'],
	['LOOT_051t2', 'LOOT_051'],
	['LOOT_064t1', 'LOOT_064'],
	['LOOT_064t2', 'LOOT_064'],
	['LOOT_080t2', 'LOOT_080'],
	['LOOT_080t3', 'LOOT_080'],
	['LOOT_091t1', 'LOOT_091'],
	['LOOT_091t2', 'LOOT_091'],
	['LOOT_203t2', 'LOOT_203'],
	['LOOT_203t3', 'LOOT_203'],
	['LOOT_503t', 'LOOT_503'],
	['LOOT_503t2', 'LOOT_503'],
	['LOOT_507t', 'LOOT_507'],
	['LOOT_507t2', 'LOOT_507'],
	['FB_Champs_LOOT_080t2', 'FB_Champs_LOOT_080'],
	['FB_Champs_LOOT_080t3', 'FB_Champs_LOOT_080'],
	// The "unidentified" spells
	['LOOT_278t1', 'LOOT_278'],
	['LOOT_278t2', 'LOOT_278'],
	['LOOT_278t3', 'LOOT_278'],
	['LOOT_278t4', 'LOOT_278'],
	['LOOT_285t', 'LOOT_285'],
	['LOOT_285t2', 'LOOT_285'],
	['LOOT_285t3', 'LOOT_285'],
	['LOOT_285t4', 'LOOT_285'],
	['LOOT_286t1', 'LOOT_286'],
	['LOOT_286t2', 'LOOT_286'],
	['LOOT_286t3', 'LOOT_286'],
	['LOOT_286t4', 'LOOT_286'],
	['DAL_366t1', 'DAL_366'],
	['DAL_366t2', 'DAL_366'],
	['DAL_366t3', 'DAL_366'],
	['DAL_366t4', 'DAL_366'],
];
