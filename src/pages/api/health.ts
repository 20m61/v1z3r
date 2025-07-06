import type { NextApiRequest, NextApiResponse } from 'next';

type HealthData = {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthData>
) {
  try {
    const memoryUsage = process.memoryUsage();
    const memoryUsed = memoryUsage.heapUsed;
    const memoryTotal = memoryUsage.heapTotal;
    
    const healthData: HealthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0',
      memory: {
        used: Math.round(memoryUsed / 1024 / 1024), // MB
        total: Math.round(memoryTotal / 1024 / 1024), // MB
        percentage: Math.round((memoryUsed / memoryTotal) * 100)
      }
    };

    res.status(200).json(healthData);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '0.1.0',
      memory: {
        used: 0,
        total: 0,
        percentage: 0
      }
    });
  }
}