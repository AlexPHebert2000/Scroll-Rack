-- DropForeignKey
ALTER TABLE "public"."Branch" DROP CONSTRAINT "Branch_headCommitId_fkey";

-- AlterTable
ALTER TABLE "Branch" ALTER COLUMN "headCommitId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_headCommitId_fkey" FOREIGN KEY ("headCommitId") REFERENCES "Commit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
