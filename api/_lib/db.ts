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
      create table if not exists admins (
        id varchar(64) primary key,
        email varchar(255) not null unique,
        password_hash varchar(255) not null,
        full_name varchar(255),
        is_active boolean not null default true,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    `);
    await db.execute(sql`
      alter table admins
      add column if not exists password_hash varchar(255);
    `);
    await db.execute(sql`
      alter table admins
      add column if not exists full_name varchar(255);
    `);
    await db.execute(sql`
      alter table admins
      add column if not exists is_active boolean not null default true;
    `);
    await db.execute(sql`
      alter table admins
      add column if not exists created_at timestamptz not null default now();
    `);
    await db.execute(sql`
      alter table admins
      add column if not exists updated_at timestamptz not null default now();
    `);
    await db.execute(sql`
      create index if not exists admins_email_idx
      on admins (email);
    `);

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

    await db.execute(sql`
      create table if not exists audit_logs (
        id varchar(64) primary key,
        actor varchar(255) not null,
        action varchar(120) not null,
        target_type varchar(64) not null,
        target_id varchar(120) not null default '',
        ip_address varchar(64) not null default 'unknown',
        user_agent varchar(500) not null default '',
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
    `);
    await db.execute(sql`
      create index if not exists audit_logs_actor_idx
      on audit_logs (actor);
    `);
    await db.execute(sql`
      create index if not exists audit_logs_action_idx
      on audit_logs (action);
    `);
    await db.execute(sql`
      create index if not exists audit_logs_target_idx
      on audit_logs (target_type, target_id);
    `);
    await db.execute(sql`
      create index if not exists audit_logs_created_idx
      on audit_logs (created_at desc);
    `);
  })();

  await schemaReadyPromise;
};
