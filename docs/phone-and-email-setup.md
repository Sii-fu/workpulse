# Phone page and evening email: setup and first-deployment checklist

WorkPulse can show today's tasks and logs on your phone, take tasks you type on the phone, and email you a
summary of the day. All of it runs inside your own Google Sheet's script (Google Apps Script). Nothing new
runs on a server of ours, and WorkPulse itself stays on one computer.

You need the Google Sheet you already sync logs to, with its script. A phone and an email address
(your Google address) are all else.

## One-time setup

1. Open WorkPulse, then **Settings > Google Sheet**. Open **Set up the sheet: Apps Script code** and press **Copy code**.
2. Open the Sheet. Choose **Extensions > Apps Script**. Delete the old code, paste the new script and save.
3. Update the deployment you already have, so the link stays the same:
   **Deploy > Manage deployments**, press the pencil on your existing deployment, set **Version** to
   **New version**, press **Deploy**. Do not choose **New deployment**: it makes a new address and WorkPulse
   would stop reaching the Sheet. (First time ever? Follow the steps at the top of the script instead.)
4. Google asks for permission again. Allow all of it: the Sheet, sending email to you, and running a daily timer.
   (If a screen says the app is not verified, choose Advanced and continue; it is your own script.)
5. Back in WorkPulse, **Settings > Phone & evening email**. The section should say the script is version 3.
   If it says an older version, the paste or the new version in step 3 did not take; repeat them.
6. Press **Set PIN** and type a 4-digit PIN twice. WorkPulse keeps only a token for this computer, never the PIN.
7. Choose the time for the evening email (from 00:30 to 23:29), tick **Send me an evening email**, press **Save**, then
   **Send a test email**.
8. Open the **phone link** shown there on your phone (it is your Sheet's `/exec` address with `?page=phone`),
   type the PIN once, then add the page to the home screen (Share > Add to Home Screen on iPhone; the menu >
   Add to Home screen on Android). Keep the link private: anyone with the link and the PIN can read your tasks.

Notes:

- **Set the PIN straight after deploying.** If no PIN was ever set, anyone who has the link can set the first one.
- Use this on **one computer only**. If a second computer also sends data, the section warns about it.
- Five wrong PINs in a row lock the phone page for 15 minutes (each further wrong PIN locks it again).
  **Change PIN** in Settings, which this computer can do without the old PIN, sets a new PIN and clears the lock.
  **Reset phone access** is for a computer that has lost its access: it asks for the current PIN and a new one.
- Updating WorkPulse's script in future (a new version of the app may bring a new script): paste it again and update
  the same deployment (step 3). The change only takes effect after that new version is deployed.
- The Sheet gains tabs (`WorkPulse_Tasks`, `WorkPulse_Days`, `WorkPulse_Recent`, `WorkPulse_Inbox`,
  `WorkPulse_Projects`). `WorkPulse_Logs` is unchanged. Do not edit the new tabs; WorkPulse rewrites them.

## Manual checklist for the first real deployment

The automated tests use fakes for Google. Do these once against the real Sheet, and tick them off.

1. **Version.** WorkPulse Settings > Phone & evening email says script version 3 (or open the `/exec` link with
   `?action=ping`; it answers `"version":3`).
2. **Same URL.** After step 3 above the link in WorkPulse still works with no change. (Editing the existing
   deployment keeps the URL; **New deployment** would not.)
3. **Phone page opens.** `<your /exec link>?page=phone` shows the PIN keypad. A wrong PIN says so and counts the
   tries left; the right PIN opens the tasks.
4. **Phone to desktop.** Add a task on the phone (Add tab). Within about a minute it appears in WorkPulse with
   "from phone", and only once, even after you reload WorkPulse.
5. **Desktop to phone.** After WorkPulse has sent its data (a few seconds after a change, the status line in
   Settings shows the time), the phone shows today's tasks and today's logs.
6. **Test email.** **Send a test email** arrives from your own Google address, at your own address.
7. **Trigger.** In the Apps Script editor, **Triggers** (the clock icon) lists one daily time-based trigger for
   `sendEveningEmail`. It fires within about 15 minutes of the chosen time, and the email arrives once per day.
8. **Quiet day.** On a day with no logs and no clock-in nothing is sent.
9. **A task titled `=1+1`.** Add a phone task with exactly that title. In the Sheet (`WorkPulse_Inbox` and then
   `WorkPulse_Tasks`) and in WorkPulse it stays the text `=1+1`; it is never calculated.
10. **Times round-trip.** The Time cells of `WorkPulse_Logs` in the Asia/Dhaka zone show up with the right time in
    the phone page's logs under **Show earlier days** (Sheets can store them as dates).
11. **Time zone check.** In the script editor, run `Utilities.formatDate(new Date(), 'Not/AZone', 'yyyy-MM-dd')`
    in a scratch function: it should throw. The script relies on that to reject a bad time zone.
12. **Google's script runner on the phone.** `google.script.run` works from the phone page that opens without a
    Google sign-in, and the remembered PIN survives a page reload on iPhone Safari and on Android Chrome. This is
    best effort: if a browser forgets the PIN, typing it each time is acceptable.

## Offline tests

These need no Google account and no dev server (except the smoke test, which starts its own).

- `npm test`: unit tests, including the Apps Script run in a Node harness with fake Sheet, lock, mail and trigger
  services (`src/test/appsScriptHarness.ts`).
- `npm run lint` and `npm run build`.
- `npm run test:smoke`: browser smoke test of the desktop app. The Sheet is stubbed; the run fails if a request
  would reach a real `script.google.com` host.
- `python tests/smoke/phone_page.py <screenshot dir>`: opens the phone page in Chromium at 390 px, with
  `google.script.run` replaced by a stub, and saves screenshots to the folder you name. On Windows set
  `PYTHONIOENCODING=utf-8` first so the console prints the middle dot.
