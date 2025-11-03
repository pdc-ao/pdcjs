/*
  Warnings:

  - The `orderStatus` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `paymentStatus` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `PaymentTransaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `reviewedEntityId` on the `Review` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- DropForeignKey
ALTER TABLE "public"."FacilityBooking" DROP CONSTRAINT "FacilityBooking_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_senderId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Offering" DROP CONSTRAINT "Offering_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "Order_sellerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Order" DROP CONSTRAINT "fk_order_transporter_listing";

-- DropForeignKey
ALTER TABLE "public"."OrderStatusHistory" DROP CONSTRAINT "OrderStatusHistory_changedBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."PaymentTransaction" DROP CONSTRAINT "PaymentTransaction_buyerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PaymentTransaction" DROP CONSTRAINT "PaymentTransaction_sellerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PreOrder" DROP CONSTRAINT "PreOrder_customerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductListing" DROP CONSTRAINT "ProductListing_producerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductionUpdate" DROP CONSTRAINT "ProductionUpdate_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "Review_reviewerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "fk_review_product";

-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "fk_review_storage";

-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "fk_review_transport";

-- DropForeignKey
ALTER TABLE "public"."Review" DROP CONSTRAINT "fk_review_user";

-- DropForeignKey
ALTER TABLE "public"."StorageListing" DROP CONSTRAINT "StorageListing_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TransformationFacility" DROP CONSTRAINT "TransformationFacility_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."TransportListing" DROP CONSTRAINT "TransportListing_transporterId_fkey";

-- DropIndex
DROP INDEX "public"."Review_reviewedEntityId_reviewedEntityType_idx";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "transportListingId" TEXT,
DROP COLUMN "orderStatus",
ADD COLUMN     "orderStatus" "OrderStatus" NOT NULL DEFAULT 'PENDING',
DROP COLUMN "paymentStatus",
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PaymentTransaction" DROP COLUMN "status",
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "PreOrder" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "reviewedEntityId",
ADD COLUMN     "reviewedProductId" TEXT,
ADD COLUMN     "reviewedStorageId" TEXT,
ADD COLUMN     "reviewedTransportId" TEXT,
ADD COLUMN     "reviewedUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CONSUMER',
ALTER COLUMN "notificationPreferences" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Order_buyerId_sellerId_orderStatus_idx" ON "Order"("buyerId", "sellerId", "orderStatus");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

-- CreateIndex
CREATE INDEX "Review_reviewedEntityType_reviewedUserId_reviewedProductId__idx" ON "Review"("reviewedEntityType", "reviewedUserId", "reviewedProductId", "reviewedStorageId", "reviewedTransportId");

-- RenameForeignKey
ALTER TABLE "Order" RENAME CONSTRAINT "fk_order_transporter_user" TO "Order_transporterId_fkey";

-- AddForeignKey
ALTER TABLE "ProductListing" ADD CONSTRAINT "ProductListing_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageListing" ADD CONSTRAINT "StorageListing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportListing" ADD CONSTRAINT "TransportListing_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_transportListingId_fkey" FOREIGN KEY ("transportListingId") REFERENCES "TransportListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedUserId_fkey" FOREIGN KEY ("reviewedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedProductId_fkey" FOREIGN KEY ("reviewedProductId") REFERENCES "ProductListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedStorageId_fkey" FOREIGN KEY ("reviewedStorageId") REFERENCES "StorageListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewedTransportId_fkey" FOREIGN KEY ("reviewedTransportId") REFERENCES "TransportListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransformationFacility" ADD CONSTRAINT "TransformationFacility_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityBooking" ADD CONSTRAINT "FacilityBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionUpdate" ADD CONSTRAINT "ProductionUpdate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
