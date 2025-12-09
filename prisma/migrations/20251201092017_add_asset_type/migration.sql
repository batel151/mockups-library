-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "oem" TEXT NOT NULL,
    "screenType" TEXT NOT NULL,
    "assetType" TEXT NOT NULL DEFAULT 'Mockup',
    "description" TEXT,
    "format" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Asset" ("createdAt", "description", "filename", "format", "id", "name", "oem", "screenType", "size", "updatedAt", "url") SELECT "createdAt", "description", "filename", "format", "id", "name", "oem", "screenType", "size", "updatedAt", "url" FROM "Asset";
DROP TABLE "Asset";
ALTER TABLE "new_Asset" RENAME TO "Asset";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
