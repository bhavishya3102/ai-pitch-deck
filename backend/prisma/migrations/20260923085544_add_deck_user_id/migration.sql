-- Every deck now belongs to a Clerk user.
-- Decks created before auth existed are kept and marked "legacy-unclaimed":
-- they stay in the database but no signed-in user will see them.

-- AlterTable
ALTER TABLE "Deck" ADD COLUMN "userId" TEXT NOT NULL DEFAULT 'legacy-unclaimed';

-- New decks must always carry a real user id, so drop the default again
ALTER TABLE "Deck" ALTER COLUMN "userId" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Deck_userId_idx" ON "Deck"("userId");
