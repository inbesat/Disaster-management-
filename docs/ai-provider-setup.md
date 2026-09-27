# SafeSphere AI provider setup

The chat API reads these **server-side** variables in priority order:

1. `GROQ_API_KEY`
2. `GROQ_API_KEY_BACKUP`
3. `OPENROUTER_API_KEY`
4. `OPENROUTER_API_KEY_BACKUP`
5. `BLUESMINDS_API_KEY`

Local development uses `.env.local`; its values are already configured in this workspace. Do not prefix these names with `NEXT_PUBLIC_` or commit their values.

For the deployed Netlify site, add the same variables under **Project configuration → Environment variables**, with **Functions** scope where scope selection is available. A new deploy is required after changing them. A local `.env.local` file and `netlify.toml` variables do not supply secrets to deployed functions.

Run `npx tsx scripts/check-ai-providers.ts` locally to test the keys. It prints provider names and status only. In SafeSphere, **Settings → AI → Test Connection** uses the same probe once a demo government or responder session is active.

If a provider is down, chat falls back to the next working key. If the server has no usable key, chat now reports the missing deployment configuration rather than implying the user's question failed.
