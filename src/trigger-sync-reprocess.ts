/* eslint-disable @typescript-eslint/no-use-before-define */
import { Sns } from '@firestone-hs/aws-lambda-utils';
import { GetSecretValueRequest } from 'aws-sdk/clients/secretsmanager';
import { Connection, createPool } from 'mysql';
import { SecretInfo, getSecret } from './db/rds';

const sns = new Sns();

const startId = 527631235;
const end__Id = 529734273;
const buildNumber = 195635;

// This example demonstrates a NodeJS 8.10 async handler[1], however of course you could use
// the more traditional callback-style handler.
// [1]: https://aws.amazon.com/blogs/compute/node-js-8-10-runtime-now-available-in-aws-lambda/
export default async (event): Promise<any> => {
	const secretRequest: GetSecretValueRequest = {
		SecretId: 'rds-connection',
	};
	const secret: SecretInfo = await getSecret(secretRequest);
	const pool = createPool({
		connectionLimit: 1,
		host: secret.hostReadOnly,
		user: secret.username,
		password: secret.password,
		database: 'replay_summary',
		port: secret.port,
	});

	try {
		await performRowProcessIngPool(pool);
	} finally {
		pool.end((err) => {
			console.log('ending pool', err);
		});
	}

	console.log('done');

	return { statusCode: 200, body: 'ok' };
};

const performRowProcessIngPool = async (pool: any) => {
	return new Promise<void>((resolve) => {
		pool.getConnection(async (err, connection) => {
			if (err) {
				console.log('error with connection', err);
				throw new Error('Could not connect to DB');
			} else {
				await performRowsProcessing(connection);
				connection.release();
			}
			resolve();
		});
	});
};

const performRowsProcessing = async (connection: Connection) => {
	return new Promise<void>((resolve) => {
		const queryString = `
			SELECT * FROM replay_summary
			where gameMode = 'ranked'
			and playerRank is not null
			and id >= ${startId}
			and id < ${end__Id}
			and buildNumber >= ${buildNumber}
			order by id asc;
		`;
		console.log('running query', queryString);
		const query = connection.query(queryString);

		let rowsToProcess = [];
		let rowCount = 0;
		query
			.on('error', (err) => {
				console.error('error while fetching rows', err);
			})
			.on('fields', (fields) => {
				console.log('fields', fields);
			})
			.on('result', async (row) => {
				// console.log('row', row.reviewId);
				rowsToProcess.push(row);
				if (rowsToProcess.length > 200) {
					connection.pause();
					const toUpload = rowsToProcess;
					rowsToProcess = [];
					await Promise.all(
						toUpload.map((reviewToNotify) =>
							sns.notify(process.env.REVIEW_REPUBLISHED_TOPIC, JSON.stringify(reviewToNotify)),
						),
					);
					rowCount += toUpload.length;
					console.log(
						'processed rows',
						process.env.REVIEW_REPUBLISHED_TOPIC,
						toUpload.length,
						rowCount,
						toUpload[toUpload.length - 1].id,
					);
					connection.resume();
				}
			})
			.on('end', async () => {
				console.log('end');
				resolve();
			});
	});
};

// const chunk = (array, size) =>
// 	array.reduce((acc, _, i) => {
// 		if (i % size === 0) {
// 			acc.push(array.slice(i, i + size));
// 		}
// 		return acc;
// 	}, []);
