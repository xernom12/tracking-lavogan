import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

let queryClient: postgres.Sql | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;
let schemaReadyPromise: Promise<void> | null = null;

export const isDatabaseConfigured = () => Boolean(process.env.DATABASE_URL?.trim());

export const getDb = () => {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL belum dikonfigurasi.");
  }

  if (!queryClient) {
    queryClient = postgres(process.env.DATABASE_URL as string, {
      max: 1,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 15,
    });
  }

  if (!dbInstance) {
    dbInstance = drizzle(queryClient);
  }

  return dbInstance;
};

export const ensureSchemaReady = async () => {
  if (schemaReadyPromise) {
    await schemaReadyPromise;
    return;
  }

  schemaReadyPromise = (async () => {
    const db = getDb();
    await db.execute(sql`
      create table if not exists submission_snapshots (
        id varchar(64) primary key,
        submission_number varchar(120) not null unique,
        submission_type varchar(32) not null,
        organization_name varchar(255) not null,
        nib varchar(32) not null,
        kbli varchar(16) not null,
        oss_status varchar(120) not null,
        license_issued boolean not null default false,
        license_status varchar(32) not null default '',
        last_updated_label varchar(120) not null,
        payload jsonb not null,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);

    await db.execute(sql`
      create index if not exists submission_snapshots_organization_idx
      on submission_snapshots (organization_name);
    `);
    await db.execute(sql`
      create index if not exists submission_snapshots_nib_idx
      on submission_snapshots (nib);
    `);
    await db.execute(sql`
      create index if not exists submission_snapshots_status_idx
      on submission_snapshots (oss_status);
    `);
    await db.execute(sql`
      create index if not exists submission_snapshots_updated_idx
      on submission_snapshots (updated_at desc);
    `);
  })();

  await schemaReadyPromise;
};
