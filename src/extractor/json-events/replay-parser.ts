/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser';
import { BlockType, CardIds, CardType, GameTag, Race, Step, Zone } from '@firestone-hs/reference-data';
import { Element } from 'elementtree';
import { EventEmitter } from 'events';
import { ParsingStructure } from './parsing-structure';

export class ReplayParser extends EventEmitter {
	constructor(private readonly replay: Replay) {
		super();
	}

	public parse() {
		const opponentPlayerElement = this.replay.replay
			.findall('.//Player')
			.find(player => player.get('isMainPlayer') === 'false');
		const opponentPlayerEntityId = opponentPlayerElement.get('id');
		// console.log('mainPlayerEntityId', opponentPlayerEntityId);
		const structure: ParsingStructure = {
			currentTurn: 0,
			// boardOverTurn: Map.of(),
			// rerollOverTurn: Map.of(),
			// minionsSoldOverTurn: Map.of(),
			// hpOverTurn: {},
			// leaderboardPositionOverTurn: {},
			// totalStatsOverTurn: Map.of(),
			entities: {},
			// rerollsForTurn: 0,
			// rerollsIds: [],
			// playerHps: {},
			// leaderboardPositions: {},
			// minionsSoldForTurn: 0,
			// minionsSoldIds: [],
			// minionsDamageDealt: {},
			// minionsDamageReceived: {},
		};

		const playerEntities = this.replay.replay
			.findall(`.//FullEntity`)
			.filter(fullEntity => fullEntity.find(`.Tag[@tag='${GameTag.CARDTYPE}'][@value='${CardType.HERO}']`))
			.filter(fullEntity => {
				const controllerId = parseInt(fullEntity.find(`.Tag[@tag='${GameTag.CONTROLLER}']`).get('value'));
				return controllerId === this.replay.mainPlayerId || controllerId === this.replay.opponentPlayerId;
			})
			.filter(
				fullEntity =>
					['TB_BaconShop_HERO_PH', 'TB_BaconShop_HERO_KelThuzad', 'TB_BaconShopBob'].indexOf(
						fullEntity.get('cardID'),
					) === -1,
			);
		// const playerCardIds: readonly string[] = [
		// 	...new Set(playerEntities.map(entity => entity.get('cardID'))),
		// ] as readonly string[];
		// for (const playerCardId of playerCardIds) {
		// 	structure.playerHps[playerCardId] = playerCardId === 'TB_BaconShop_HERO_34' ? 50 : 40;
		// }

		parseElement(
			this.replay.replay.getroot(),
			this.replay.mainPlayerId,
			opponentPlayerEntityId,
			null,
			{ currentTurn: 0 },
			[
				compositionForTurnParse(structure),
				// rerollsForTurnParse(structure),
				// minionsSoldForTurnParse(structure),
				// hpForTurnParse(structure, playerEntities),
				// leaderboardForTurnParse(structure, playerEntities),
				// damageDealtByMinionsParse(structure, this.replay),
				this.handleBattleResult(structure, playerEntities),
			],
			[this.compositionForTurnPopulate(structure)],
		);
	}

