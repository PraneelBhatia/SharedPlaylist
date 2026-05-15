import type { Provider } from "@sharedplaylist/shared-types";
import { prisma } from "../db/prisma.ts";

export type RecoverShareInput = {
  shareId: string;
  userId: string;
  action: "create" | "select";
  playlistId?: string;
  autoCreatePlaylist?: (name: string, provider: Provider) => Promise<{ playlistId: string; name: string }>;
};

export async function recoverShare(input: RecoverShareInput) {
  const share = await prisma.pair.findUnique({
    where: { id: input.shareId },
    include: { members: true, playlists: true },
  });
  if (!share) {
    const err = new Error("Share not found") as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }
  const member = share.members.find((m) => m.userId === input.userId);
  if (!member) {
    const err = new Error("Not a member") as Error & { statusCode?: number };
    err.statusCode = 403;
    throw err;
  }
  if (share.status !== "needs_reauth") {
    const err = new Error("Share is not awaiting recovery") as Error & { statusCode?: number };
    err.statusCode = 409;
    throw err;
  }

  const oldLink = share.playlists.find((p) => p.userId === input.userId);
  if (!oldLink) {
    const err = new Error("No prior playlist link to recover") as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  let newPlaylistId: string;
  let newName: string | null = null;
  if (input.action === "create") {
    if (!input.autoCreatePlaylist) {
      const err = new Error("autoCreatePlaylist not provided") as Error & { statusCode?: number };
      err.statusCode = 500;
      throw err;
    }
    const created = await input.autoCreatePlaylist(share.sourcePlaylistName, oldLink.provider as Provider);
    newPlaylistId = created.playlistId;
    newName = created.name;
  } else {
    if (!input.playlistId) {
      const err = new Error("playlistId is required when action='select'") as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }
    newPlaylistId = input.playlistId;
  }

  await prisma.playlistLink.update({
    where: { id: oldLink.id },
    data: { playlistId: newPlaylistId, name: newName ?? oldLink.name, cursor: null },
  });

  return prisma.pair.update({ where: { id: share.id }, data: { status: "active" } });
}
