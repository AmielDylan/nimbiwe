import { Body, Controller, Get, Post } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { Prisma } from '@prisma/client';

@Controller('agents')
export class AgentsController {
    constructor(private readonly agentsService: AgentsService) { }

    @Post()
    create(@Body() data: Prisma.AgentCreateInput) {
        return this.agentsService.create(data);
    }

    @Get()
    findAll() {
        return this.agentsService.findAll();
    }
}
