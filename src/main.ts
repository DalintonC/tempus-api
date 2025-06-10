import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    // Security middleware
    app.use(
      helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: {
          directives: {
            imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
            scriptSrc: [`'self'`],
            manifestSrc: [`'self'`],
            frameSrc: [`'self'`],
          },
        },
      }),
    );

    app.use(compression());

    // CORS configuration
    app.enableCors({
      origin: configService.get<string>('app.frontendUrl')?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    });

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Global prefix
    app.setGlobalPrefix('api/v1');

    // API documentation
    const config = new DocumentBuilder()
      .setTitle('Tempus API')
      .setDescription('API Documentation')
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Authentication', 'User authentication and profile management')
      .build();

    if (process.env.NODE_ENV !== 'production') {
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: {
          persistAuthorization: true,
        },
      });
    }

    // Start server
    const port = configService.get<number>('app.port') || 3000;
    await app.listen(port);

    logger.log(`🚀 Server running on port ${port}`);
    logger.log(`📚 API Documentation available at http://localhost:${port}/api/docs`);
    logger.log(`🌍 Environment: ${configService.get<string>('app.environment')}`);
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('Error during application bootstrap:', error);
});
