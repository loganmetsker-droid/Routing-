// Vercel Serverless Function Handler for NestJS
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';

const expressApp = express();
const adapter = new ExpressAdapter(expressApp);
let app: any;

async function getApp() {
  if (!app) {
    app = await NestFactory.create(AppModule, adapter, {
      logger: false, // Disable logging in serverless
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
        disableErrorMessages: false,
      }),
    );

    app.enableCors({
      origin: '*',
      credentials: true,
    });

    await app.init();
  }
  return expressApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const server = await getApp();
  server(req, res);
}
