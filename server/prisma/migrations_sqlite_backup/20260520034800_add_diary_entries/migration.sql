-- CreateTable
CREATE TABLE "diary_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner_user_id" TEXT NOT NULL,
    "chapter_title" TEXT,
    "diary_date" DATETIME,
    "diary_text" TEXT,
    "page_count" INTEGER NOT NULL DEFAULT 4,
    "page_mode" TEXT,
    "selected_tags_json" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "diary_entries_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "diary_photos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "diary_entry_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "original_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "deleted_at" DATETIME,
    CONSTRAINT "diary_photos_diary_entry_id_fkey" FOREIGN KEY ("diary_entry_id") REFERENCES "diary_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "diary_photos_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "diary_entries_owner_user_id_idx" ON "diary_entries"("owner_user_id");

-- CreateIndex
CREATE INDEX "diary_entries_owner_user_id_status_idx" ON "diary_entries"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "diary_entries_owner_user_id_diary_date_idx" ON "diary_entries"("owner_user_id", "diary_date");

-- CreateIndex
CREATE INDEX "diary_entries_owner_user_id_created_at_idx" ON "diary_entries"("owner_user_id", "created_at");

-- CreateIndex
CREATE INDEX "diary_photos_diary_entry_id_idx" ON "diary_photos"("diary_entry_id");

-- CreateIndex
CREATE INDEX "diary_photos_owner_user_id_idx" ON "diary_photos"("owner_user_id");

-- CreateIndex
CREATE INDEX "diary_photos_diary_entry_id_sort_order_idx" ON "diary_photos"("diary_entry_id", "sort_order");
