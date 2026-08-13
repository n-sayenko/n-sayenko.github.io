#!/usr/bin/env node
/**
 * Mirrors a Google Drive folder into public/gallery/.
 *
 * For each image in the folder it writes a web-sized JPEG, a thumbnail, and
 * an entry in manifest.json. The description comes from the filename — rename
 * the file on your phone and that's the caption. Anything in captions.json
 * overrides it at render time; this script never touches that file.
 *
 * Idempotent: re-running with nothing changed in Drive writes nothing.
 *
 * Auth is a Google Cloud *service account* — a JWT signed with its private
 * key, exchanged for an access token. No OAuth consent dance, and nothing
 * that silently expires (an OAuth refresh token on an unpublished app dies
 * after 7 days; a service account key does not).
 *
 * Env: GDRIVE_SERVICE_ACCOUNT_JSON  the full service-account key JSON
 *      GDRIVE_FOLDER_ID             the folder's Drive ID
 *      ALLOW_BULK_DELETE=1          bypass the mass-deletion guard
 */

import { execFile } from "node:child_process";
import { createSign } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GALLERY = path.resolve("public/gallery");
const FULL_DIR = path.join(GALLERY, "full");
const THUMB_DIR = path.join(GALLERY, "thumb");
const MANIFEST = path.join(GALLERY, "manifest.json");

const FULL_MAX = 2000;
const THUMB_MAX = 600;
const QUALITY = 85;

const NEEDS_HEIF = new Set([".heic", ".heif"]);

// Filenames straight off a camera roll carry no meaning; better to show no
// caption than "IMG_4821".
const CAMERA_NOISE = [
  /^(img|image|photo|pxl|dsc|dscn|dji|screenshot|untitled)[-_ ]?[0-9-_ ()]*$/i,
  // bare UUIDs, which iOS uses when a photo is shared out of some apps
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  // anything with no letters at all, e.g. "2026-05-21 11.21.17"
  /^[^a-z]*$/i,
];

const { GDRIVE_SERVICE_ACCOUNT_JSON } = process.env;

/**
 * Accepts either a bare folder id or a pasted Drive URL such as
 * https://drive.google.com/drive/u/0/folders/<id> — copying the URL out of the
 * browser is the obvious thing to do, so don't make it an error.
 */
