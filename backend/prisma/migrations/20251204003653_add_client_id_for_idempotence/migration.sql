/*
  Warnings:

  - A unique constraint covering the columns `[client_id]` on the table `price_entries` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "price_entries" ADD COLUMN     "client_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "price_entries_client_id_key" ON "price_entries"("client_id");
