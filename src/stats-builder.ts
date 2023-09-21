/* eslint-disable @typescript-eslint/no-use-before-define */
import { parseHsReplayString, Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { AllCardsService } from '@firestone-hs/reference-data';
import { S3 } from './db/s3';
import { toD0nkey } from './extractor/d0kney';
import { extractViciousSyndicateStats as toViciousSyndicate } from './extractor/vs';
import { ReviewMessage } from './review-message';

const s3 = new S3();
export const allCards = new AllCardsService();

export class StatsBuilder {
	public async buildStats(
		messages: readonly ReviewMessage[],
		config: {
			vs?: boolean;
			d0nkey?: boolean;
		} = null,
	): Promise<void> {
		await allCards.initializeCardsDb();
		await Promise.all(messages.map((msg) => this.buildStat(msg, config)));
	}

	private async buildStat(
		message: ReviewMessage,
		config: {
			vs?: boolean;
			d0nkey?: boolean;
		} = null,
	): Promise<void> {
		if (!['ranked'].includes(message.gameMode)) {
			return;
		}

		// if (parseInt(message.buildNumber) > 139719) {
		// 	return;
		// }

		// const prefs: Preferences = await this.loadPrefs(message.userId);
		const replayString = await this.loadReplayString(message.replayKey);
		if (!replayString || replayString.length === 0) {
			return null;
		}
		const replay: Replay = parseHsReplayString(replayString, allCards);
		const targets = [];
		if (!config || config.vs) {
			targets.push(toViciousSyndicate(message, replay, replayString));
		}
		if (!config || config.d0nkey) {
			targets.push(toD0nkey(message, replay, replayString));
		}
		await Promise.all(targets);
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
}
