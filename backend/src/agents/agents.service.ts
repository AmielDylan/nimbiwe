import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AgentsService {
    constructor(private prisma: PrismaService) { }

    create(data: Prisma.AgentCreateInput) {
        return this.prisma.agent.create({ data });
    }

    findAll() {
        return this.prisma.agent.findMany();
    }
}
