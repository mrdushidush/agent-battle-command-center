-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "language" VARCHAR(20) NOT NULL DEFAULT 'python',
    "status" VARCHAR(30) NOT NULL DEFAULT 'decomposing',
    "conversation_id" TEXT,
    "auto_approve" BOOLEAN NOT NULL DEFAULT false,
    "plan" JSONB,
    "subtask_count" INTEGER NOT NULL DEFAULT 0,
    "completed_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "review_result" JSONB,
    "review_score" DOUBLE PRECISION,
    "total_cost" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "total_time_ms" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add mission_id to tasks
ALTER TABLE "tasks" ADD COLUMN "mission_id" TEXT;

-- CreateIndex
CREATE INDEX "missions_status_idx" ON "missions"("status");
CREATE INDEX "missions_conversation_id_idx" ON "missions"("conversation_id");
CREATE INDEX "tasks_mission_id_idx" ON "tasks"("mission_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
