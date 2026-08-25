-- CreateTable
CREATE TABLE "OwnedCard" (
    "userId" TEXT NOT NULL,
    "oracleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnedCard_pkey" PRIMARY KEY ("userId","oracleId")
);

-- CreateIndex
CREATE INDEX "OwnedCard_userId_idx" ON "OwnedCard"("userId");

-- AddForeignKey
ALTER TABLE "OwnedCard" ADD CONSTRAINT "OwnedCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
