-- CreateTable
CREATE TABLE "MobilePushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobilePushToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MobilePushToken_token_key" ON "MobilePushToken"("token");

-- CreateIndex
CREATE INDEX "MobilePushToken_userId_idx" ON "MobilePushToken"("userId");

-- CreateIndex
CREATE INDEX "MobilePushToken_token_idx" ON "MobilePushToken"("token");

-- AddForeignKey
ALTER TABLE "MobilePushToken" ADD CONSTRAINT "MobilePushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
