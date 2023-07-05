/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { CardIds, CardType, GameTag, Race, Zone } from '@firestone-hs/reference-data';
import { Element } from 'elementtree';
import { EventName } from '../json-event';
import { ParsingStructure } from '../parsing-structure';
import { toTimestamp } from './utils';

export const entities = {
	parser: (structure: ParsingStructure) => parser(structure),
	endOfTurn: (replay: Replay, structure: ParsingStructure, emitter: (eventName: EventName, event: any) => void) =>
		populate(replay, structure, emitter),
};

// While we don't use the metric, the entity info that is populated is useful for other extractors
const parser = (structure: ParsingStructure) => {
	return (element) => {
		if (element.tag === 'FullEntity') {
			structure.entities[element.get('id')] = {
				entityId: parseInt(element.get('id')),
				cardId: element.get('cardID'),
				controller: parseInt(element.find(`.Tag[@tag='${GameTag.CONTROLLER}']`)?.get('value') || '-1'),
				zone: parseInt(element.find(`.Tag[@tag='${GameTag.ZONE}']`)?.get('value') || '-1'),
				zonePosition: parseInt(element.find(`.Tag[@tag='${GameTag.ZONE_POSITION}']`)?.get('value') || '-1'),
				cardType: parseInt(element.find(`.Tag[@tag='${GameTag.CARDTYPE}']`)?.get('value') || '-1'),
				tribe: parseInt(element.find(`.Tag[@tag='${GameTag.CARDRACE}']`)?.get('value') || '-1'),
				atk: parseInt(element.find(`.Tag[@tag='${GameTag.ATK}']`)?.get('value') || '0'),
				health: parseInt(element.find(`.Tag[@tag='${GameTag.HEALTH}']`)?.get('value') || '0'),
				divineShield:
					parseInt(element.find(`.Tag[@tag='${GameTag.DIVINE_SHIELD}']`)?.get('value') || '0') === 1,
				poisonous: parseInt(element.find(`.Tag[@tag='${GameTag.POISONOUS}']`)?.get('value') || '0') === 1,
				taunt: parseInt(element.find(`.Tag[@tag='${GameTag.TAUNT}']`)?.get('value') || '0') === 1,
				reborn: parseInt(element.find(`.Tag[@tag='${GameTag.HEALTH}']`)?.get('value') || '0') === 1,
				creatorEntityId: parseInt(element.find(`.Tag[@tag='${GameTag.CREATOR}']`)?.get('value') || '0'),
			};
		}
		if (element.tag === 'ShowEntity') {
			structure.entities[element.get('entity')] = {
				entityId: parseInt(element.get('entity')),
				cardId: element.get('cardID'),
				controller: parseInt(element.find(`.Tag[@tag='${GameTag.CONTROLLER}']`)?.get('value') || '-1'),
				zone: parseInt(element.find(`.Tag[@tag='${GameTag.ZONE}']`)?.get('value') || '-1'),
				zonePosition: parseInt(element.find(`.Tag[@tag='${GameTag.ZONE_POSITION}']`)?.get('value') || '-1'),
				cardType: parseInt(element.find(`.Tag[@tag='${GameTag.CARDTYPE}']`)?.get('value') || '-1'),
				tribe: parseInt(element.find(`.Tag[@tag='${GameTag.CARDRACE}']`)?.get('value') || '-1'),
				atk: parseInt(element.find(`.Tag[@tag='${GameTag.ATK}']`)?.get('value') || '0'),
				health: parseInt(element.find(`.Tag[@tag='${GameTag.HEALTH}']`)?.get('value') || '0'),
				divineShield:
					parseInt(element.find(`.Tag[@tag='${GameTag.DIVINE_SHIELD}']`)?.get('value') || '0') === 1,
				poisonous: parseInt(element.find(`.Tag[@tag='${GameTag.POISONOUS}']`)?.get('value') || '0') === 1,
				taunt: parseInt(element.find(`.Tag[@tag='${GameTag.TAUNT}']`)?.get('value') || '0') === 1,
				reborn: parseInt(element.find(`.Tag[@tag='${GameTag.HEALTH}']`)?.get('value') || '0') === 1,
				creatorEntityId: parseInt(element.find(`.Tag[@tag='${GameTag.CREATOR}']`)?.get('value') || '0'),
			};
			if (element.get('id') == '17') {
				console.debug('show entity', element);
			}
		}
		if (structure.entities[element.get('entity')]) {
			if (parseInt(element.get('tag')) === GameTag.CONTROLLER) {
				structure.entities[element.get('entity')].controller = parseInt(element.get('value'));
			}
			if (parseInt(element.get('tag')) === GameTag.ZONE) {
				structure.entities[element.get('entity')].zone = parseInt(element.get('value'));
			}
			if (parseInt(element.get('tag')) === GameTag.ZONE_POSITION) {
				structure.entities[element.get('entity')].zonePosition = parseInt(element.get('value'));
			}
			if (parseInt(element.get('tag')) === GameTag.ATK) {
				// ATK.log('entity', child.get('entity'), structure.entities[child.get('entity')]);
				structure.entities[element.get('entity')].atk = parseInt(element.get('value'));
			}
			if (parseInt(element.get('tag')) === GameTag.HEALTH) {
				structure.entities[element.get('entity')].health = parseInt(element.get('value'));
			}
			if (parseInt(element.get('tag')) === GameTag.DIVINE_SHIELD) {
				structure.entities[element.get('entity')].divineShield = parseInt(element.get('value')) === 1;
			}
			if (parseInt(element.get('tag')) === GameTag.POISONOUS) {
				structure.entities[element.get('entity')].poisonous = parseInt(element.get('value')) === 1;
			}
			if (parseInt(element.get('tag')) === GameTag.TAUNT) {
				structure.entities[element.get('entity')].taunt = parseInt(element.get('value')) === 1;
			}
			if (parseInt(element.get('tag')) === GameTag.REBORN) {
				structure.entities[element.get('entity')].reborn = parseInt(element.get('value')) === 1;
			}
		}
	};
};

