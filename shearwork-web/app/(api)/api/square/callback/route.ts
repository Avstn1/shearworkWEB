// app/api/square/callback/route.ts
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

export async function GET(request: Request) {
	const cookieStore = await cookies()
	const url = new URL(request.url)

	const code = url.searchParams.get("code")
	const state = url.searchParams.get("state")
	const error = url.searchParams.get("error")
	const errorDescription = url.searchParams.get("error_description")

	if (error) {
		return NextResponse.json({ error, errorDescription }, { status: 400 })
	}
	if (!code || !state) {
		return NextResponse.json({ error: "Missing code/state" }, { status: 400 })
	}

	const savedRaw = cookieStore.get("square_oauth_state")?.value
	if (!savedRaw) {
		return NextResponse.json({ error: "Missing state cookie" }, { status: 400 })
	}

	let saved: {
		state: string
		user_id: string
		code_verifier: string
		is_mobile?: boolean
	}
	try {
		saved = JSON.parse(savedRaw)
	} catch {
		return NextResponse.json({ error: "Invalid state cookie format" }, { status: 400 })
	}

	if (saved.state !== state) {
		return NextResponse.json({ error: "Invalid state parameter" }, { status: 400 })
	}

	const squareEnv = process.env.SQUARE_ENV || "production"
	const tokenBase =
		squareEnv === "production"
			? "https://connect.squareup.com"
			: "https://connect.squareupsandbox.com"

	// ✅ PKCE token exchange (NO client_secret)
	const redirectUrl =
		process.env.SQUARE_REDIRECT_URL ||
		process.env.REDIRECT_URL ||
		process.env.redirect_url ||
		new URL("/api/square/callback", url.origin).toString()

	const tokenRes = await fetch(`${tokenBase}/oauth2/token`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			// Optional but recommended:
			"Square-Version": "2024-06-04",
		},
		body: JSON.stringify({
			client_id: process.env.SQUARE_APPLICATION_ID,
			grant_type: "authorization_code",
			code,
			code_verifier: saved.code_verifier,
			redirect_uri: redirectUrl,
		}),
	})

	const tokenData = await tokenRes.json()

	if (!tokenRes.ok) {
		return NextResponse.json({ error: "Token exchange failed", details: tokenData }, { status: 400 })
	}

	// Save tokens to Supabase
	const supabaseAdmin = createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,       // ✅ fixes your supabaseUrl required
		process.env.SUPABASE_SERVICE_ROLE_KEY!
	)

	const expiresAt = tokenData.expires_at
		? new Date(tokenData.expires_at).toISOString()
		: tokenData.expires_in
			? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
			: null

	await supabaseAdmin.from("square_tokens").upsert({
		user_id: saved.user_id,
		access_token: tokenData.access_token,
		refresh_token: tokenData.refresh_token,
		expires_in: expiresAt,
		merchant_id: tokenData.merchant_id,
		updated_at: new Date().toISOString(),
	})

	cookieStore.delete("square_oauth_state")

	if (saved.is_mobile) {
		return new NextResponse(
			`<!doctype html><html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">
        <div><h1 style="color:#22c55e">✓ Square Connected</h1><p>You can close this tab.</p></div>
      </body></html>`,
			{ headers: { "Content-Type": "text/html" } }
		)
	}

	return NextResponse.redirect(new URL("/dashboard", process.env.NEXT_PUBLIC_SITE_URL!))
}

