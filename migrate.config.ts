
const config = {
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/ocelot',
  dir: 'migrations',
  direction: 'up',
  migrationsTable: 'pgmigrations',
  verbose: true,
  noLock: false,
};

export default config;

