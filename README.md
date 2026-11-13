# LAAGANAN

Hiking and nature spots app (website + Android APK). Hosted on GitHub Pages, data in Supabase (free plan).

## Setup (about 30 to 45 minutes)

### 1. Supabase project
1. Go to https://supabase.com, sign in, and create a new project (free plan). Save the database password somewhere safe.
2. **Authentication > Sign In / Providers**: turn on **Allow anonymous sign-ins**.
3. **SQL Editor**: open `supabase/setup.sql`, paste the whole file, and click **Run**.
4. **Project Settings > API**: copy the **Project URL** and the **anon (publishable) key**.
5. Paste both into `www/supabase-shim.js` (`SUPABASE_URL` and `SUPABASE_ANON_KEY`). The anon key is meant to be public; the permissions in `setup.sql` protect your data.

### 2. Put it on GitHub and publish the website
1. Create a new GitHub repository and upload this whole folder (branch `main`).
2. Repository **Settings > Pages > Source: GitHub Actions**.
3. The **Deploy web** workflow publishes `www/` to `https://YOURNAME.github.io/REPO/`.

### 3. Make yourself admin
1. Open your website on the device you will use as admin, with `?whoami` added to the address, for example `https://YOURNAME.github.io/REPO/?whoami`. A box shows your user ID.
2. In Supabase **SQL Editor** run:
   `insert into public.admin_config (uid) values ('PASTE-YOUR-USER-ID-HERE');`
3. Reload the app on that device, go to Profile > Sign in with username `AdminRaver` and password `12345` (created on first use). Change the password and set a security question straight away in Admin > Settings.

### 4. Build the APK
1. Repository **Actions > Build APK > Run workflow** (it also runs on every push).
2. When it finishes, open the run and download the **laaganan-apk** artifact (a zip containing `app-debug.apk`).
3. Copy the APK to your phone, allow installing from unknown sources, install, and allow location and camera. Use the app on the same phone you used for step 3 to be admin there.

### 5. Optional: keep the free project awake
Supabase free projects pause after about a week of no activity. Add two repository secrets, `SUPABASE_URL` and `SUPABASE_ANON_KEY` (Settings > Secrets and variables > Actions). The **Keep Supabase active** workflow then touches the database twice a week. GitHub may switch off scheduled workflows after 60 days without repository activity, so check it occasionally.

## Known limits of this version
- Accounts are tied to the device or browser (anonymous sign-in). A second phone starts with no account. Supabase email and password sign-in can replace this later.
- The in-app password check runs inside the app. For real security move sign-in to Supabase Auth.
- The database starts empty. Add spots, categories and LGU contacts from the Admin page.
- Weather forecasts are stored data. Hourly updates need a scheduled job (for example a Supabase Edge Function).
- The APK is a debug build for testing. Publishing on Google Play needs a signed release build.
