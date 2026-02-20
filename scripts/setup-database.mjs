#!/usr/bin/env node

/**
 * Creates the database tables needed for Grok Creative Studio.
 * Run: npm run db:setup
 *
 * Requires DATABASE_URL to be set.
 */

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function setup() {
  console.log("Creating tables...");

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(255),
      name VARCHAR(255),
      avatar_url TEXT,
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  console.log("  ✓ users");

  await sql`
    CREATE TABLE IF NOT EXISTS generations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255),
      mode VARCHAR(10) NOT NULL DEFAULT 'image',
      prompt TEXT NOT NULL,
      aspect_ratio VARCHAR(10) NOT NULL DEFAULT '16:9',
      image_url TEXT,
      video_url TEXT,
      mux_asset_id VARCHAR(255),
      mux_playback_id VARCHAR(255),
      color VARCHAR(7),
      blur_data TEXT,
      run_id VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  console.log("  ✓ generations");

  // Indices
  await sql`CREATE INDEX IF NOT EXISTS idx_generations_user_created ON generations (user_id, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_generations_created ON generations (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_generations_run_id ON generations (run_id) WHERE run_id IS NOT NULL`;
  console.log("  ✓ indices");

  console.log("\n✅ Database setup complete!");
}

setup().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
