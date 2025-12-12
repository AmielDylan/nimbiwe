-- AlterTable
ALTER TABLE "price_entries" ADD COLUMN     "season" TEXT,
ADD COLUMN     "temperature" DECIMAL(4,1),
ADD COLUMN     "weather_code" TEXT;
