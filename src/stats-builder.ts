/* eslint-disable @typescript-eslint/no-use-before-define */
import { parseHsReplayString, Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { AllCardsService } from '@firestone-hs/reference-data';
import SqlString from 'sqlstring';
import { getConnection } from './db/rds';
import { S3 } from './db/s3';
import { toD0nkey } from './extractor/d0kney';
import { extractViciousSyndicateStats as toViciousSyndicate } from './extractor/vs';
import { Preferences } from './preferences';
import { ReviewMessage } from './review-message';

const s3 = new S3();
export const allCards = new AllCardsService();

export class StatsBuilder {
	public async buildStats(messages: readonly ReviewMessage[], verbose = false): Promise<void> {
		await allCards.initializeCardsDb();
		await Promise.all(messages.map((msg) => this.buildStat(msg, verbose)));
	}

	private async buildStat(message: ReviewMessage, verbose = false): Promise<void> {
		if (!['ranked'].includes(message.gameMode)) {
			return;
		}

		// if (parseInt(message.buildNumber) > 139719) {
		// 	return;
		// }

		if (verbose) {
			console.log('sync', message);
		}

		const prefs: Preferences = await this.loadPrefs(message.userId);
		const replayString = await this.loadReplayString(message.replayKey);
		if (!replayString || replayString.length === 0) {
			return null;
		}
		const replay: Replay = parseHsReplayString(replayString, allCards);
		await Promise.all([
			toViciousSyndicate(message, replay, replayString, prefs),
			toD0nkey(message, replay, replayString, prefs),
			// toKda(message, replay, replayString),
		]);
	}

	private async loadReplayString(replayKey: string): Promise<string> {
		if (!replayKey) {
			return null;
		}
		const data = replayKey.endsWith('.zip')
			? await s3.readZippedContent('xml.firestoneapp.com', replayKey)
			: await s3.readContentAsString('xml.firestoneapp.com', replayKey);
		// const data = await http(`http://xml.firestoneapp.com/${replayKey}`);
		return data;
	}

	private async loadPrefs(userId: string): Promise<Preferences> {
		const mysql = await getConnection();
		const query = `
			SELECT prefs, lastUpdateDate FROM user_prefs
			WHERE userId = ${SqlString.escape(userId)}
			ORDER BY lastUpdateDate DESC;
		`;
		// console.log('running query', query);
		const result: any[] = await mysql.query(query);
		// console.log('result', result);
		return result.length === 0
			? {
					shareGamesWithVS: true,
					d0nkeySync: true,
			  }
			: JSON.parse(result[0].prefs);
	}
}
