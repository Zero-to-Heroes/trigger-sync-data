/* eslint-disable no-extra-boolean-cast */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { parseHsReplayString, Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { AllCardsService } from '@firestone-hs/reference-data';
import { ReplayUploadMetadata } from '@firestone-hs/replay-metadata';
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
		const start = Date.now();
		if (message.userId === 'OW_e9585b6b-4468-4455-9768-9fe91b05faed' || message.userName === 'daedin') {
			console.debug('processing', message.reviewId, message);
		}

		if (!['ranked'].includes(message.gameMode)) {
			return;
		}
		if (!message.allowGameShare) {
			return;
		}

		const metadata = await loadMetaDataFile(message.metadataKey);
		let replay: Replay = null;
		if (metadata == null) {
			try {
				const replayString = await this.loadReplayString(message.replayKey);
				replay = parseHsReplayString(replayString, allCards);
			} catch (e) {
				console.error('Could not parse replay', e.message, message.reviewId);
				return;
			}
		}

		const targets = [];
		if (!config || config.vs) {
			targets.push(toViciousSyndicate(message, metadata, replay));
		}
		if (!config || config.d0nkey) {
			targets.push(toD0nkey(message, metadata, replay));
		}
		await Promise.all(targets);
		if (metadata != null) {
			console.debug('processed in', Date.now() - start, 'ms', message.reviewId);
		}
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

const loadMetaDataFile = async (fileKey: string): Promise<ReplayUploadMetadata | null> => {
	const replayString = await s3.readZippedContent('com.zerotoheroes.batch', fileKey);
	let fullMetaData: ReplayUploadMetadata | null = null;
	if (replayString?.startsWith('{')) {
		const metadataStr = replayString;
		if (!!metadataStr?.length) {
			console.debug('got metadata');
			fullMetaData = JSON.parse(metadataStr);
		}
	}
	return fullMetaData;
};
