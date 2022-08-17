/* eslint-disable @typescript-eslint/no-use-before-define */
import { getConnection } from './db/rds';
import { Sns } from './sns';

const sns = new Sns();

// This example demonstrates a NodeJS 8.10 async handler[1], however of course you could use
// the more traditional callback-style handler.
// [1]: https://aws.amazon.com/blogs/compute/node-js-8-10-runtime-now-available-in-aws-lambda/
export default async (event): Promise<any> => {
	const mysql = await getConnection();
	const startId = 240399767;
	const endId = 240700497;
	const query = `
		SELECT * FROM replay_summary
		where gameMode = 'ranked'
		and playerRank is not null
		and id > ${startId}
		and id < ${endId}
		and buildNumber = 145077
		order by id asc;
	`;
	console.log('query', query);
	const results: any[] = await mysql.query(query);
	console.log('results', results.length);
	await mysql.end();

	const chunks = chunk(results, 200);
	for (const chunk of chunks) {
		// console.log('sending chunk');
		await Promise.all(chunk.map(reviewToNotify => sns.notifySyncReprocess(reviewToNotify)));
	}

	return { statusCode: 200, body: 'ok' };
};

const chunk = (array, size) =>
	array.reduce((acc, _, i) => {
		if (i % size === 0) {
			acc.push(array.slice(i, i + size));
		}
		return acc;
	}, []);
