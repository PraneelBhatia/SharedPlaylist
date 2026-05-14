-- AlterEnum
-- Adds new PairStatus enum values. Must be in its own migration (committed)
-- before they can be referenced (e.g. in a CREATE INDEX ... WHERE predicate).
ALTER TYPE "PairStatus" ADD VALUE 'needs_reauth';
ALTER TYPE "PairStatus" ADD VALUE 'ended';
