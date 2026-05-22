-- CreateTable
CREATE TABLE "character_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner_user_id" TEXT NOT NULL,
    "nickname" TEXT,
    "role_title" TEXT,
    "description" TEXT,
    "personality_text" TEXT,
    "appearance_text" TEXT,
    "reference_image_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "character_profiles_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "character_profiles_owner_user_id_key" ON "character_profiles"("owner_user_id");
