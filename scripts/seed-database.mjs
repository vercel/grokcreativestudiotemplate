#!/usr/bin/env node

/**
 * Seeds the database with sample generations from seed-data.
 * Run: npm run db:seed
 *
 * Requires DATABASE_URL to be set.
 * Run db:setup first to create the tables.
 */

import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const SEED_GENERATIONS = [
  { id: "seed-001", prompt: "A cyberpunk cityscape at night with neon lights reflecting off wet streets", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/001.png", color: "#1a0e2e" },
  { id: "seed-002", prompt: "A serene Japanese garden with cherry blossoms and a stone bridge", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/002.png", color: "#e8c4d8" },
  { id: "seed-003", prompt: "Portrait of a woman with flowers in her hair, soft lighting", aspect_ratio: "3:4", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/003.png", color: "#d4a574" },
  { id: "seed-004", prompt: "An astronaut floating above Earth with the sun rising behind", aspect_ratio: "1:1", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/004.png", color: "#0a1628" },
  { id: "seed-005", prompt: "A golden retriever running through autumn leaves in a park", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/005.png", color: "#c88b3a" },
  { id: "seed-006", prompt: "Abstract geometric art in vibrant blues and oranges", aspect_ratio: "1:1", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/006.png", color: "#2d5fa0" },
  { id: "seed-007", prompt: "A medieval castle on a cliff overlooking a misty valley", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/007.png", color: "#4a5568" },
  { id: "seed-008", prompt: "Underwater scene with colorful coral reef and tropical fish", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/008.png", color: "#0e4d6e" },
  { id: "seed-009", prompt: "A futuristic sports car driving through a neon tunnel", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/009.png", color: "#1e0a3c" },
  { id: "seed-010", prompt: "A cozy cabin in a snowy forest with warm light from windows", aspect_ratio: "4:3", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/010.png", color: "#2d3748" },
  { id: "seed-011", prompt: "A steaming cup of coffee on a rustic wooden table with morning light", aspect_ratio: "1:1", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/011.png", color: "#6b4226" },
  { id: "seed-012", prompt: "Northern lights aurora borealis over a frozen lake in Iceland", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/012.png", color: "#0b2e1e" },
  { id: "seed-013", prompt: "A cat sitting on a windowsill watching rain", aspect_ratio: "3:4", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/013.png", color: "#5a6b7c" },
  { id: "seed-014", prompt: "A dragon flying over a fantasy landscape with waterfalls", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/014.png", color: "#2a4858" },
  { id: "seed-015", prompt: "Minimalist still life with white flowers in a ceramic vase", aspect_ratio: "2:3", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/015.png", color: "#e8e0d4" },
  { id: "seed-016", prompt: "A bustling street market in Marrakech with spices and textiles", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/016.png", color: "#c46a2e" },
  { id: "seed-017", prompt: "A pixel art spaceship battle scene with explosions", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/017.png", color: "#0a0a2e" },
  { id: "seed-018", prompt: "A surreal Dali-inspired landscape with melting clocks", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/018.png", color: "#b89858" },
  { id: "seed-019", prompt: "A robot painting on a canvas in an art studio", aspect_ratio: "1:1", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/019.png", color: "#4a5060" },
  { id: "seed-020", prompt: "Sunset over the ocean with dramatic cloud formations", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/020.png", color: "#e87040" },
  { id: "seed-021", prompt: "A macro photograph of a dewdrop on a leaf", aspect_ratio: "1:1", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/021.png", color: "#2e6b3a" },
  { id: "seed-022", prompt: "A vintage train station with steam and golden hour light", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/022.png", color: "#8a7260" },
  { id: "seed-023", prompt: "An owl perched on a branch in a moonlit forest", aspect_ratio: "3:4", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/023.png", color: "#1a2030" },
  { id: "seed-024", prompt: "A colorful hot air balloon festival at sunrise", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/024.png", color: "#f0a860" },
  { id: "seed-025", prompt: "A neon sign reading OPEN in a rainy alleyway", aspect_ratio: "9:16", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/025.png", color: "#2a1040" },
  { id: "seed-026", prompt: "A mountain landscape with a crystal clear alpine lake", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/026.png", color: "#3a6890" },
  { id: "seed-027", prompt: "A cyberpunk samurai with glowing katana", aspect_ratio: "3:4", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/027.png", color: "#1a0030" },
  { id: "seed-028", prompt: "A field of sunflowers stretching to the horizon", aspect_ratio: "16:9", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/028.png", color: "#d4a020" },
  { id: "seed-029", prompt: "An ancient library with towering bookshelves and candles", aspect_ratio: "9:16", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/029.png", color: "#4a3020" },
  { id: "seed-030", prompt: "A bioluminescent deep sea creature in the dark ocean", aspect_ratio: "1:1", mode: "image", image_url: "https://w1ddfvelthbnqh3k.public.blob.vercel-storage.com/seed/030.png", color: "#0a1830" },
];

async function seed() {
  console.log("Seeding database with sample generations...");

  // Ensure template user exists
  await sql`
    INSERT INTO users (id, name, updated_at)
    VALUES ('template', 'Template', now())
    ON CONFLICT (id) DO NOTHING
  `;

  let inserted = 0;
  for (const gen of SEED_GENERATIONS) {
    try {
      await sql`
        INSERT INTO generations (id, user_id, mode, prompt, aspect_ratio, image_url, color, created_at)
        VALUES (${gen.id}, 'template', ${gen.mode}, ${gen.prompt}, ${gen.aspect_ratio}, ${gen.image_url}, ${gen.color}, now())
        ON CONFLICT (id) DO NOTHING
      `;
      inserted++;
    } catch (err) {
      console.error(`  ✗ ${gen.id}:`, err.message);
    }
  }

  console.log(`\n✅ Seeded ${inserted}/${SEED_GENERATIONS.length} generations`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
