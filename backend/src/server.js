import { buildApp } from './app.js';
import config from './config/index.js';

async function start() {
  const app = await buildApp();

  try {
    // 서버 시작
    await app.listen({
      port: config.server.port,
      host: config.server.host,
    });

    // 모든 봇 스케줄 시작
    await app.scheduler.startAll();

    app.log.info(`서버 시작: http://${config.server.host}:${config.server.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
