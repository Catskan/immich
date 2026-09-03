import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE "album_user" ADD COLUMN IF NOT EXISTS "showInTimeline" boolean NOT NULL DEFAULT false;`.execute(
    db,
  );
  await sql`CREATE INDEX IF NOT EXISTS "IDX_album_user_show_in_timeline" ON "album_user" ("userId") WHERE "showInTimeline" = true;`.execute(
    db,
  );
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP INDEX IF EXISTS "IDX_album_user_show_in_timeline";`.execute(db);
  await sql`ALTER TABLE "album_user" DROP COLUMN IF EXISTS "showInTimeline";`.execute(db);
}
