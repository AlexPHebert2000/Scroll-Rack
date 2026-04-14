-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardFace" (
    "cardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "CardFace_pkey" PRIMARY KEY ("cardId","name")
);

-- CreateTable
CREATE TABLE "User" (
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" CHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "defaultBranchId" TEXT NOT NULL,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" CHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "headCommitId" TEXT,
    "deckId" TEXT NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commit" (
    "id" CHAR(10) NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "Commit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapShot" (
    "id" CHAR(10) NOT NULL,
    "commitID" TEXT NOT NULL,

    CONSTRAINT "SnapShot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Change" (
    "action" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,

    CONSTRAINT "Change_pkey" PRIMARY KEY ("action","cardId","commitId")
);

-- CreateTable
CREATE TABLE "_CardToSnapshot" (
    "A" TEXT NOT NULL,
    "B" CHAR(10) NOT NULL,

    CONSTRAINT "_CardToSnapshot_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Deck_defaultBranchId_key" ON "Deck"("defaultBranchId");

-- CreateIndex
CREATE INDEX "Deck_userId_idx" ON "Deck"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_id_key" ON "Branch"("id");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_headCommitId_key" ON "Branch"("headCommitId");

-- CreateIndex
CREATE UNIQUE INDEX "Commit_id_key" ON "Commit"("id");

-- CreateIndex
CREATE UNIQUE INDEX "SnapShot_commitID_key" ON "SnapShot"("commitID");

-- CreateIndex
CREATE INDEX "_CardToSnapshot_B_index" ON "_CardToSnapshot"("B");

-- AddForeignKey
ALTER TABLE "CardFace" ADD CONSTRAINT "CardFace_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_defaultBranchId_fkey" FOREIGN KEY ("defaultBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_headCommitId_fkey" FOREIGN KEY ("headCommitId") REFERENCES "Commit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commit" ADD CONSTRAINT "Commit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapShot" ADD CONSTRAINT "SnapShot_commitID_fkey" FOREIGN KEY ("commitID") REFERENCES "Commit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Change" ADD CONSTRAINT "Change_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Change" ADD CONSTRAINT "Change_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "Commit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CardToSnapshot" ADD CONSTRAINT "_CardToSnapshot_A_fkey" FOREIGN KEY ("A") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CardToSnapshot" ADD CONSTRAINT "_CardToSnapshot_B_fkey" FOREIGN KEY ("B") REFERENCES "SnapShot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
