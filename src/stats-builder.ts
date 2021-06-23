/* eslint-disable @typescript-eslint/no-use-before-define */
import { parseHsReplayString, Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { S3 } from './db/s3';
import { buildJsonEvents } from './extractor/json-events/kda';
import { extractViciousSyndicateStats } from './extractor/vs';
import { ReviewMessage } from './review-message';

const s3 = new S3();

export class StatsBuilder {
	public async buildStats(messages: readonly ReviewMessage[], verbose = false): Promise<void> {
		await Promise.all(messages.map(msg => this.buildStat(msg, verbose)));
	}

	private async buildStat(message: ReviewMessage, verbose = false): Promise<void> {
		if (verbose) {
			console.log('sync', message);
		}

		const replayString = await this.loadReplayString(message.replayKey);
		// const replayString = testXml;
		if (!replayString || replayString.length === 0) {
			return null;
		}
		const replay: Replay = parseHsReplayString(replayString);
		await Promise.all([
			extractViciousSyndicateStats(message, replay, replayString),
			buildJsonEvents(message, replay, replayString),
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
}