	private handleBattleResult(structure: ParsingStructure, playerEntities: readonly Element[]) {
		return element => {
			if (
				element.tag === 'Block' &&
				parseInt(element.get('type')) === BlockType.TRIGGER &&
				parseInt(element.get('effectIndex')) === 4
			) {
				// console.log(
				// 	'playerEntities',
				// 	playerEntities.map(entity => entity.get('id')),
				// 	element.get('entity'),
				// );
				const entityCardId = structure.entities[element.get('entity')].cardId;
				if (entityCardId !== 'TB_BaconShop_8P_PlayerE') {
					return;
				}
				const attackAction: Element = element.find(`.//Block[@type='${BlockType.ATTACK}']`);
				if (!attackAction) {
					console.warn('empty attack action not handled yet');
				} else {
					const winner = structure.entities[attackAction.get('entity')];
					const result = winner.controller === this.replay.mainPlayerId ? 'won' : 'lost';
					const attacker = attackAction.find(`.//TagChange[@tag='${GameTag.ATTACKING}'][@value='1']`);
					// console.log('handling attack action', attacker, attackAction.attrib);
					const attackerEntityId = attacker.get('entity');
					const defenderEntityId = attackAction
						.find(`.//TagChange[@tag='${GameTag.DEFENDING}'][@value='1']`)
						.get('entity');
					// console.log('attackerEntityId', 'defenderEntityId', attackerEntityId, defenderEntityId);
					const playerEntityId =
						structure.entities[attackerEntityId].controller === this.replay.mainPlayerId
							? attackerEntityId
							: defenderEntityId;
					const playerCardId = structure.entities[playerEntityId].cardId;
					const opponentEntityId =
						structure.entities[attackerEntityId].controller === this.replay.mainPlayerId
							? defenderEntityId
							: attackerEntityId;
					const opponentCardId = structure.entities[opponentEntityId].cardId;

					this.emit('bgsBattleResult', {
						player: playerCardId,
						opponent: opponentCardId,
						result: result,
						time: toTimestamp(element.get('ts')),
					});
				}
			}
		};
	}

