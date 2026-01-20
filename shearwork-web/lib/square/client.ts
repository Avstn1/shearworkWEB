import { SquareClient, SquareEnvironment } from 'square'

export function getSquareEnvironment() {
	return process.env.SQUARE_ENV === 'production'
		? SquareEnvironment.Production
		: SquareEnvironment.Sandbox
}

export function createSquareClient(accessToken?: string) {
	return new SquareClient({
		environment: getSquareEnvironment(),
		token: accessToken,
		headers: {
			'Square-Version': process.env.SQUARE_VERSION || '2025-10-16',
		},
	})
}
