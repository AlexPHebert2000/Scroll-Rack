-- DropForeignKey
ALTER TABLE "public"."Deck" DROP CONSTRAINT "Deck_defaultBranchId_fkey";

-- AlterTable
ALTER TABLE "Deck" ALTER COLUMN "defaultBranchId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_defaultBranchId_fkey" FOREIGN KEY ("defaultBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
