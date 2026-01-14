// app/api/square/connect/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import crypto from "crypto"
import { getAuthenticatedUser } from "@/utils/api-auth"

const SCOPES = [
	"MERCHANT_PROFILE_READ",
	"CUSTOMERS_READ",
	"EMPLOYEES_READ",
	"ORDERS_READ",
	"ITEMS_READ",
	"PAYMENTS_READ",
	"APPOINTMENTS_READ",
]

function base64Url(buf: Buffer) {
	return buf
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "")
}

export async function GET(request: Request) {
	const { user } = await getAuthenticatedUser(request)
	if (!user) {
		return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL))
	}

	const url = new URL(request.url)
	const isMobile = url.searchParams.get("mobile") === "true"

	const squareEnv = process.env.SQUARE_ENV || "production"
	const authBase =
		squareEnv === "production"
			? "https://connect.squareup.com"
			: "https://connect.squareupsandbox.com"

	// PKCE values
	const state = crypto.randomUUID()
	const codeVerifier = base64Url(crypto.randomBytes(32))
	const codeChallenge = base64Url(crypto.createHash("sha256").update(codeVerifier).digest())

	// Store state + verifier + user_id in httpOnly cookie (like your Acuity flow)
	const cookieStore = await cookies()
	cookieStore.set(
		"square_oauth_state",
		JSON.stringify({
			state,
			user_id: user.id,
			code_verifier: codeVerifier,
			is_mobile: isMobile,
		}),
		{
			httpOnly: true,
			secure: false, // localhost. set true on https deployments
			sameSite: "lax",
			maxAge: 600,
			path: "/",
		}
	)

	const params = new URLSearchParams({
		client_id: process.env.SQUARE_APPLICATION_ID!,
		response_type: "code",
		scope: SCOPES.join(" "),
		session: "false",
		state,
		// PKCE
		code_challenge: codeChallenge,
		code_challenge_method: "S256",
		// PKCE redirect_uri is allowed/expected (and avoids mismatch issues)
		redirect_uri: process.env.SQUARE_REDIRECT_URL!,
	})

	return NextResponse.redirect(`${authBase}/oauth2/authorize?${params.toString()}`)
}

