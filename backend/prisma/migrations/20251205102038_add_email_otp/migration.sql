/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `agents` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "code" CHAR(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_code_lookup_idx" ON "otp_codes"("email", "used", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "agents_email_key" ON "agents"("email");
