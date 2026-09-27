import { buildApp } from './app.js';
import config from './config/index.js';
import { installShutdown } from './utils/shutdown.js';

async function start() {
  let app;

  try {
    app = await buildApp();
    installShutdown(app);
    // 서버 시작
    await app.listen({
      port: config.server.port,
      host: config.server.host,
    });

    // 모든 봇 스케줄 시작
    await app.scheduler.startAll();

    app.log.info(`서버 시작: http://${config.server.host}:${config.server.port}`);
  } catch (err) {
    if (app) { app.log.error(err); await app.close().catch(() => {}); }
    else console.error(err);
    process.exit(1);
  }
}

start();
