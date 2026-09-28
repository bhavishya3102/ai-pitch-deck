-- CreateEnum
CREATE TYPE "DeckAudience" AS ENUM ('INVESTOR', 'TEAM', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "DeckTone" AS ENUM ('CONFIDENT', 'PLAIN', 'BOLD');

-- AlterTable
ALTER TABLE "Deck" ADD COLUMN     "audience" "DeckAudience" NOT NULL DEFAULT 'INVESTOR',
ADD COLUMN     "slideCount" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "tone" "DeckTone" NOT NULL DEFAULT 'CONFIDENT';
