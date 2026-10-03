-- CreateEnum
CREATE TYPE "UsageKind" AS ENUM ('DECK', 'IMAGE', 'REWRITE');

-- CreateTable
CREATE TABLE "UsageCharge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "UsageKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageCharge_userId_kind_createdAt_idx" ON "UsageCharge"("userId", "kind", "createdAt");