	private compositionForTurnPopulate = (structure: ParsingStructure) => {
		return (currentTurn: number, turnChangeElement: Element) => {
			if (currentTurn === 0) {
				return;
			}
			// console.log('battle start', currentTurn, turnChangeElement);
			const playerEntitiesOnBoard = Object.values(structure.entities)
				// .map(entity => entity as any)
				.filter(entity => entity.controller === this.replay.mainPlayerId)
				.filter(entity => entity.zone === Zone.PLAY)
				.filter(entity => entity.cardType === CardType.MINION)
				.map(entity => ({
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
				.map(entity => entity as any)
				.filter(entity => entity.controller !== this.replay.mainPlayerId)
				.filter(entity => entity.zone === Zone.PLAY)
				.filter(entity => entity.cardType === CardType.MINION)
				.map(entity => ({
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
			this.emit('bgsBattleStart', {
				playerBoard: playerEntitiesOnBoard,
				opponentBoard: opponentEntitiesOnBoard,
				time: toTimestamp(turnChangeElement.get('ts')),
			});
		};
	};
}

const hasCleave = (cardId: string): boolean => {
	return [CardIds.Collectible.Hunter.CaveHydra, CardIds.Collectible.Neutral.FoeReaper4000].indexOf(cardId) !== -1;
};

const hasWindfury = (cardId: string): boolean => {
	return !hasMegaWindfury(cardId) && [CardIds.NonCollectible.Neutral.ZappSlywick].indexOf(cardId) !== -1;
};

const hasMegaWindfury = (cardId: string): boolean => {
	return [CardIds.NonCollectible.Neutral.ZappSlywickTavernBrawl].indexOf(cardId) !== -1;
};

const toTimestamp = (ts: string): Date => {
	const result = new Date();
	const split = ts.split(':');
	let hoursFromXml = parseInt(split[0]);
	if (hoursFromXml >= 24) {
		result.setDate(result.getDate() + 1);
		hoursFromXml -= 24;
	}
	result.setHours(hoursFromXml);
	result.setMinutes(parseInt(split[1]));
	result.setSeconds(parseInt(split[2].split('.')[0]));
	const milliseconds = parseInt(split[2].split('.')[1]) / 1000;
	result.setMilliseconds(milliseconds);
	return result;
};

// const hpForTurnParse = (structure: ParsingStructure, playerEntities: readonly Element[]) => {
// 	return element => {
// 		if (
// 			element.tag === 'TagChange' &&
// 			parseInt(element.get('value')) > 0 &&
// 			parseInt(element.get('tag')) === GameTag.DAMAGE &&
// 			playerEntities.map(entity => entity.get('id')).indexOf(element.get('entity')) !== -1
// 		) {
// 			const playerCardId = playerEntities
// 				.find(entity => entity.get('id') === element.get('entity'))
// 				.get('cardID');
// 			structure.playerHps[playerCardId] =
// 				// Patchwerk is a special case
// 				Math.max(0, (playerCardId === 'TB_BaconShop_HERO_34' ? 50 : 40) - parseInt(element.get('value')));
// 		}
// 	};
// };

// const leaderboardForTurnParse = (structure: ParsingStructure, playerEntities: readonly Element[]) => {
// 	return element => {
// 		if (
// 			element.tag === 'TagChange' &&
// 			parseInt(element.get('tag')) === GameTag.PLAYER_LEADERBOARD_PLACE &&
// 			playerEntities.map(entity => entity.get('id').indexOf(element.get('entity')) !== -1)
// 		) {
// 			const playerCardId = playerEntities
// 				.find(entity => entity.get('id') === element.get('entity'))
// 				.get('cardID');
// 			structure.leaderboardPositions[playerCardId] = parseInt(element.get('value'));
// 		}
// 	};
// };

// const rerollsForTurnParse = (structure: ParsingStructure) => {
// 	return element => {
// 		if (element.tag === 'FullEntity' && element.get('cardID') === 'TB_BaconShop_8p_Reroll_Button') {
// 			structure.rerollsIds = [...structure.rerollsIds, element.get('id')];
// 		}
// 		if (
// 			element.tag === 'Block' &&
// 			parseInt(element.get('type')) === BlockType.POWER &&
// 			structure.rerollsIds.indexOf(element.get('entity')) !== -1 &&
// 			element.findall('.FullEntity').length > 0
// 		) {
// 			// console.log('adding one reroll', structure.rerollsForTurn, element);
// 			structure.rerollsForTurn = structure.rerollsForTurn + 1;
// 		}
// 	};
// };

// const minionsSoldForTurnParse = (structure: ParsingStructure) => {
// 	return element => {
// 		if (element.tag === 'FullEntity' && element.get('cardID') === 'TB_BaconShop_DragSell') {
// 			structure.minionsSoldIds = [...structure.minionsSoldIds, element.get('id')];
// 		}
// 		if (
// 			element.tag === 'Block' &&
// 			parseInt(element.get('type')) === BlockType.POWER &&
// 			structure.minionsSoldIds.indexOf(element.get('entity')) !== -1
// 		) {
// 			// console.log('adding one reroll', structure.rerollsForTurn, element);
// 			structure.minionsSoldForTurn = structure.minionsSoldForTurn + 1;
// 		}
// 	};
// };

// const damageDealtByMinionsParse = (structure: ParsingStructure, replay: Replay) => {
// 	return (element: Element) => {
// 		// For now we only consider damage in attacks / powers, which should cover most cases
// 		if (element.tag?.toString() === 'Block') {
// 			// console.log('handling block', element.tag, element.get('type'), element.get('entity'));
// 			const actionEntity = structure.entities[element.get('entity')];
// 			if (!actionEntity) {
// 				// console.warn('could not find entity', element.get('entity'));
// 				return;
// 			}
// 			const damageTags = element.findall(`.//MetaData[@meta='${MetaTags.DAMAGE}']`);
// 			// If it's an attack, the attacker deals to the def, and vice versa
// 			if ([BlockType.ATTACK].indexOf(parseInt(element.get('type'))) !== -1) {
// 				// const debug = element.get('entity') === '6205';
// 				// console.log('handling attack', element.get('entity'), '6205', damageTags.length);
// 				const attackerEntityId = element.find(`.//TagChange[@tag='${GameTag.ATTACKING}']`)?.get('entity');
// 				const defenderEntityId = element.find(`.//TagChange[@tag='${GameTag.DEFENDING}']`)?.get('entity');
// 				damageTags.forEach(tag => {
// 					const infos = tag.findall(`.Info`);
// 					// if (debug) {
// 					// 	// console.log('handling damage tag', tag);
// 					// }
// 					infos.forEach(info => {
// 						// if (debug) {
// 						// 	// console.log('handling info', info);
// 						// }
// 						const damagedEntity = structure.entities[info.get('entity')];
// 						// if (info.get('entity') === '6205') {
// 						// 	console.log(
// 						// 		'damage in attack',
// 						// 		info.get('entity'),
// 						// 		element.get('entity'),
// 						// 		damagedEntity.controller,
// 						// 		replay.mainPlayerId,
// 						// 		actionEntity.controller,
// 						// 		damagedEntity,
// 						// 		info,
// 						// 	);
// 						// }
// 						// We are damaged, so add the info
// 						if (damagedEntity.controller === replay.mainPlayerId) {
// 							// if (debug) {
// 							// 	console.log(
// 							// 		'damage dealt to us',
// 							// 		damagedEntity.cardId,
// 							// 		structure.minionsDamageReceived[damagedEntity.cardId],
// 							// 		parseInt(tag.get('data')),
// 							// 	);
// 							// }
// 							structure.minionsDamageReceived[damagedEntity.cardId] =
// 								(structure.minionsDamageReceived[damagedEntity.cardId] || 0) +
// 								parseInt(tag.get('data'));
// 						}
// 						// We are not damaged, so the Info represents the opponent's entity
// 						// First case, we attack so we add the damage to our count
// 						else if (actionEntity.controller === replay.mainPlayerId) {
// 							// if (debug) {
// 							// 	console.log(
// 							// 		'damage dealt by us while we attack',
// 							// 		actionEntity.cardId,
// 							// 		structure.minionsDamageDealt[actionEntity.cardId],
// 							// 		parseInt(tag.get('data')),
// 							// 	);
// 							// }
// 							structure.minionsDamageDealt[actionEntity.cardId] =
// 								(structure.minionsDamageDealt[actionEntity.cardId] || 0) + parseInt(tag.get('data'));
// 						}
// 						// Second case, we are attacked so we need to find out who did the damage to the enemy
// 						else {
// 							const defenderEntity = structure.entities[defenderEntityId];
// 							// if (debug) {
// 							// 	console.log(
// 							// 		'damage dealt by us while we are attacked',
// 							// 		defenderEntity.cardId,
// 							// 		structure.minionsDamageDealt[defenderEntityId],
// 							// 		parseInt(tag.get('data')),
// 							// 	);
// 							// }
// 							structure.minionsDamageDealt[defenderEntity.cardId] =
// 								(structure.minionsDamageDealt[defenderEntity.cardId] || 0) + parseInt(tag.get('data'));
// 						}
// 					});
// 				});
// 			}
// 			// Otherwise, it goes one way
// 			else {
// 				// We do the damage
// 				if (actionEntity.controller === replay.mainPlayerId && actionEntity.cardType === CardType.MINION) {
// 					const newDamage = damageTags.map(tag => parseInt(tag.get('data'))).reduce((a, b) => a + b, 0);
// 					structure.minionsDamageDealt[actionEntity.cardId] =
// 						(structure.minionsDamageDealt[actionEntity.cardId] || 0) + newDamage;
// 				}
// 				// Damage is done to us
// 				else if (actionEntity.controller !== replay.mainPlayerId && actionEntity.cardType === CardType.MINION) {
// 					damageTags.forEach(tag => {
// 						const infos = tag.findall(`.Info`);
// 						infos.forEach(info => {
// 							const damagedEntity = structure.entities[info.get('entity')];
// 							// if (damagedEntity.cardId === 'BGS_038') {
// 							// 	console.log('handling damage done to us', tag, element);
// 							// }
// 							if (
// 								damagedEntity.controller === replay.mainPlayerId &&
// 								damagedEntity.cardType === CardType.MINION
// 							) {
// 								structure.minionsDamageReceived[damagedEntity.cardId] =
// 									(structure.minionsDamageReceived[damagedEntity.cardId] || 0) +
// 									parseInt(tag.get('data'));
// 							}
// 						});
// 					});
// 				}
// 			}
// 		}
// 	};
// };

// While we don't use the metric, the entity info that is populated is useful for other extractors
const compositionForTurnParse = (structure: ParsingStructure) => {
	return element => {
		if (element.tag === 'FullEntity') {
			structure.entities[element.get('id')] = {
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
			};
		}
		if (structure.entities[element.get('entity')]) {
			if (parseInt(element.get('tag')) === GameTag.CONTROLLER) {
				structure.entities[element.get('entity')].controller = parseInt(element.get('value'));
			}
			if (parseInt(element.get('tag')) === GameTag.ZONE) {
				// console.log('entity', child.get('entity'), structure.entities[child.get('entity')]);
				structure.entities[element.get('entity')].zone = parseInt(element.get('value'));
			}
			if (parseInt(element.get('tag')) === GameTag.ZONE_POSITION) {
				// console.log('entity', child.get('entity'), structure.entities[child.get('entity')]);
				structure.entities[element.get('entity')].zonePosition = parseInt(element.get('value'));
			}
			if (parseInt(element.get('tag')) === GameTag.ATK) {
				// ATK.log('entity', child.get('entity'), structure.entities[child.get('entity')]);
				structure.entities[element.get('entity')].atk = parseInt(element.get('value'));
			}
			if (parseInt(element.get('tag')) === GameTag.HEALTH) {
				// console.log('entity', child.get('entity'), structure.entities[child.get('entity')]);
				structure.entities[element.get('entity')].health = parseInt(element.get('value'));
			}
			if (parseInt(element.get('tag')) === GameTag.DIVINE_SHIELD) {
				// console.log('entity', child.get('entity'), structure.entities[child.get('entity')]);
				structure.entities[element.get('entity')].divineShield = parseInt(element.get('value')) === 1;
			}
			if (parseInt(element.get('tag')) === GameTag.POISONOUS) {
				// console.log('entity', child.get('entity'), structure.entities[child.get('entity')]);
				structure.entities[element.get('entity')].poisonous = parseInt(element.get('value')) === 1;
			}
			if (parseInt(element.get('tag')) === GameTag.TAUNT) {
				// console.log('entity', child.get('entity'), structure.entities[child.get('entity')]);
				structure.entities[element.get('entity')].taunt = parseInt(element.get('value')) === 1;
			}
			if (parseInt(element.get('tag')) === GameTag.REBORN) {
				// console.log('entity', child.get('entity'), structure.entities[child.get('entity')]);
				structure.entities[element.get('entity')].reborn = parseInt(element.get('value')) === 1;
			}
		}
	};
};

const parseElement = (
	element: Element,
	mainPlayerId: number,
	opponentPlayerEntityId: string,
	parent: Element,
	turnCountWrapper,
	parseFunctions,
	populateFunctions,
) => {
	parseFunctions.forEach(parseFunction => parseFunction(element));
	if (element.tag === 'TagChange') {
		if (
			parseInt(element.get('tag')) === GameTag.NEXT_STEP &&
			parseInt(element.get('value')) === Step.MAIN_START_TRIGGERS
		) {
			// console.log('considering parent', parent.get('entity'), parent);
			if (parent && parent.get('entity') === opponentPlayerEntityId) {
				populateFunctions.forEach(populateFunction => populateFunction(turnCountWrapper.currentTurn, element));
				turnCountWrapper.currentTurn++;
			}
			// console.log('board for turn', structure.currentTurn, mainPlayerId, '\n', playerEntitiesOnBoard);
		}
	}

	const children = element.getchildren();
	if (children && children.length > 0) {
		for (const child of children) {
			parseElement(
				child,
				mainPlayerId,
				opponentPlayerEntityId,
				element,
				turnCountWrapper,
				parseFunctions,
				populateFunctions,
			);
		}
	}
};
