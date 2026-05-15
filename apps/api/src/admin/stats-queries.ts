import type { AdminStatsDto } from "@sharedplaylist/shared-types";
import { prisma } from "../db/prisma.ts";

export async function computeAdminStats(): Promise<AdminStatsDto> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    usersTotal,
    usersLast7d,
    usersLast30d,
    usersActiveLast7d,
    sharesTotal,
    sharesCreatedLast7d,
    sharesByStatusRows,
    providerRows,
    totalTracksSynced,
    tracksSyncedLast7d,
    strategyRows,
    totalViews,
    totalConversions,
    failedLast24,
    totalLast24,
    needsReauthCount,
    unmatchedTotal,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { updatedAt: { gte: sevenDaysAgo } } }),
    prisma.pair.count(),
    prisma.pair.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.pair.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.serviceConnection.groupBy({ by: ["provider"], _count: { _all: true } }),
    prisma.syncEvent.count({ where: { kind: "written" } }),
    prisma.syncEvent.count({ where: { kind: "written", createdAt: { gte: sevenDaysAgo } } }),
    prisma.trackMapping.groupBy({ by: ["strategy"], _count: { _all: true } }),
    prisma.shareInviteView.count(),
    prisma.shareInviteView.count({ where: { converted: true } }),
    prisma.syncEvent.count({ where: { kind: "failed", createdAt: { gte: twentyFourHoursAgo } } }),
    prisma.syncEvent.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
    prisma.pair.count({ where: { status: "needs_reauth" } }),
    prisma.unmatchedTrack.count(),
  ]);

  const byStatus: AdminStatsDto["shares"]["byStatus"] = {
    pending: 0,
    active: 0,
    needs_reauth: 0,
    paused: 0,
    ended: 0,
  };
  for (const row of sharesByStatusRows) {
    byStatus[row.status] = row._count._all;
  }

  const providers: AdminStatsDto["providers"] = { spotify: 0, apple_music: 0, youtube: 0 };
  for (const row of providerRows) {
    providers[row.provider] = row._count._all;
  }

  const matchStrategy: AdminStatsDto["syncActivity"]["matchStrategy"] = {
    isrc: 0,
    fuzzy: 0,
    manual: 0,
    unmatched: 0,
  };
  for (const row of strategyRows) {
    matchStrategy[row.strategy] = row._count._all;
  }
  matchStrategy.unmatched = unmatchedTotal;

  const syncErrorRateLast24h = totalLast24 === 0 ? 0 : failedLast24 / totalLast24;

  return {
    users: {
      total: usersTotal,
      last7d: usersLast7d,
      last30d: usersLast30d,
      activeLast7d: usersActiveLast7d,
    },
    shares: { total: sharesTotal, byStatus, createdLast7d: sharesCreatedLast7d },
    syncActivity: { totalTracksSynced, tracksSyncedLast7d, matchStrategy },
    providers,
    inviteFunnel: { totalViews, totalConversions },
    health: { syncErrorRateLast24h, needsReauthCount },
  };
}
