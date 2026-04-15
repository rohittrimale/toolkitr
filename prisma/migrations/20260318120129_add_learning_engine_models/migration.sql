-- CreateTable
CREATE TABLE "ActionOutcome" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actionType" VARCHAR(100) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorType" VARCHAR(100),
    "errorMessage" TEXT,
    "recoveryStrategy" VARCHAR(100),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "contextDataset" VARCHAR(255),
    "contextEnvironment" VARCHAR(50),
    "screenBefore" TEXT,
    "screenAfter" TEXT,
    "timestamp" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuccessPattern" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "actionSequence" JSONB NOT NULL,
    "sequenceHash" VARCHAR(64) NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "successRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "avgDurationMs" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuccessPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailurePattern" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "actionSequence" JSONB NOT NULL,
    "sequenceHash" VARCHAR(64) NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "failureRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "commonErrors" JSONB NOT NULL,
    "successfulRecovery" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FailurePattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorRecoveryMap" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "errorType" VARCHAR(100) NOT NULL,
    "recoveryStrategy" VARCHAR(100) NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 1,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "successRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErrorRecoveryMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "preferenceKey" VARCHAR(255) NOT NULL,
    "preferenceValue" JSONB NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "confidence" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "lastModified" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveStrategy" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "taskType" VARCHAR(100) NOT NULL,
    "strategyName" VARCHAR(255),
    "successRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "failureRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "timeoutSuggestionMs" INTEGER NOT NULL DEFAULT 3000,
    "retryStrategy" TEXT NOT NULL DEFAULT 'exponential',
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "preflightChecks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptiveStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningSession" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "totalInteractions" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "learningConfidence" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "patternsDiscovered" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "exportedModel" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningMetricsHistory" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "successRate" DECIMAL(5,4),
    "avgIterations" DECIMAL(5,2),
    "patternsCount" INTEGER,
    "learningConfidence" DECIMAL(3,2),
    "mostCommonError" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningMetricsHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetLearning" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "datasetName" VARCHAR(255) NOT NULL,
    "accessCount" INTEGER NOT NULL DEFAULT 1,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "avgAccessTimeMs" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" BIGINT,
    "commonErrors" JSONB,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatasetLearning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionOutcome_userId_idx" ON "ActionOutcome"("userId");

-- CreateIndex
CREATE INDEX "ActionOutcome_sessionId_idx" ON "ActionOutcome"("sessionId");

-- CreateIndex
CREATE INDEX "ActionOutcome_actionType_idx" ON "ActionOutcome"("actionType");

-- CreateIndex
CREATE INDEX "ActionOutcome_timestamp_idx" ON "ActionOutcome"("timestamp");

-- CreateIndex
CREATE INDEX "ActionOutcome_userId_timestamp_idx" ON "ActionOutcome"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "SuccessPattern_userId_idx" ON "SuccessPattern"("userId");

-- CreateIndex
CREATE INDEX "SuccessPattern_sequenceHash_idx" ON "SuccessPattern"("sequenceHash");

-- CreateIndex
CREATE UNIQUE INDEX "SuccessPattern_userId_sequenceHash_key" ON "SuccessPattern"("userId", "sequenceHash");

-- CreateIndex
CREATE INDEX "FailurePattern_userId_idx" ON "FailurePattern"("userId");

-- CreateIndex
CREATE INDEX "FailurePattern_sequenceHash_idx" ON "FailurePattern"("sequenceHash");

-- CreateIndex
CREATE UNIQUE INDEX "FailurePattern_userId_sequenceHash_key" ON "FailurePattern"("userId", "sequenceHash");

-- CreateIndex
CREATE INDEX "ErrorRecoveryMap_userId_idx" ON "ErrorRecoveryMap"("userId");

-- CreateIndex
CREATE INDEX "ErrorRecoveryMap_errorType_idx" ON "ErrorRecoveryMap"("errorType");

-- CreateIndex
CREATE UNIQUE INDEX "ErrorRecoveryMap_userId_errorType_recoveryStrategy_key" ON "ErrorRecoveryMap"("userId", "errorType", "recoveryStrategy");

-- CreateIndex
CREATE INDEX "UserPreference_userId_idx" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_preferenceKey_key" ON "UserPreference"("userId", "preferenceKey");

-- CreateIndex
CREATE INDEX "AdaptiveStrategy_userId_idx" ON "AdaptiveStrategy"("userId");

-- CreateIndex
CREATE INDEX "AdaptiveStrategy_taskType_idx" ON "AdaptiveStrategy"("taskType");

-- CreateIndex
CREATE UNIQUE INDEX "AdaptiveStrategy_userId_taskType_key" ON "AdaptiveStrategy"("userId", "taskType");

-- CreateIndex
CREATE UNIQUE INDEX "LearningSession_sessionId_key" ON "LearningSession"("sessionId");

-- CreateIndex
CREATE INDEX "LearningSession_userId_idx" ON "LearningSession"("userId");

-- CreateIndex
CREATE INDEX "LearningMetricsHistory_userId_idx" ON "LearningMetricsHistory"("userId");

-- CreateIndex
CREATE INDEX "LearningMetricsHistory_userId_timestamp_idx" ON "LearningMetricsHistory"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "DatasetLearning_userId_idx" ON "DatasetLearning"("userId");

-- CreateIndex
CREATE INDEX "DatasetLearning_datasetName_idx" ON "DatasetLearning"("datasetName");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetLearning_userId_datasetName_key" ON "DatasetLearning"("userId", "datasetName");
