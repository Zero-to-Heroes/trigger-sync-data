import { SNS } from 'aws-sdk';

export class Sns {
	private readonly sns: SNS;

	constructor() {
		this.sns = new SNS({ region: 'us-west-2' });
	}

	public async notifySyncReprocess(review: any) {
		const topic = 'arn:aws:sns:us-west-2:478062583808:review-republished';
		await this.sns
			.publish({
				Message: JSON.stringify(review),
				TopicArn: topic,
			})
			.promise();
	}
}
