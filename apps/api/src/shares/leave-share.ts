import { prisma } from "../db/prisma.ts";

export async function leaveShare(shareId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const share = await tx.pair.findUnique({
      where: { id: shareId },
      include: { members: true },
    });
    if (!share) {
      const err = new Error("Share not found") as Error & { statusCode?: number };
      err.statusCode = 404;
      throw err;
    }
    const member = share.members.find((m) => m.userId === userId);
    if (!member) {
      const err = new Error("Not a member of this share") as Error & { statusCode?: number };
      err.statusCode = 403;
      throw err;
    }

    await tx.playlistLink.deleteMany({ where: { pairId: shareId, userId } });
    await tx.pairMember.delete({ where: { id: member.id } });

    const remaining = await tx.pairMember.count({ where: { pairId: shareId } });
    if (remaining === 0) {
      return tx.pair.update({
        where: { id: shareId },
        data: { status: "ended", endedAt: new Date(), endedById: userId },
      });
    }
    return tx.pair.findUniqueOrThrow({ where: { id: shareId } });
  });
}