function normaliseFolderId(raw) {
  if (!raw) return raw;
  const value = raw.trim();
  const match = value.match(/\/folders\/([^/?#]+)/);
  if (match) return match[1];
  // also tolerate ...?id=<id> and open?id=<id> forms
  const query = value.match(/[?&]id=([^&#]+)/);
  if (query) return query[1];
  return value;
}

const GDRIVE_FOLDER_ID = normaliseFolderId(process.env.GDRIVE_FOLDER_ID);

// ----------------------------------------------------------------- google

const base64url = (input) =>
  Buffer.from(input).toString("base64url");

export async function getAccessToken() {
  if (!GDRIVE_SERVICE_ACCOUNT_JSON || !GDRIVE_FOLDER_ID) {
    throw new Error("Missing GDRIVE_SERVICE_ACCOUNT_JSON / GDRIVE_FOLDER_ID");
  }

  let key;
  try {
    key = JSON.parse(GDRIVE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error("GDRIVE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }
  if (!key.client_email || !key.private_key) {
    throw new Error("Service account JSON is missing client_email/private_key");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: key.client_email,
      // read-only: the sync can never modify or delete anything in Drive
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(key.private_key, "base64url");
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()).access_token;
}

export async function listFolder(token) {
  const files = [];
  let pageToken;

  do {
    const params = new URLSearchParams({
      q: `'${GDRIVE_FOLDER_ID}' in parents and trashed = false`,
      fields:
        "nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime, createdTime, imageMediaMetadata(time))",
      pageSize: "1000",
      orderBy: "createdTime desc",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      throw new Error(`Drive list failed: ${res.status} ${await res.text()}`);
    }

    const page = await res.json();
    files.push(...(page.files ?? []));
    // Pagination must be exhaustive: a silently truncated listing would look
    // like the user deleted everything past the first page.
    pageToken = page.nextPageToken;
  } while (pageToken);

  return files.filter((f) => (f.mimeType ?? "").startsWith("image/"));
}

async function download(token, fileId, destination) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new Error(
      `Drive download failed for ${fileId}: ${res.status} ${await res.text()}`,
    );
  }
  await writeFile(destination, Buffer.from(await res.arrayBuffer()));
}

// ---------------------------------------------------------------- imaging

let magickCmd = null;

async function resolveMagick() {
  if (magickCmd) return magickCmd;
  // ImageMagick 7 is `magick`; 6 is `convert`.
  try {
    await execFileAsync("magick", ["-version"]);
    magickCmd = "magick";
  } catch {
    magickCmd = "convert";
  }
  return magickCmd;
}

async function toJpeg(source, destination, maxEdge) {
  const cmd = await resolveMagick();
  await execFileAsync(
    cmd,
    [
      `${source}[0]`,
      "-auto-orient",
      "-strip",
      "-resize",
      `${maxEdge}x${maxEdge}>`,
      "-quality",
      String(QUALITY),
      "-interlace",
      "Plane",
      destination,
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );
}

/**
 * Decode a HEIC to something ImageMagick will definitely resize.
 *
 * Two decoders, because they fail on different files: heif-convert handles
 * most iPhone photos, but chokes on portrait-mode shots whose depth-map item
 * is referenced but absent ("Non-existing depth image referenced"). ImageMagick
 * reads only the primary image, so it sails past exactly those.
 */
async function decodeHeif(raw, scratch, label) {
  const png = path.join(scratch, "raw.png");

  try {
    await execFileAsync("heif-convert", [raw, png], {
      maxBuffer: 64 * 1024 * 1024,
    });
    if (existsSync(png)) return png;

    // a HEIC holding several top-level images makes heif-convert write
    // raw-1.png, raw-2.png … instead of the path it was given
    const produced = (await readdir(scratch))
      .filter((f) => /^raw-\d+\.png$/.test(f))
      .sort();
    if (produced.length > 0) return path.join(scratch, produced[0]);
  } catch (error) {
    console.log(`  heif-convert failed on ${label}, trying imagemagick`);
  }

  const fallback = path.join(scratch, "fallback.png");
  const cmd = await resolveMagick();
  await execFileAsync(cmd, [`${raw}[0]`, fallback], {
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!existsSync(fallback)) {
    throw new Error(`could not decode ${label} with either decoder`);
  }
  return fallback;
}

async function dimensions(file) {
  const cmd = await resolveMagick();
  const { stdout } = await execFileAsync(
    cmd === "magick" ? "magick" : "identify",
    cmd === "magick"
      ? ["identify", "-format", "%w %h", `${file}[0]`]
      : ["-format", "%w %h", `${file}[0]`],
  );
  const [w, h] = stdout.trim().split(/\s+/).map(Number);
  return { w, h };
}

// ---------------------------------------------------------------- helpers

const slugify = (s) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";

function describe(name) {
  const base = name.replace(/\.[^.]+$/, "").trim();
  if (!base || CAMERA_NOISE.some((pattern) => pattern.test(base))) return "";
  return base.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
}

/** Stable repo filename: readable slug + a hash so same-named files coexist. */
function targetName(file) {
  const hash = (file.md5Checksum ?? file.id).replace(/[^a-z0-9]/gi, "").slice(0, 8);
  return `${slugify(file.name.replace(/\.[^.]+$/, ""))}-${hash}.jpg`;
}

/** When the photo was taken beats when it was uploaded, for a feed. */
function takenAt(file) {
  const exif = file.imageMediaMetadata?.time;
  if (exif) {
    // Drive returns EXIF as "YYYY:MM:DD HH:MM:SS"
    const iso = exif.replace(
      /^(\d{4}):(\d{2}):(\d{2})[ T]/,
      "$1-$2-$3T",
    );
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return file.createdTime ?? file.modifiedTime ?? null;
}

async function listExisting(dir) {
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => f.endsWith(".jpg"));
}

// ------------------------------------------------------------------- main

async function main() {
  await mkdir(FULL_DIR, { recursive: true });
  await mkdir(THUMB_DIR, { recursive: true });

  const token = await getAccessToken();
  const files = await listFolder(token);
  const existing = await listExisting(FULL_DIR);

  console.log(`drive: ${files.length} image(s); repo: ${existing.length}`);

  // An auth or API hiccup that returns an empty listing must never be read as
  // "the user deleted everything".
  if (files.length === 0 && existing.length > 0) {
    throw new Error(
      `Refusing to continue: Drive returned 0 images but ${existing.length} ` +
        `are in the repo. If you really did empty the folder, delete ` +
        `public/gallery/full/* by hand.`,
    );
  }

  const wanted = new Map(); // target filename -> drive file
  for (const file of files) wanted.set(targetName(file), file);

  const toAdd = [...wanted.keys()].filter((f) => !existing.includes(f));
  const toDelete = existing.filter((f) => !wanted.has(f));

  // Same reasoning as above, for partial failures rather than total ones.
  if (
    toDelete.length > 5 &&
    toDelete.length > existing.length / 2 &&
    process.env.ALLOW_BULK_DELETE !== "1"
  ) {
    throw new Error(
      `Refusing to delete ${toDelete.length} of ${existing.length} images. ` +
        `Re-run with ALLOW_BULK_DELETE=1 if this is intended.`,
    );
  }

  const scratch = path.join(tmpdir(), `art-sync-${process.pid}`);
  await mkdir(scratch, { recursive: true });

  const skipped = [];

  try {
    for (const name of toAdd) {
      const file = wanted.get(name);
      const ext = path.extname(file.name).toLowerCase();
      const isHeif =
        NEEDS_HEIF.has(ext) ||
        file.mimeType === "image/heic" ||
        file.mimeType === "image/heif";

      console.log(`+ ${file.name} -> ${name}`);

      try {
        const raw = path.join(scratch, `raw${ext || ".bin"}`);
        await download(token, file.id, raw);

        // Browsers cannot render HEIC at all, so this conversion is
        // mandatory, not an optimisation.
        const source = isHeif ? await decodeHeif(raw, scratch, file.name) : raw;

        await toJpeg(source, path.join(FULL_DIR, name), FULL_MAX);
        await toJpeg(source, path.join(THUMB_DIR, name), THUMB_MAX);
      } catch (error) {
        // One unreadable photo must not take the whole sync down with it —
        // otherwise a single odd file blocks every later one, forever.
        console.log(`  ! skipped: ${error.message.split("\n")[0]}`);
        skipped.push(file.name);
        await rm(path.join(FULL_DIR, name), { force: true });
        await rm(path.join(THUMB_DIR, name), { force: true });
      }

      // empty the scratch dir rather than removing named files, so a stale
      // raw-1.png can't be picked up by the next photo's fallback glob
      for (const leftover of await readdir(scratch)) {
        await rm(path.join(scratch, leftover), { force: true });
      }
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }

  for (const name of toDelete) {
    console.log(`- ${name}`);
    await rm(path.join(FULL_DIR, name), { force: true });
    await rm(path.join(THUMB_DIR, name), { force: true });
  }

  // Rebuilt from scratch each run so it can never drift from what's on disk.
  const manifest = [];
  for (const [name, file] of wanted) {
    const target = path.join(FULL_DIR, name);
    if (!existsSync(target)) continue;
    const { w, h } = await dimensions(target);
    manifest.push({
      file: name,
      w,
      h,
      date: takenAt(file),
      description: describe(file.name),
    });
  }

  manifest.sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const serialised = `${JSON.stringify(manifest, null, 2)}\n`;
  const previous = existsSync(MANIFEST) ? await readFile(MANIFEST, "utf8") : "";
  if (previous !== serialised) await writeFile(MANIFEST, serialised);

  console.log(
    `done: +${toAdd.length - skipped.length} -${toDelete.length}, ` +
      `${manifest.length} in manifest`,
  );

  // Loud but non-fatal: these retry every run, so they shouldn't be silent.
  if (skipped.length > 0) {
    console.log(`\n${skipped.length} file(s) could not be decoded:`);
    for (const name of skipped) console.log(`  - ${name}`);
    console.log("re-save them as JPEG in Drive and they'll sync next run.");
  }
}

// only run when invoked directly, so scripts/gdrive-check.mjs can import the
// auth + listing helpers without triggering a sync
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
