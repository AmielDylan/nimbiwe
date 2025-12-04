import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
    constructor(private prisma: PrismaService) { }

    @ApiOperation({ summary: 'Health check endpoint' })
    @ApiResponse({
        status: 200,
        description: 'Service is healthy',
        schema: {
            type: 'object',
            properties: {
                status: { type: 'string', example: 'ok' },
                timestamp: { type: 'string' },
                database: { type: 'object' },
                postgis: { type: 'object' },
            },
        },
    })
    @Get()
    async check() {
        const timestamp = new Date().toISOString();

        // Check database connection
        let dbStatus = { connected: false, error: null };
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            dbStatus.connected = true;
        } catch (error) {
            dbStatus.error = error.message;
        }

        // Check PostGIS extension
        let postgisStatus = { available: false, version: null, error: null };
        try {
            const result = await this.prisma.$queryRaw<Array<{ extversion: string }>>`
        SELECT extversion FROM pg_extension WHERE extname = 'postgis'
      `;
            if (result.length > 0) {
                postgisStatus.available = true;
                postgisStatus.version = result[0].extversion;
            }
        } catch (error) {
            postgisStatus.error = error.message;
        }

        const isHealthy = dbStatus.connected && postgisStatus.available;

        return {
            status: isHealthy ? 'ok' : 'degraded',
            timestamp,
            database: dbStatus,
            postgis: postgisStatus,
        };
    }
}
