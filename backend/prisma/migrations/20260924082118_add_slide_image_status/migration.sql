-- CreateEnum
CREATE TYPE "SlideImageStatus" AS ENUM ('READY', 'GENERATING', 'FAILED');

-- AlterTable
ALTER TABLE "Slide" ADD COLUMN     "imageStatus" "SlideImageStatus" NOT NULL DEFAULT 'READY';
