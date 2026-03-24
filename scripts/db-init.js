const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const products = require('../data/products-seed');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

function quoteIdentifier(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

async function ensureDatabaseExists(connectionString) {
  const targetUrl = new URL(connectionString);
  const targetDbName = targetUrl.pathname.replace(/^\//, '');
  if (!targetDbName) {
    throw new Error('DATABASE_URL must include database name');
  }

  const adminUrl = new URL(connectionString);
  adminUrl.pathname = '/postgres';

  const adminPool = new Pool({ connectionString: adminUrl.toString() });
  const adminClient = await adminPool.connect();

  try {
    const existsResult = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDbName]
    );

    if (!existsResult.rowCount) {
      await adminClient.query(`CREATE DATABASE ${quoteIdentifier(targetDbName)}`);
      console.log(`Database created: ${targetDbName}`);
    }
  } finally {
    adminClient.release();
    await adminPool.end();
  }
}

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  await ensureDatabaseExists(connectionString);

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(schemaSql);

    for (const product of products) {
      await client.query(
        `
        INSERT INTO products (id, name, short_description, description, specs, price, image, is_featured)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE
        SET
          name = EXCLUDED.name,
          short_description = EXCLUDED.short_description,
          description = EXCLUDED.description,
          specs = EXCLUDED.specs,
          price = EXCLUDED.price,
          image = EXCLUDED.image,
          is_featured = EXCLUDED.is_featured
        `,
        [
          product.id,
          product.name,
          product.shortDescription,
          JSON.stringify(product.description),
          JSON.stringify(product.specs),
          product.price,
          product.image,
          product.isFeatured
        ]
      );
    }

    await client.query(
      `
      INSERT INTO reviews (author, content, rating, is_published)
      VALUES
        ('Алексей, Подмосковье', 'Подобрали котёл под дом 140 м², расход газа стал ниже.', 5, true),
        ('Марина, Тверь', 'Доставка быстрая, монтаж прошёл без проблем.', 5, true),
        ('Игорь, Калуга', 'Для производства подошёл отлично, работает стабильно.', 5, true)
      ON CONFLICT DO NOTHING
      `
    );

    await client.query('COMMIT');
    console.log('Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(error => {
  console.error('Database init failed:', error.message);
  process.exit(1);
});
