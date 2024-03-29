import { ReviewMessage } from './review-message';
import { StatsBuilder } from './stats-builder';

// This example demonstrates a NodeJS 8.10 async handler[1], however of course you could use
// the more traditional callback-style handler.
// [1]: https://aws.amazon.com/blogs/compute/node-js-8-10-runtime-now-available-in-aws-lambda/
export default async (event): Promise<any> => {
	const messages: readonly ReviewMessage[] = (event.Records as any[])
		.map((event) => JSON.parse(event.body))
		.reduce((a, b) => a.concat(b), [])
		.map((body) => JSON.parse(body.Message));
	await new StatsBuilder().buildStats(messages, {
		vs: true,
	});
	return { statusCode: 200, body: 'ok' };
};
