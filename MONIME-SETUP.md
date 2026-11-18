# Paid verified badge (Le 30 / 30 days) - setup

1. Supabase -> SQL Editor: run `verify-pay.sql` (and `requests.sql` if not done).
2. Install the Supabase CLI, then in this repo:
   ```
   supabase link --project-ref YOUR_PROJECT_REF
   supabase secrets set MONIME_ACCESS_TOKEN=<your Monime access token> MONIME_SPACE_ID=<your Space ID> SITE_URL=https://sl-connect.vercel.app WEBHOOK_SECRET=<any long random text>
   supabase functions deploy verify-checkout
   supabase functions deploy verify-payment
   supabase functions deploy verify-webhook --no-verify-jwt
   ```
   Keep the token ONLY in Supabase secrets. Never paste it into code, GitHub or chat.
3. In the Monime dashboard add a webhook to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/verify-webhook` with header `x-webhook-secret: <same WEBHOOK_SECRET>`.
4. Test with one real Le 30 payment: More -> Requests -> Get verified -> Pay. Check the badge appears.
   If the amount or status looks wrong, tell Claude: the minor-unit multiplier (x100) and the "paid" status words in `supabase/functions/_shared/payments.ts` are unconfirmed.
