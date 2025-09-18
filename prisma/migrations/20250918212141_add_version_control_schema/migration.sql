-- AlterTable
ALTER TABLE "Deck" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'main',
    "deckId" TEXT NOT NULL,
    "headCommitId" TEXT NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commit" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "Commit_pkey" PRIMARY KEY ("id","branchId")
);

-- CreateTable
CREATE TABLE "Change" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "commitBranchId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,

    CONSTRAINT "Change_pkey" PRIMARY KEY ("id","commitId")
);

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commit" ADD CONSTRAINT "Commit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Change" ADD CONSTRAINT "Change_commitId_commitBranchId_fkey" FOREIGN KEY ("commitId", "commitBranchId") REFERENCES "Commit"("id", "branchId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Change" ADD CONSTRAINT "Change_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
