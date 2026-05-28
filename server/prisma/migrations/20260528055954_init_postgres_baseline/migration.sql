-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "wx_openid" TEXT,
    "wx_unionid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nickname" TEXT,
    "avatar_url" TEXT,
    "bio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "auto_save_draft" BOOLEAN NOT NULL DEFAULT true,
    "keep_photo_mood" BOOLEAN NOT NULL DEFAULT true,
    "private_mode" BOOLEAN NOT NULL DEFAULT true,
    "diary_reminder" BOOLEAN NOT NULL DEFAULT false,
    "generation_reminder" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comic_books" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '我的漫画日记',
    "description" TEXT,
    "cover_image_url" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comic_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_quotas" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_quota" INTEGER NOT NULL DEFAULT 0,
    "used_quota" INTEGER NOT NULL DEFAULT 0,
    "remaining_quota" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_profiles" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "nickname" TEXT,
    "role_title" TEXT,
    "description" TEXT,
    "personality_text" TEXT,
    "appearance_text" TEXT,
    "reference_image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_entries" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "chapter_title" TEXT,
    "diary_date" TIMESTAMP(3),
    "diary_text" TEXT,
    "page_count" INTEGER NOT NULL DEFAULT 4,
    "page_mode" TEXT,
    "selected_tags_json" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "diary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diary_photos" (
    "id" TEXT NOT NULL,
    "diary_entry_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "original_name" TEXT,
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "diary_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_tasks" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "diary_entry_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "task_type" TEXT NOT NULL DEFAULT 'diary_to_comic',
    "prompt_snapshot" TEXT,
    "input_json" TEXT NOT NULL DEFAULT '{}',
    "result_json" TEXT,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "generation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_wx_openid_key" ON "users"("wx_openid");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE INDEX "comic_books_owner_user_id_idx" ON "comic_books"("owner_user_id");

-- CreateIndex
CREATE INDEX "comic_books_owner_user_id_sort_order_idx" ON "comic_books"("owner_user_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "user_quotas_user_id_key" ON "user_quotas"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_profiles_owner_user_id_key" ON "character_profiles"("owner_user_id");

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

-- CreateIndex
CREATE INDEX "generation_tasks_owner_user_id_idx" ON "generation_tasks"("owner_user_id");

-- CreateIndex
CREATE INDEX "generation_tasks_owner_user_id_status_idx" ON "generation_tasks"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "generation_tasks_diary_entry_id_idx" ON "generation_tasks"("diary_entry_id");

-- CreateIndex
CREATE INDEX "generation_tasks_created_at_idx" ON "generation_tasks"("created_at");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comic_books" ADD CONSTRAINT "comic_books_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_quotas" ADD CONSTRAINT "user_quotas_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_profiles" ADD CONSTRAINT "character_profiles_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_photos" ADD CONSTRAINT "diary_photos_diary_entry_id_fkey" FOREIGN KEY ("diary_entry_id") REFERENCES "diary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary_photos" ADD CONSTRAINT "diary_photos_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_tasks" ADD CONSTRAINT "generation_tasks_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_tasks" ADD CONSTRAINT "generation_tasks_diary_entry_id_fkey" FOREIGN KEY ("diary_entry_id") REFERENCES "diary_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
