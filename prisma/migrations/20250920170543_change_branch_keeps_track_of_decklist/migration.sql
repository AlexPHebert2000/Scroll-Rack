/*
  Warnings:

  - You are about to drop the `_CardToDeck` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_CardToDeck" DROP CONSTRAINT "_CardToDeck_A_fkey";

-- DropForeignKey
ALTER TABLE "_CardToDeck" DROP CONSTRAINT "_CardToDeck_B_fkey";

-- DropTable
DROP TABLE "_CardToDeck";

-- CreateTable
CREATE TABLE "_BranchToCard" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_BranchToCard_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_BranchToCard_B_index" ON "_BranchToCard"("B");

-- AddForeignKey
ALTER TABLE "_BranchToCard" ADD CONSTRAINT "_BranchToCard_A_fkey" FOREIGN KEY ("A") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BranchToCard" ADD CONSTRAINT "_BranchToCard_B_fkey" FOREIGN KEY ("B") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
