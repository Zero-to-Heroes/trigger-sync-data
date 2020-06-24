/* eslint-disable @typescript-eslint/no-use-before-define */
import { parseHsReplayString, Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { S3 } from './db/s3';
import { buildJsonEvents } from './extractor/json-events/kda';
import { extractViciousSyndicateStats } from './extractor/vs';
import { ReviewMessage } from './review-message';

const s3 = new S3();

export class StatsBuilder {
	public async buildStats(messages: readonly ReviewMessage[]): Promise<void> {
		await Promise.all(messages.map(msg => this.buildStat(msg)));
	}

	private async buildStat(message: ReviewMessage): Promise<void> {
		console.log('processing message', message);
		// console.log('building stat for', message.reviewId, message.replayKey);
		const replayString = await this.loadReplayString(message.replayKey);
		// const replayString = testXml;
		if (!replayString || replayString.length === 0) {
			console.log('empty replay, returning');
			return null;
		}
		console.log('loaded replay string', replayString.length);
		const replay: Replay = parseHsReplayString(replayString);
		// console.log('parsed replay', JSON.stringify(replay, null, 4));
		await Promise.all([
			extractViciousSyndicateStats(message, replay, replayString),
			buildJsonEvents(message, replay, replayString),
		]);
	}

	private async loadReplayString(replayKey: string): Promise<string> {
		const data = replayKey.endsWith('.zip')
			? await s3.readZippedContent('xml.firestoneapp.com', replayKey)
			: await s3.readContentAsString('xml.firestoneapp.com', replayKey);
		// const data = await http(`http://xml.firestoneapp.com/${replayKey}`);
		return data;
	}
}
