-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commanderOracleIds" TEXT[],
    "structure" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "oracleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manaCost" TEXT,
    "cmc" DOUBLE PRECISION NOT NULL,
    "typeLine" TEXT NOT NULL,
    "oracleText" TEXT,
    "colors" TEXT[],
    "colorIdentity" TEXT[],
    "layout" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL,
    "imageUris" JSONB,
    "cardFaces" JSONB,
    "legalities" JSONB NOT NULL,
    "prices" JSONB,
    "priceUsd" DECIMAL(10,2),
    "canBeCommander" BOOLEAN NOT NULL DEFAULT false,
    "isBackground" BOOLEAN NOT NULL DEFAULT false,
    "hasPartner" BOOLEAN NOT NULL DEFAULT false,
    "partnerWith" TEXT,
    "choosesBackground" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("oracleId")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "parentIds" TEXT[],
    "childIds" TEXT[],

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tagging" (
    "id" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "weight" TEXT,

    CONSTRAINT "Tagging_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Deck_userId_updatedAt_idx" ON "Deck"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "Card"("name");

-- CreateIndex
CREATE INDEX "Card_cmc_idx" ON "Card"("cmc");

-- CreateIndex
CREATE INDEX "Card_releasedAt_idx" ON "Card"("releasedAt");

-- CreateIndex
CREATE INDEX "Card_priceUsd_idx" ON "Card"("priceUsd");

-- CreateIndex
CREATE INDEX "Card_canBeCommander_idx" ON "Card"("canBeCommander");

-- CreateIndex
CREATE INDEX "Card_colorIdentity_idx" ON "Card" USING GIN ("colorIdentity");

-- CreateIndex
CREATE INDEX "Tag_slug_idx" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Tagging_cardId_idx" ON "Tagging"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "Tagging_tagId_cardId_key" ON "Tagging"("tagId", "cardId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tagging" ADD CONSTRAINT "Tagging_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tagging" ADD CONSTRAINT "Tagging_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("oracleId") ON DELETE RESTRICT ON UPDATE CASCADE;
