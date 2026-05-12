-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('spotify', 'apple_music', 'youtube');

-- CreateEnum
CREATE TYPE "PairStatus" AS ENUM ('pending', 'active', 'paused');

-- CreateEnum
CREATE TYPE "MatchStrategy" AS ENUM ('isrc', 'fuzzy', 'manual');

-- CreateEnum
CREATE TYPE "SyncEventKind" AS ENUM ('detected', 'matched', 'skipped', 'written', 'failed', 'unmatched');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "providerAccountId" TEXT,
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "encryptedUserToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pair" (
    "id" TEXT NOT NULL,
    "status" "PairStatus" NOT NULL DEFAULT 'pending',
    "inviteToken" TEXT,
    "inviteExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairMember" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaylistLink" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "playlistId" TEXT NOT NULL,
    "name" TEXT,
    "canEdit" BOOLEAN NOT NULL DEFAULT true,
    "cursor" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaylistLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackMapping" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "sourceProvider" "Provider" NOT NULL,
    "sourceTrackId" TEXT NOT NULL,
    "destinationProvider" "Provider" NOT NULL,
    "destinationTrackId" TEXT NOT NULL,
    "isrc" TEXT,
    "strategy" "MatchStrategy" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncEvent" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "kind" "SyncEventKind" NOT NULL,
    "provider" "Provider" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnmatchedTrack" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "sourceProvider" "Provider" NOT NULL,
    "sourceTrackId" TEXT NOT NULL,
    "destinationProvider" "Provider" NOT NULL,
    "title" TEXT NOT NULL,
    "artists" TEXT[],
    "isrc" TEXT,
    "candidates" JSONB,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnmatchedTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ServiceConnection_provider_providerAccountId_idx" ON "ServiceConnection"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceConnection_userId_provider_key" ON "ServiceConnection"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "Pair_inviteToken_key" ON "Pair"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "PairMember_pairId_userId_key" ON "PairMember"("pairId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaylistLink_pairId_provider_key" ON "PlaylistLink"("pairId", "provider");

-- CreateIndex
CREATE INDEX "TrackMapping_pairId_destinationProvider_destinationTrackId_idx" ON "TrackMapping"("pairId", "destinationProvider", "destinationTrackId");

-- CreateIndex
CREATE INDEX "TrackMapping_isrc_idx" ON "TrackMapping"("isrc");

-- CreateIndex
CREATE UNIQUE INDEX "TrackMapping_pairId_sourceProvider_sourceTrackId_destinatio_key" ON "TrackMapping"("pairId", "sourceProvider", "sourceTrackId", "destinationProvider");

-- CreateIndex
CREATE INDEX "SyncEvent_pairId_createdAt_idx" ON "SyncEvent"("pairId", "createdAt");

-- CreateIndex
CREATE INDEX "UnmatchedTrack_pairId_createdAt_idx" ON "UnmatchedTrack"("pairId", "createdAt");

-- AddForeignKey
ALTER TABLE "ServiceConnection" ADD CONSTRAINT "ServiceConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairMember" ADD CONSTRAINT "PairMember_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairMember" ADD CONSTRAINT "PairMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistLink" ADD CONSTRAINT "PlaylistLink_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackMapping" ADD CONSTRAINT "TrackMapping_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncEvent" ADD CONSTRAINT "SyncEvent_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnmatchedTrack" ADD CONSTRAINT "UnmatchedTrack_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
