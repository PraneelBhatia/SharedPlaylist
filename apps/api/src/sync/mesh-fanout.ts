import type { Provider } from "@sharedplaylist/shared-types";

export type MeshLink = {
  id: string;
  userId: string;
  provider: Provider;
};

export function computeFanoutTargets<T extends MeshLink>(links: T[], sourceUserId: string): T[] {
  return links.filter((link) => link.userId !== sourceUserId);
}
