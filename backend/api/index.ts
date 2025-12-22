// Simple test endpoint first - no NestJS complexity
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Simple router
  const url = req.url || '/';

  if (url === '/health/ping' || url === '/health') {
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Vercel serverless function is working!'
    });
  }

  if (url === '/api/drivers' && req.method === 'GET') {
    return res.status(200).json({
      drivers: [],
      message: 'Drivers endpoint working - database integration pending'
    });
  }

  return res.status(404).json({
    error: 'Not Found',
    url: url,
    method: req.method,
    message: 'Endpoint not implemented yet'
  });
}
