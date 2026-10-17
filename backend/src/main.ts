import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow larger payloads for printer settings (e.g., base64 logo uploads)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // CORS
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3002',
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy: Origin not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // API prefix
  app.setGlobalPrefix('api');

  // Seed admin user on start
  try {
    const usersService = app.get(UsersService);
    await usersService.seedAdmin();
    console.log('✅ Admin user seeded (username: admin / password: admin123)');
  } catch (e) {
    console.error('Seed error:', e.message);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Restaurant API running on http://localhost:${port}/api`);
  console.log(`🔌 WebSocket ready on ws://localhost:${port}`);
}

bootstrap();
