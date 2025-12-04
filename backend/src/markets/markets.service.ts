import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMarketDto } from './dto/create-market.dto';

@Injectable()
export class MarketsService {
    constructor(private prisma: PrismaService) { }

    async create(createMarketDto: CreateMarketDto) {
        const { name, city, lat, lon } = createMarketDto;

        // Insert with PostGIS geometry
        await this.prisma.$executeRaw`
      INSERT INTO markets (id, name, city, location, created_at, updated_at)
      VALUES (gen_random_uuid(), ${name}, ${city}, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), NOW(), NOW())
    `;

        return this.prisma.market.findFirst({
            where: { name },
            orderBy: { createdAt: 'desc' }
        });
    }

    async findAll() {
        return this.prisma.market.findMany();
    }
}
