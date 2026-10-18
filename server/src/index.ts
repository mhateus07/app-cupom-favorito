import { construirApp } from './app.js';
import { lerConfig } from './config.js';
import { criarPool, migrar } from './db.js';
import { criarEnvioEmail } from './email.js';

const config = lerConfig();
const pool = criarPool(config.databaseUrl);

const aplicadas = await migrar(pool);
if (aplicadas.length) console.log(`Migrações aplicadas: ${aplicadas.join(', ')}`);

const app = await construirApp(config, pool, criarEnvioEmail(config));
await app.listen({ host: '0.0.0.0', port: config.porta });

const encerrar = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGTERM', encerrar);
process.on('SIGINT', encerrar);
