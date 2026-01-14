import { Client, Environment } from 'square'

export function getSquareEnvironment() {
	return process.env.SQUARE_ENV === 'production'
		? Environment.Production
		: Environment.Sandbox
}

export function createSquareClient(accessToken?: string) {
	return new Client({
		environment: getSquareEnvironment(),
		accessToken,
		userAgentDetail: 'shearwork-web',
	})
}
