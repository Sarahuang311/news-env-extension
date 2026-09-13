# media-diet-browser-ext

Browser extension for the **[name redacted for peer review]**, a study on the connections between media consumption habits and political bias.

## What it does

The extension observes participants' browsing and delivers interventions during the course of the study. It is distributed to study participants and connects back to a study server for onboarding, data collection, and intervention logic.

Key components:
- `manifest.json` — Manifest V3 extension configuration
- `service_worker.js` — background service worker
- `registration.js`, `reconnect.js` — onboarding and reconnect flow with the study server
- `collectLinks.js`, `collectTweets.js` — page/content data collection
- `lightIntervention.js`, `heavyIntervention.js`, `twitterIntervention.js` — intervention logic shown to participants
- `popup.html` / `popup.js` / `popup.css` — extension popup UI

### Permissions

The extension requests broad host permissions (`<all_urls>`) plus `tabs` and `history`, which are necessary for observing media consumption across the web as part of the study protocol. All data collection is governed by the study's IRB-approved consent process.

## Installation (development / load unpacked)

1. Clone this repository.
2. In Chrome (or another Chromium-based browser), go to `chrome://extensions`.
3. Enable "Developer mode" (top right).
4. Click "Load unpacked" and select this repository's directory.

The backend server URL is configured in `config.js` (`SERVER_URL`); set it to your deployed study server or a local dev server (e.g. `http://localhost:8000`) as needed. Note that `manifest.json`'s host match patterns must be kept in sync with this value.

## Contributors

[Anonymized for peer review]

## License

This project is licensed under the MIT License - see the LICENSE file for details.
