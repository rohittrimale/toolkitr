-- CreateTable
CREATE TABLE "DecisionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "context" TEXT,
    "options" JSONB,
    "chosenOption" TEXT NOT NULL,
    "reasoning" TEXT,
    "confidence" DECIMAL(3,2) NOT NULL,
    "tradeoffs" JSONB,
    "riskLevel" VARCHAR(20),
    "outcome" VARCHAR(20),
    "outcomeReason" TEXT,
    "feedbackReceived" BOOLEAN NOT NULL DEFAULT false,
    "userFeedback" TEXT,
    "decisionType" VARCHAR(50) NOT NULL,
    "domain" VARCHAR(50),
    "tags" VARCHAR(255),
    "decisionTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DecisionLog_userId_idx" ON "DecisionLog"("userId");

-- CreateIndex
CREATE INDEX "DecisionLog_userId_createdAt_idx" ON "DecisionLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DecisionLog_decisionType_idx" ON "DecisionLog"("decisionType");

-- CreateIndex
CREATE INDEX "DecisionLog_outcome_idx" ON "DecisionLog"("outcome");

-- CreateIndex
CREATE INDEX "DecisionLog_conversationId_idx" ON "DecisionLog"("conversationId");
