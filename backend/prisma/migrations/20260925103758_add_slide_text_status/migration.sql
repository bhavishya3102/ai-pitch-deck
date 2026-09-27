-- CreateEnum
CREATE TYPE "SlideTextStatus" AS ENUM ('READY', 'REWRITING', 'FAILED');

-- AlterTable
ALTER TABLE "Slide" ADD COLUMN     "textStatus" "SlideTextStatus" NOT NULL DEFAULT 'READY';
