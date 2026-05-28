-- CreateTable
CREATE TABLE "generation_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner_user_id" TEXT NOT NULL,
    "diary_entry_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "task_type" TEXT NOT NULL DEFAULT 'diary_to_comic',
    "prompt_snapshot" TEXT,
    "input_json" TEXT NOT NULL DEFAULT '{}',
    "result_json" TEXT,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" DATETIME,
    "finished_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "generation_tasks_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "generation_tasks_diary_entry_id_fkey" FOREIGN KEY ("diary_entry_id") REFERENCES "diary_entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "generation_tasks_owner_user_id_idx" ON "generation_tasks"("owner_user_id");

-- CreateIndex
CREATE INDEX "generation_tasks_owner_user_id_status_idx" ON "generation_tasks"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "generation_tasks_diary_entry_id_idx" ON "generation_tasks"("diary_entry_id");

-- CreateIndex
CREATE INDEX "generation_tasks_created_at_idx" ON "generation_tasks"("created_at");
