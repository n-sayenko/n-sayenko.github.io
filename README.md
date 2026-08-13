# nataliyasayenko.com

Vite + React + [Radix Themes](https://www.radix-ui.com/). Three pages, plus an
art feed that syncs itself from a Google Drive folder.

```
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
```

| Path | |
|---|---|
| `index.html`, `art/index.html`, `projects/index.html` | page entries (real files, no client router) |
| `src/pages/` | `Home`, `Art`, `Projects` |
| `src/components/Canvas.jsx` | the dithered portrait |
| `public/gallery/` | synced images + `manifest.json` |
| `public/gallery/captions.json` | hand-written captions (see below) |
| `scripts/sync-art.mjs` | the Drive sync |

## The art feed

Save a photo into the Google Drive folder. Within the hour it's on the site.

**The filename is the caption.** Long-press → Rename in the Drive app:
`IMG_4821.HEIC` → `a study in blue, light through the kitchen window.heic`.
Files still named `IMG_1234` / `PXL_...` / `Screenshot...` get no caption
rather than a meaningless one.

For anything longer than a filename comfortably holds, edit
`public/gallery/captions.json` (GitHub's web editor works fine):

```json
{
  "a-study-in-blue-a1b2c3d4.jpg": "oil on board, 2026. the light only does this for about twenty minutes."
}
```

The key is the generated filename — copy it from `manifest.json`. Captions
here always win, and the sync never overwrites this file.

Deleting from Drive removes it from the site.

### Editing projects

`src/pages/Projects.jsx` — one object per project in the `PROJECTS` array.
Drop `todo: true` once real copy is in, and set `href` to link it.

## Setup (once)

**1. Service account.** In [Google Cloud Console](https://console.cloud.google.com):
new project → enable the **Google Drive API** → *Credentials* → create a
**service account** → *Keys* → *Add key* → **JSON**. Download it.

**2. Share the folder.** Share the Drive folder with the service account's
`client_email` (from the JSON) — **Viewer** is enough. For `GDRIVE_FOLDER_ID`
you can paste either the bare id or the whole URL from the address bar; the
script pulls the id out of `.../folders/<id>` either way.

**3. Check it works** before trusting the automation:

```bash
GDRIVE_FOLDER_ID=... \
GDRIVE_SERVICE_ACCOUNT_JSON="$(cat ~/Downloads/key.json)" \
node scripts/gdrive-check.mjs
```

It prints every file it can see and how each filename will be read as a
caption.

**4. Repo secrets.** *Settings → Secrets and variables → Actions*:
`GDRIVE_SERVICE_ACCOUNT_JSON` (the whole JSON file) and `GDRIVE_FOLDER_ID`.

**5. Switch Pages to Actions.** *Settings → Pages → Source* → **GitHub
Actions**. This repo used to deploy from the `master` branch; it now builds
first, so the old branch source would serve raw source files instead of the
built site.

A service account key doesn't expire. Nothing here needs re-authorising later.

## Things worth knowing

- **Scheduled workflows are disabled after 60 days of repo inactivity.** If the
  feed quietly stops updating, that's the first thing to check — GitHub emails
  you, and re-enabling is one button. You can always force a run from
  *Actions → Sync art from Drive → Run workflow*.
- GitHub's cron is best-effort; "hourly" can drift 5–20 minutes.
- HEIC is converted to JPEG during sync, because no browser can display HEIC.
  Originals stay in Drive; only web-sized copies (2000px) and thumbnails
  (600px) go in the repo.
- The sync refuses to delete everything if Drive returns an empty listing, and
  refuses to delete more than half the gallery at once. If you genuinely
  cleared the folder, run the workflow manually with **allow bulk delete**
  ticked.
- The Radix Themes stylesheet is ~684 kB (~82 kB gzipped) — most of the page
  weight, and the price of the component library.
