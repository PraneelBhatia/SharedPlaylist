import type { Provider } from "@sharedplaylist/shared-types";
import { prisma } from "../db/prisma.ts";
import { getProviderClient } from "../providers/index.ts";
import { matchTrack } from "./matcher.ts";
import { getConnectionTokens } from "./tokens.ts";

export type SyncPairResult = {
  active: boolean;
  events: number;
};

export async function syncPair(pairId: string): Promise<SyncPairResult> {
  const pair = await prisma.pair.findUnique({
    where: { id: pairId },
    include: { playlists: true, members: true },
  });
  if (!pair) throw new Error(`Pair ${pairId} not found`);
  if (pair.status !== "active") return { active: false, events: 0 };
  if (pair.playlists.length < 2 || pair.members.length < 2) {
    await writeEvent(pairId, "skipped", "spotify", "Pair is not fully configured");
    return { active: false, events: 1 };
  }

  let eventCount = 0;
  for (const sourceLink of pair.playlists) {
    const destinationLinks = pair.playlists.filter((link) => link.provider !== sourceLink.provider);
    const sourceMember = pair.members[0]!;
    const sourceTokens = await getConnectionTokens(sourceMember.userId, sourceLink.provider as Provider);
    const sourceClient = getProviderClient(sourceLink.provider as Provider);
    const snapshot = await sourceClient.getPlaylistSnapshot(
      sourceTokens.accessToken,
      sourceLink.playlistId,
      sourceTokens.userToken,
    );

    if (snapshot.cursor === sourceLink.cursor) {
      await writeEvent(pairId, "skipped", sourceLink.provider as Provider, "Playlist cursor unchanged");
      eventCount++;
      continue;
    }

    await prisma.playlistLink.update({
      where: { id: sourceLink.id },
      data: { cursor: snapshot.cursor, lastPolledAt: new Date() },
    });

    const sourceTracks = await sourceClient.listPlaylistTracks(
      sourceTokens.accessToken,
      sourceLink.playlistId,
      sourceTokens.userToken,
    );
    await writeEvent(pairId, "detected", sourceLink.provider as Provider, `Read ${sourceTracks.length} tracks`);
    eventCount++;

    for (const destinationLink of destinationLinks) {
      const destinationMember = pair.members[1]!;
      const destinationProvider = destinationLink.provider as Provider;
      const destinationTokens = await getConnectionTokens(destinationMember.userId, destinationProvider);
      const destinationClient = getProviderClient(destinationProvider);

      for (const sourceTrack of sourceTracks) {
        const existing = await prisma.trackMapping.findUnique({
          where: {
            pairId_sourceProvider_sourceTrackId_destinationProvider: {
              pairId,
              sourceProvider: sourceLink.provider,
              sourceTrackId: sourceTrack.id,
              destinationProvider,
            },
          },
        });
        if (existing) continue;

        const match = await matchTrack(
          sourceTrack,
          destinationProvider,
          destinationTokens.accessToken,
          destinationTokens.userToken,
        );

        if (!match) {
          await prisma.unmatchedTrack.create({
            data: {
              pairId,
              sourceProvider: sourceLink.provider,
              sourceTrackId: sourceTrack.id,
              destinationProvider,
              title: sourceTrack.title,
              artists: sourceTrack.artists,
              isrc: sourceTrack.isrc,
            },
          });
          await writeEvent(pairId, "unmatched", destinationProvider, `No confident match for ${sourceTrack.title}`);
          eventCount++;
          continue;
        }

        const alreadyInDestination = await prisma.trackMapping.findFirst({
          where: {
            pairId,
            destinationProvider,
            destinationTrackId: match.track.id,
          },
        });
        if (alreadyInDestination) {
          await writeMapping(pairId, sourceLink.provider as Provider, sourceTrack.id, destinationProvider, match);
          await writeEvent(pairId, "skipped", destinationProvider, `${match.track.title} already mapped`);
          eventCount++;
          continue;
        }

        await destinationClient.addTracksToPlaylist(
          destinationTokens.accessToken,
          destinationLink.playlistId,
          [match.track],
          destinationTokens.userToken,
        );
        await writeMapping(pairId, sourceLink.provider as Provider, sourceTrack.id, destinationProvider, match);
        await writeEvent(
          pairId,
          "written",
          destinationProvider,
          `Added ${match.track.title}`,
          match.confidence,
        );
        eventCount++;
      }
    }
  }

  return { active: eventCount > 0, events: eventCount };
}

async function writeMapping(
  pairId: string,
  sourceProvider: Provider,
  sourceTrackId: string,
  destinationProvider: Provider,
  match: NonNullable<Awaited<ReturnType<typeof matchTrack>>>,
): Promise<void> {
  await prisma.trackMapping.upsert({
    where: {
      pairId_sourceProvider_sourceTrackId_destinationProvider: {
        pairId,
        sourceProvider,
        sourceTrackId,
        destinationProvider,
      },
    },
    update: {},
    create: {
      pairId,
      sourceProvider,
      sourceTrackId,
      destinationProvider,
      destinationTrackId: match.track.id,
      isrc: match.track.isrc,
      strategy: match.strategy,
      confidence: match.confidence,
    },
  });
}

async function writeEvent(
  pairId: string,
  kind: "detected" | "matched" | "skipped" | "written" | "failed" | "unmatched",
  provider: Provider,
  message: string,
  confidence?: number,
): Promise<void> {
  await prisma.syncEvent.create({
    data: { pairId, kind, provider, message, confidence },
  });
}
