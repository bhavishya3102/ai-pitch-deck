-- CreateTable
CREATE TABLE "SlideNote" (
    "id" TEXT NOT NULL,
    "slideId" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlideNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlideNote_slideId_idx" ON "SlideNote"("slideId");

-- AddForeignKey
ALTER TABLE "SlideNote" ADD CONSTRAINT "SlideNote_slideId_fkey" FOREIGN KEY ("slideId") REFERENCES "Slide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
