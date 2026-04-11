/*
  Warnings:

  - The primary key for the `Change` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "Change" DROP CONSTRAINT "Change_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Change_pkey" PRIMARY KEY ("id", "commitId");