const populate = (replay: Replay, structure: ParsingStructure, emitter: (eventName: EventName, event: any) => void) => {
	return (currentTurn: number, turnChangeElement: Element) => {
		if (currentTurn === 0) {
			return;
		}
		const playerEntitiesOnBoard = Object.values(structure.entities)
			// .map(entity => entity as any)
			.filter((entity) => entity.controller === replay.mainPlayerId)
			.filter((entity) => entity.zone === Zone.PLAY)
			.filter((entity) => entity.cardType === CardType.MINION)
			.map((entity) => ({
				cardId: entity.cardId,
				tribe: entity.tribe === -1 ? Race[Race.BLANK] : Race[entity.tribe],
				attack: entity.atk,
				health: entity.health,
				divineShield: entity.divineShield,
				poisonous: entity.poisonous,
				taunt: entity.taunt,
				reborn: entity.reborn,
				cleave: hasCleave(entity.cardId),
				windfury: hasWindfury(entity.cardId),
				megaWindfury: hasMegaWindfury(entity.cardId),
			}));
		const opponentEntitiesOnBoard = Object.values(structure.entities)
			.map((entity) => entity as any)
			.filter((entity) => entity.controller !== replay.mainPlayerId)
			.filter((entity) => entity.zone === Zone.PLAY)
			.filter((entity) => entity.cardType === CardType.MINION)
			.map((entity) => ({
				cardId: entity.cardId,
				tribe: entity.tribe === -1 ? Race[Race.BLANK] : Race[entity.tribe],
				attack: entity.atk,
				health: entity.health,
				divineShield: entity.divineShield,
				poisonous: entity.poisonous,
				taunt: entity.taunt,
				reborn: entity.reborn,
				cleave: hasCleave(entity.cardId),
				windfury: hasWindfury(entity.cardId),
				megaWindfury: hasMegaWindfury(entity.cardId),
			}));
		// structure.boardOverTurn = structure.boardOverTurn.set(currentTurn, playerEntitiesOnBoard);
		emitter('bgsBattleStart', {
			playerBoard: playerEntitiesOnBoard,
			opponentBoard: opponentEntitiesOnBoard,
			time: toTimestamp(turnChangeElement.get('ts')),
		});
	};
};

const hasCleave = (cardId: string): boolean => {
	return (
		[
			CardIds.CaveHydra_BG_LOOT_078,
			CardIds.CaveHydraBattlegrounds,
			CardIds.FoeReaper4000_BG_GVG_113,
			CardIds.FoeReaper4000Battlegrounds,
		].indexOf(cardId as CardIds) !== -1
	);
};

const hasWindfury = (cardId: string): boolean => {
	return !hasMegaWindfury(cardId) && [CardIds.ZappSlywick].indexOf(cardId as CardIds) !== -1;
};

const hasMegaWindfury = (cardId: string): boolean => {
	return [CardIds.ZappSlywick, CardIds.ZappSlywickBattlegrounds].indexOf(cardId as CardIds) !== -1;
};
