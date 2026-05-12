import { listMyPlaylists } from "./spotify.ts";
import { listLibraryPlaylists } from "./apple-music.ts";

async function main(): Promise<void> {
  console.log("\n── Spotify playlists (yours) ───────────────────────────");
  try {
    const spotify = await listMyPlaylists();
    for (const p of spotify) {
      console.log(`  ${p.id}   ${p.name}  (owner: ${p.owner})`);
    }
  } catch (err) {
    console.error("  Failed:", (err as Error).message);
  }

  console.log("\n── Apple Music library playlists (yours) ───────────────");
  try {
    const apple = await listLibraryPlaylists();
    for (const p of apple) {
      const editable = p.attributes.canEdit ? "" : " (read-only)";
      console.log(`  ${p.id}   ${p.attributes.name}${editable}`);
    }
  } catch (err) {
    console.error("  Failed:", (err as Error).message);
  }

  console.log("\nCopy the IDs you want to use into .env as:");
  console.log("  SPOTIFY_SOURCE_PLAYLIST_ID=<spotify id>");
  console.log("  APPLE_TARGET_PLAYLIST_ID=<apple id>\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
