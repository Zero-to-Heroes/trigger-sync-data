import { parseHsReplayString, Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { AllCardsService } from '@firestone-hs/reference-data';
import { JsonEvent } from '../src/extractor/json-events/json-event';
import { cardsInHand } from '../src/extractor/json-events/parsers/cards-in-hand-parser';
import { ReplayParser } from '../src/extractor/json-events/replay-parser';
import { replayString } from './replay.xml';

const runTest = async () => {
	const cards = new AllCardsService();
	await cards.initializeCardsDb();

	const replay: Replay = parseHsReplayString(replayString, cards);
	const parser = new ReplayParser(replay, [cardsInHand]);
	const events: JsonEvent[] = [];
	let cardsAfterMulligan: { cardId: string; kept: boolean }[] = [];
	let cardsBeforeMulligan: string[] = [];
	parser.on('cards-in-hand', (event) => {
		if (cardsBeforeMulligan?.length === 0) {
			cardsBeforeMulligan = event.cardsInHand;
		} else {
			cardsAfterMulligan = event.cardsInHand.map((cardId) => ({
				cardId: cardId,
				kept: cardsBeforeMulligan.includes(cardId),
			}));
		}
		// console.debug('getting event', event);
		// events.push({
		// 	name: 'cards-in-hand',
		// 	time: event.time,
		// 	turn: event.turn,
		// 	data: event.cardsInHand,
		// } as JsonEvent);
	});
	parser.parse();

	console.log(cardsAfterMulligan);
};

runTest();
