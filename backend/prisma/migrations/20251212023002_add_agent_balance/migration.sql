-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "lifetime_entries" INTEGER NOT NULL DEFAULT 0;
