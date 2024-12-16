import { ReplayUploadMetadata } from '@firestone-hs/replay-metadata';
import serverlessMysql, { ServerlessMysql } from 'serverless-mysql';
import { ReviewMessage } from '../review-message';
import { addConstructedMatchStat } from './constructed-match-stat';

const knownArchetypesCache: { [archetype: string]: { id: number; lastUpdate: Date } } = {};
const cacheDuration = 1000 * 60 * 60 * 12;

export const assignArchetype = async (
	mysql: ServerlessMysql,
	archetype: string,
	metadata: ReplayUploadMetadata,
	message: ReviewMessage,
): Promise<void> => {
	const start = Date.now();
	const debug = false;
	// message.playerDecklist ===
	// 'AAECAaoIBo31BcekBtTABvzABrrOBqXTBgzl5AX26AWQgwazjQbDjwaopwbrqQbWwAb2wAatxQbR0Abk6gYAAQPzswbHpAb2swbHpAbo3gbHpAYAAA==';
	const archetypeName = slugify(archetype);
	debug && console.debug('assigning archetype', archetypeName, message.playerDecklist);
	const archetypeId = await insertArchetype(mysql, archetypeName, debug);
	debug && console.debug('inserted archetype', archetypeId);
	await addConstructedMatchStat(mysql, message, metadata, archetypeId);
};

const insertArchetype = async (
	mysql: serverlessMysql.ServerlessMysql,
	archetypeName: string,
	debug = false,
): Promise<number> => {
	if (knownArchetypesCache[archetypeName]) {
		debug && console.debug('using cached archetype?', archetypeName, knownArchetypesCache[archetypeName]);
		const lastUpdate = knownArchetypesCache[archetypeName].lastUpdate;
		if (!!lastUpdate && new Date().getTime() - lastUpdate.getTime() < cacheDuration) {
			return knownArchetypesCache[archetypeName].id;
		}
	}

	const selectQuery = `
	    SELECT id FROM constructed_archetypes WHERE archetype = ?
	`;
	const selectResult: any = await mysql.query(selectQuery, [archetypeName]);
	debug && console.debug('selected archetype', archetypeName, selectResult);
	if (selectResult?.[0]?.id > 0) {
		return selectResult[0].id;
	}

	const insertQuery = `
        INSERT INTO constructed_archetypes (archetype)
        VALUES (?)
        ON DUPLICATE KEY UPDATE archetype = VALUES(archetype)
    `;
	debug && console.debug('inserting archetype', insertQuery);
	const result: any = await mysql.query(insertQuery, [archetypeName]);
	debug && console.debug('inserted archetype', archetypeName, result.insertId, result);
	// console.debug('inserted archetype', archetypeName, result.insertId);
	if (result.insertId > 0) {
		knownArchetypesCache[archetypeName] = { id: result.insertId, lastUpdate: new Date() };
		return result.insertId;
	}

	return null;
};

const slugify = (name: string): string => {
	return name
		.toLowerCase()
		.replace(/ /g, '-')
		.replace(/'/g, '')
		.replace(/\./g, '')
		.replace(/\(/g, '')
		.replace(/\)/g, '')
		.replace(/:/g, '')
		.replace(/!/g, '')
		.replace(/,/g, '')
		.replace(/;/g, '')
		.replace(/"/g, '')
		.replace(/’/g, '')
		.replace(/&/g, '')
		.replace(/%/g, '')
		.replace(/@/g, '')
		.replace(/#/g, '')
		.replace(/\+/g, '')
		.replace(/`/g, '')
		.replace(/’/g, '');
};
