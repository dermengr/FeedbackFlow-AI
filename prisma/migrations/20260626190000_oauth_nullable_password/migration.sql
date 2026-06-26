-- Allow OAuth users (Google) without a local password.
ALTER TABLE "users" ALTER COLUMN "hashedPassword" DROP NOT NULL;