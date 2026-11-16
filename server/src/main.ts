import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './common/config';
import { store } from './common/store';

async function bootstrap() {
  await store.init();
  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: true, credentials: true });
  await app.listen(config.port);
  console.log(`精灵物语后端已启动: http://localhost:${config.port} (存储模式: ${config.storage})`);
}
bootstrap();
