import type { Provider } from "@sharedplaylist/shared-types";
import { prisma } from "../db/prisma.ts";

export type AcceptShareInput = {
  token: string;
  userId: string;
  destinationProvider: Provider;
  memberCap: number;
  autoCreatePlaylist: (
    sourcePlaylistName: string,
    destinationProvider: Provider,
  ) => Promise<{ playlistId: string; name: string }>;
};

export async function acceptShare(input: AcceptShareInput) {
  return prisma.$transaction(async (tx) => {
    const share = await tx.pair.findUnique({
      where: { inviteToken: input.token },
      include: { members: true },
    });
    if (!share || !share.inviteExpires || share.inviteExpires <= new Date() || share.status === "ended") {
      const err = new Error("Invite is invalid, expired, or revoked.") as Error & { statusCode?: number };
      err.statusCode = 410;
      throw err;
    }

    const alreadyMember = share.members.find((m) => m.userId === input.userId);
    if (alreadyMember) {
      return share;
    }

    if (share.members.length >= input.memberCap) {
      const err = new Error("This share is full.") as Error & { statusCode?: number };
      err.statusCode = 409;
      throw err;
    }

    await tx.$executeRawUnsafe(`SELECT id FROM "Pair" WHERE id = $1 FOR UPDATE`, share.id);
    const memberCount = await tx.pairMember.count({ where: { pairId: share.id } });
    if (memberCount >= input.memberCap) {
      const err = new Error("This share is full.") as Error & { statusCode?: number };
      err.statusCode = 409;
      throw err;
    }

    const destination = await input.autoCreatePlaylist(share.sourcePlaylistName, input.destinationProvider);

    await tx.pairMember.create({ data: { pairId: share.id, userId: input.userId } });
    await tx.playlistLink.create({
      data: {
        pairId: share.id,
        userId: input.userId,
        provider: input.destinationProvider,
        playlistId: destination.playlistId,
        name: destination.name,
      },
    });

    const recentView = await tx.shareInviteView.findFirst({
      where: { pairId: share.id, converted: false },
      orderBy: { viewedAt: "desc" },
    });
    if (recentView) {
      await tx.shareInviteView.update({ where: { id: recentView.id }, data: { converted: true } });
    }

    const nextStatus = share.status === "pending" ? "active" : share.status;
    return tx.pair.update({ where: { id: share.id }, data: { status: nextStatus } });
  });
}
