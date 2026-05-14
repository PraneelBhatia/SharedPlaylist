-- DropIndex
DROP INDEX "PlaylistLink_pairId_provider_key";

-- AlterTable
ALTER TABLE "Pair" ADD COLUMN     "creatorId" TEXT NOT NULL,
ADD COLUMN     "endedAt" TIMESTAMP(3),
ADD COLUMN     "endedById" TEXT,
ADD COLUMN     "sourcePlaylistId" TEXT NOT NULL,
ADD COLUMN     "sourcePlaylistName" TEXT NOT NULL,
ADD COLUMN     "sourceProvider" "Provider" NOT NULL;

-- AlterTable
ALTER TABLE "PlaylistLink" ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ShareInviteView" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "converted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ShareInviteView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShareInviteView_pairId_viewedAt_idx" ON "ShareInviteView"("pairId", "viewedAt");

-- CreateIndex
CREATE INDEX "PlaylistLink_pairId_idx" ON "PlaylistLink"("pairId");

-- CreateIndex
CREATE INDEX "PlaylistLink_userId_idx" ON "PlaylistLink"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistLink_pairId_userId_key" ON "PlaylistLink"("pairId", "userId");

-- AddForeignKey
ALTER TABLE "Pair" ADD CONSTRAINT "Pair_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pair" ADD CONSTRAINT "Pair_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistLink" ADD CONSTRAINT "PlaylistLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareInviteView" ADD CONSTRAINT "ShareInviteView_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique index: at most one active-or-pending share per source playlist per creator
CREATE UNIQUE INDEX "one_active_share_per_source"
  ON "Pair" ("creatorId", "sourceProvider", "sourcePlaylistId")
  WHERE "status" IN ('pending', 'active', 'needs_reauth', 'paused');
