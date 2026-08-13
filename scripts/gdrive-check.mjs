#!/usr/bin/env node

import { getAccessToken, listFolder } from "./sync-art.mjs";

const CAMERA_NOISE =
  /^(img|image|photo|pxl|dsc|dscn|dji|screenshot|untitled)[-_ ]?[0-9-_ ()]*$/i;

try {
  const token = await getAccessToken();
  console.log("auth ok — service account authenticated\n");

  const files = await listFolder(token);

  if (files.length === 0) {
    console.log(
      "The folder is reachable but has no images in it.\n" +
        "If you expected some, check that the folder is shared with the " +
        "service account's client_email (Viewer is enough) and that " +
        "GDRIVE_FOLDER_ID is the id from the folder's URL.",
    );
    process.exit(0);
  }

  console.log(`${files.length} image(s):\n`);
  for (const file of files) {
    const base = file.name.replace(/\.[^.]+$/, "");
    const caption = CAMERA_NOISE.test(base) ? "(no caption — rename it)" : base;
    console.log(`  ${file.name}`);
    console.log(`    caption: ${caption}`);
  }

  const unnamed = files.filter((f) =>
    CAMERA_NOISE.test(f.name.replace(/\.[^.]+$/, "")),
  ).length;
  if (unnamed > 0) {
    console.log(
      `\n${unnamed} file(s) still have camera filenames. Rename them in the ` +
        `Drive app and the new name becomes the caption.`,
    );
  }
} catch (error) {
  console.error(`\nfailed: ${error.message}`);
  process.exit(1);
}
