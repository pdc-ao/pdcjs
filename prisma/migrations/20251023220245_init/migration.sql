-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PRODUCER', 'CONSUMER', 'STORAGE_OWNER', 'TRANSPORTER', 'TRANSFORMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('HELD', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('PLANNED', 'IN_PREPARATION', 'PLANTED', 'GROWING', 'READY_TO_HARVEST', 'HARVESTING', 'HARVESTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('LAND_PREPARATION', 'PLANTING', 'FERTILIZATION', 'IRRIGATION', 'PEST_CONTROL', 'WEEDING', 'HARVEST_START', 'HARVEST_COMPLETE', 'POST_HARVEST', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "UpdateType" AS ENUM ('PROGRESS_UPDATE', 'MILESTONE_REACHED', 'ISSUE_REPORTED', 'QUANTITY_CHANGE', 'DATE_CHANGE', 'WEATHER_IMPACT', 'PEST_DISEASE', 'GENERAL');

-- CreateEnum
CREATE TYPE "PreOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL DEFAULT 'INDIVIDUAL',
    "fullName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "companyName" TEXT,
    "registrationNumber" TEXT,
    "taxId" TEXT,
    "companyType" TEXT,
    "incorporationDate" TIMESTAMP(3),
    "phoneNumber" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "stateProvince" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Angola',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "profilePictureUrl" TEXT,
    "role" "UserRole" NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationDetails" TEXT,
    "averageRating" DOUBLE PRECISION,
    "notificationPreferences" JSONB DEFAULT '{"email":true,"sms":false}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProducerDetails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmName" TEXT,
    "farmDescription" TEXT,
    "certifications" TEXT,

    CONSTRAINT "ProducerDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageDetails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "facilityName" TEXT,
    "businessRegistrationId" TEXT,

    CONSTRAINT "StorageDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransporterDetails" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT,
    "driverLicenseId" TEXT,
    "vehicleRegistrationDetails" TEXT,

    CONSTRAINT "TransporterDetails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductListing" (
    "id" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "quantityAvailable" DOUBLE PRECISION NOT NULL,
    "unitOfMeasure" TEXT NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AOA',
    "plannedAvailabilityDate" TIMESTAMP(3),
    "actualAvailabilityDate" TIMESTAMP(3),
    "locationAddress" TEXT,
    "locationLatitude" DOUBLE PRECISION,
    "locationLongitude" DOUBLE PRECISION,
    "qualityCertifications" TEXT,
    "imagesUrls" JSONB,
    "videoUrl" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageListing" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "facilityName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "storageType" TEXT NOT NULL,
    "totalCapacity" DOUBLE PRECISION,
    "capacityUnit" TEXT,
    "availableCapacity" DOUBLE PRECISION,
    "amenities" JSONB,
    "pricingStructure" TEXT NOT NULL,
    "responsibilities" TEXT,
    "addressLine1" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Angola',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "imagesUrls" JSONB,
    "availabilityStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportListing" (
    "id" TEXT NOT NULL,
    "transporterId" TEXT NOT NULL,
    "serviceTitle" TEXT NOT NULL,
    "description" TEXT,
    "vehicleType" TEXT NOT NULL,
    "carryingCapacityWeight" DOUBLE PRECISION,
    "capacityWeightUnit" TEXT,
    "carryingCapacityVolume" DOUBLE PRECISION,
    "capacityVolumeUnit" TEXT,
    "operationalRoutes" TEXT,
    "primaryDestinationType" TEXT,
    "pricingModel" TEXT NOT NULL,
    "baseLocationCity" TEXT NOT NULL,
    "baseLocationCountry" TEXT NOT NULL DEFAULT 'Angola',
    "availabilityStatus" TEXT NOT NULL,
    "insuranceDetails" TEXT,
    "imagesUrls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "transporterId" TEXT,
    "storageId" TEXT,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AOA',
    "orderStatus" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "transactionId" TEXT,
    "shippingAddressLine1" TEXT NOT NULL,
    "shippingCity" TEXT NOT NULL,
    "shippingPostalCode" TEXT NOT NULL,
    "shippingCountry" TEXT NOT NULL DEFAULT 'Angola',
    "notesForSeller" TEXT,
    "notesForTransporter" TEXT,
    "estimatedDeliveryDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productListingId" TEXT NOT NULL,
    "quantityOrdered" DOUBLE PRECISION NOT NULL,
    "pricePerUnitAtOrder" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "changedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewedEntityId" TEXT NOT NULL,
    "reviewedEntityType" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "reviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isApprovedByAdmin" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRating" (
    "id" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewedId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isModerated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "messageContent" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "relatedEntityId" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AOA',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "type" TEXT,
    "buyerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "sellerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "escrowHeldAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "providerPaymentId" TEXT,
    "providerChargeId" TEXT,
    "idempotencyKey" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowTransaction" (
    "id" TEXT NOT NULL,
    "paymentTransactionId" TEXT NOT NULL,
    "milestone" TEXT,
    "status" "EscrowStatus" NOT NULL DEFAULT 'HELD',
    "releaseDate" TIMESTAMP(3),
    "releasedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionLedger" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReference" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operationId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransformationFacility" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "capacity" DOUBLE PRECISION NOT NULL,
    "processingRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransformationFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityBooking" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inputProduct" TEXT NOT NULL,
    "desiredOutput" TEXT NOT NULL,
    "notes" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "totalCost" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AOA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionPlan" (
    "id" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productCategory" TEXT NOT NULL,
    "variety" TEXT,
    "areaSize" DOUBLE PRECISION NOT NULL,
    "areaUnit" TEXT NOT NULL DEFAULT 'HECTARES',
    "location" TEXT NOT NULL,
    "coordinates" TEXT,
    "estimatedQuantity" DOUBLE PRECISION NOT NULL,
    "quantityUnit" TEXT NOT NULL,
    "estimatedYield" DOUBLE PRECISION,
    "plantingDate" TIMESTAMP(3) NOT NULL,
    "estimatedHarvestDate" TIMESTAMP(3) NOT NULL,
    "actualHarvestDate" TIMESTAMP(3),
    "status" "ProductionStatus" NOT NULL DEFAULT 'PLANNED',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "allowPreOrders" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "farmingMethod" TEXT,
    "certifications" TEXT[],
    "images" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionSchedule" (
    "id" TEXT NOT NULL,
    "productionPlanId" TEXT NOT NULL,
    "milestoneName" TEXT NOT NULL,
    "milestoneType" "MilestoneType" NOT NULL,
    "description" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "notifyBefore" INTEGER NOT NULL DEFAULT 0,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionUpdate" (
    "id" TEXT NOT NULL,
    "productionPlanId" TEXT NOT NULL,
    "updateType" "UpdateType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "images" TEXT[],
    "currentGrowthStage" TEXT,
    "healthStatus" TEXT,
    "quantityAdjustment" DOUBLE PRECISION,
    "dateAdjustment" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionSubscriber" (
    "id" TEXT NOT NULL,
    "productionPlanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifyOnUpdate" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnMilestone" BOOLEAN NOT NULL DEFAULT true,
    "notify15DaysBefore" BOOLEAN NOT NULL DEFAULT true,
    "notify7DaysBefore" BOOLEAN NOT NULL DEFAULT true,
    "notify1DayBefore" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnHarvest" BOOLEAN NOT NULL DEFAULT true,
    "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreOrder" (
    "id" TEXT NOT NULL,
    "productionPlanId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "pricePerUnit" DOUBLE PRECISION,
    "totalPrice" DOUBLE PRECISION,
    "status" "PreOrderStatus" NOT NULL DEFAULT 'PENDING',
    "depositAmount" DOUBLE PRECISION,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "convertedToOrderId" TEXT,

    CONSTRAINT "PreOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offering" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferingSchedule" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "bookedById" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "specs" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "stockLevel" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "requestedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_companyName_key" ON "User"("companyName");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isVerified_idx" ON "User"("isVerified");

-- CreateIndex
CREATE INDEX "User_entityType_idx" ON "User"("entityType");

-- CreateIndex
CREATE UNIQUE INDEX "ProducerDetails_userId_key" ON "ProducerDetails"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StorageDetails_userId_key" ON "StorageDetails"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TransporterDetails_userId_key" ON "TransporterDetails"("userId");

-- CreateIndex
CREATE INDEX "ProductListing_status_category_idx" ON "ProductListing"("status", "category");

-- CreateIndex
CREATE INDEX "ProductListing_producerId_idx" ON "ProductListing"("producerId");

-- CreateIndex
CREATE INDEX "StorageListing_ownerId_city_idx" ON "StorageListing"("ownerId", "city");

-- CreateIndex
CREATE INDEX "StorageListing_availabilityStatus_idx" ON "StorageListing"("availabilityStatus");

-- CreateIndex
CREATE INDEX "TransportListing_transporterId_baseLocationCity_idx" ON "TransportListing"("transporterId", "baseLocationCity");

-- CreateIndex
CREATE INDEX "TransportListing_availabilityStatus_idx" ON "TransportListing"("availabilityStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_buyerId_sellerId_orderStatus_idx" ON "Order"("buyerId", "sellerId", "orderStatus");

-- CreateIndex
CREATE INDEX "Order_orderNumber_idx" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productListingId_idx" ON "OrderItem"("productListingId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_changedBy_idx" ON "OrderStatusHistory"("changedBy");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_createdAt_idx" ON "OrderStatusHistory"("createdAt");

-- CreateIndex
CREATE INDEX "Review_reviewerId_idx" ON "Review"("reviewerId");

-- CreateIndex
CREATE INDEX "Review_reviewedEntityId_reviewedEntityType_idx" ON "Review"("reviewedEntityId", "reviewedEntityType");

-- CreateIndex
CREATE INDEX "UserRating_reviewerId_reviewedId_idx" ON "UserRating"("reviewerId", "reviewedId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_senderId_receiverId_idx" ON "Message"("senderId", "receiverId");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE INDEX "Document_type_idx" ON "Document"("type");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_idempotencyKey_key" ON "PaymentTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentTransaction_buyerId_idx" ON "PaymentTransaction"("buyerId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_sellerId_idx" ON "PaymentTransaction"("sellerId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_status_idx" ON "PaymentTransaction"("status");

-- CreateIndex
CREATE INDEX "PaymentTransaction_idempotencyKey_idx" ON "PaymentTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentTransaction_createdAt_idx" ON "PaymentTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EscrowTransaction_paymentTransactionId_key" ON "EscrowTransaction"("paymentTransactionId");

-- CreateIndex
CREATE INDEX "EscrowTransaction_paymentTransactionId_idx" ON "EscrowTransaction"("paymentTransactionId");

-- CreateIndex
CREATE INDEX "EscrowTransaction_status_idx" ON "EscrowTransaction"("status");

-- CreateIndex
CREATE INDEX "TransactionLedger_transactionId_idx" ON "TransactionLedger"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionLedger_userId_idx" ON "TransactionLedger"("userId");

-- CreateIndex
CREATE INDEX "TransactionLedger_createdAt_idx" ON "TransactionLedger"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReference_reference_key" ON "PaymentReference"("reference");

-- CreateIndex
CREATE INDEX "PaymentReference_reference_idx" ON "PaymentReference"("reference");

-- CreateIndex
CREATE INDEX "PaymentReference_userId_idx" ON "PaymentReference"("userId");

-- CreateIndex
CREATE INDEX "PaymentReference_status_idx" ON "PaymentReference"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WalletBalance_userId_key" ON "WalletBalance"("userId");

-- CreateIndex
CREATE INDEX "WalletBalance_userId_idx" ON "WalletBalance"("userId");

-- CreateIndex
CREATE INDEX "TransformationFacility_ownerId_idx" ON "TransformationFacility"("ownerId");

-- CreateIndex
CREATE INDEX "TransformationFacility_isActive_idx" ON "TransformationFacility"("isActive");

-- CreateIndex
CREATE INDEX "FacilityBooking_facilityId_idx" ON "FacilityBooking"("facilityId");

-- CreateIndex
CREATE INDEX "FacilityBooking_userId_idx" ON "FacilityBooking"("userId");

-- CreateIndex
CREATE INDEX "FacilityBooking_status_idx" ON "FacilityBooking"("status");

-- CreateIndex
CREATE INDEX "FacilityBooking_startDate_endDate_idx" ON "FacilityBooking"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "ProductionPlan_producerId_idx" ON "ProductionPlan"("producerId");

-- CreateIndex
CREATE INDEX "ProductionPlan_status_idx" ON "ProductionPlan"("status");

-- CreateIndex
CREATE INDEX "ProductionPlan_estimatedHarvestDate_idx" ON "ProductionPlan"("estimatedHarvestDate");

-- CreateIndex
CREATE INDEX "ProductionPlan_isPublic_idx" ON "ProductionPlan"("isPublic");

-- CreateIndex
CREATE INDEX "ProductionSchedule_productionPlanId_idx" ON "ProductionSchedule"("productionPlanId");

-- CreateIndex
CREATE INDEX "ProductionSchedule_scheduledDate_idx" ON "ProductionSchedule"("scheduledDate");

-- CreateIndex
CREATE INDEX "ProductionSchedule_status_idx" ON "ProductionSchedule"("status");

-- CreateIndex
CREATE INDEX "ProductionUpdate_productionPlanId_idx" ON "ProductionUpdate"("productionPlanId");

-- CreateIndex
CREATE INDEX "ProductionUpdate_createdAt_idx" ON "ProductionUpdate"("createdAt");

-- CreateIndex
CREATE INDEX "ProductionSubscriber_userId_idx" ON "ProductionSubscriber"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionSubscriber_productionPlanId_userId_key" ON "ProductionSubscriber"("productionPlanId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PreOrder_convertedToOrderId_key" ON "PreOrder"("convertedToOrderId");

-- CreateIndex
CREATE INDEX "PreOrder_productionPlanId_idx" ON "PreOrder"("productionPlanId");

-- CreateIndex
CREATE INDEX "PreOrder_customerId_idx" ON "PreOrder"("customerId");

-- CreateIndex
CREATE INDEX "PreOrder_status_idx" ON "PreOrder"("status");

-- CreateIndex
CREATE INDEX "Offering_ownerId_idx" ON "Offering"("ownerId");

-- CreateIndex
CREATE INDEX "OfferingSchedule_offeringId_idx" ON "OfferingSchedule"("offeringId");

-- CreateIndex
CREATE INDEX "OfferingSchedule_startTime_endTime_idx" ON "OfferingSchedule"("startTime", "endTime");

-- CreateIndex
CREATE INDEX "OfferingSchedule_bookedById_idx" ON "OfferingSchedule"("bookedById");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Component_supplierId_idx" ON "Component"("supplierId");

-- CreateIndex
CREATE INDEX "Component_category_idx" ON "Component"("category");

-- CreateIndex
CREATE INDEX "Component_requestedBy_idx" ON "Component"("requestedBy");

-- AddForeignKey
ALTER TABLE "ProducerDetails" ADD CONSTRAINT "ProducerDetails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageDetails" ADD CONSTRAINT "StorageDetails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransporterDetails" ADD CONSTRAINT "TransporterDetails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductListing" ADD CONSTRAINT "ProductListing_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageListing" ADD CONSTRAINT "StorageListing_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportListing" ADD CONSTRAINT "TransportListing_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "fk_order_transporter_user" FOREIGN KEY ("transporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "fk_order_transporter_listing" FOREIGN KEY ("transporterId") REFERENCES "TransportListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_storageId_fkey" FOREIGN KEY ("storageId") REFERENCES "StorageListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productListingId_fkey" FOREIGN KEY ("productListingId") REFERENCES "ProductListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "fk_review_user" FOREIGN KEY ("reviewedEntityId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "fk_review_product" FOREIGN KEY ("reviewedEntityId") REFERENCES "ProductListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "fk_review_storage" FOREIGN KEY ("reviewedEntityId") REFERENCES "StorageListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "fk_review_transport" FOREIGN KEY ("reviewedEntityId") REFERENCES "TransportListing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRating" ADD CONSTRAINT "UserRating_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRating" ADD CONSTRAINT "UserRating_reviewedId_fkey" FOREIGN KEY ("reviewedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowTransaction" ADD CONSTRAINT "EscrowTransaction_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLedger" ADD CONSTRAINT "TransactionLedger_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PaymentTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLedger" ADD CONSTRAINT "TransactionLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReference" ADD CONSTRAINT "PaymentReference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletBalance" ADD CONSTRAINT "WalletBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransformationFacility" ADD CONSTRAINT "TransformationFacility_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityBooking" ADD CONSTRAINT "FacilityBooking_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "TransformationFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityBooking" ADD CONSTRAINT "FacilityBooking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionPlan" ADD CONSTRAINT "ProductionPlan_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionSchedule" ADD CONSTRAINT "ProductionSchedule_productionPlanId_fkey" FOREIGN KEY ("productionPlanId") REFERENCES "ProductionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionUpdate" ADD CONSTRAINT "ProductionUpdate_productionPlanId_fkey" FOREIGN KEY ("productionPlanId") REFERENCES "ProductionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionUpdate" ADD CONSTRAINT "ProductionUpdate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionSubscriber" ADD CONSTRAINT "ProductionSubscriber_productionPlanId_fkey" FOREIGN KEY ("productionPlanId") REFERENCES "ProductionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionSubscriber" ADD CONSTRAINT "ProductionSubscriber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_productionPlanId_fkey" FOREIGN KEY ("productionPlanId") REFERENCES "ProductionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreOrder" ADD CONSTRAINT "PreOrder_convertedToOrderId_fkey" FOREIGN KEY ("convertedToOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offering" ADD CONSTRAINT "Offering_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferingSchedule" ADD CONSTRAINT "OfferingSchedule_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "Offering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferingSchedule" ADD CONSTRAINT "OfferingSchedule_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
