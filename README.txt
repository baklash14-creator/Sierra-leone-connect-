SL CONNECT APP - how to put it online (free)

1. Go to https://app.netlify.com/drop  (or use GitHub Pages / Vercel / Cloudflare Pages)
2. Drag this whole folder onto the page. You get an https:// link.
3. Open the link on a phone:
   - Android Chrome: tap "Install app" (or the menu, then Install app)
   - iPhone Safari: tap Share, then "Add to Home Screen"
   The app now opens full screen with its own icon.

FILES: index.html (page), style.css (design), config.js (your settings), app.js (logic), sw.js + manifest.json (app install/offline).

Edit config.js:
   CONTACT_PHONE, CONTACT_EMAIL  - your real contact details
   FOUNDER_EMAIL  - the founder's sign-up email (unlocks the Change photo button)
   FOUNDER_PHOTO  - put founder.jpg in this folder and set FOUNDER_PHOTO="founder.jpg"

The app needs https to install and work offline. Accounts and posts are still saved
only on each phone until a backend (database + login server) is added.


CLOUD BACKEND: see SETUP-BACKEND.txt and schema.sql (in the backend-setup folder).
backend.js = the code that talks to Supabase. Fill SUPABASE_URL and SUPABASE_ANON_KEY in config.js to switch it on.
