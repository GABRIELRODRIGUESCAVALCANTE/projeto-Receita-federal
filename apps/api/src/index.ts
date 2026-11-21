import { appConfig } from './config.js';
import { buildApp } from './server.js';

const app = buildApp({ logger: true });

app
  .listen({ port: appConfig.port, host: appConfig.host })
  .then(() => {
    app.log.info(`RTC Studio API rodando em http://localhost:${appConfig.port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

