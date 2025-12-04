import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EntriesService } from './entries.service';
import { SyncEntryDto } from './dto/sync-entry.dto';
import { ValidateEntryDto } from './dto/validate-entry.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('sync', 'admin')
@Controller()
export class EntriesController {
    constructor(private readonly entriesService: EntriesService) { }

    @ApiTags('sync')
    @ApiOperation({ summary: 'Synchroniser des saisies de prix depuis mobile (idempotent)' })
    @ApiResponse({
        status: 201,
        description: 'Saisies traitées',
        schema: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    client_id: { type: 'string' },
                    status: { type: 'string', enum: ['accepted', 'rejected', 'duplicate', 'limit_exceeded'] },
                    reason: { type: 'string' },
                    id: { type: 'string' },
                },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Données invalides' })
    @ApiResponse({ status: 401, description: 'Non authentifié' })
    @ApiBearerAuth()
    @UseGuards(AuthGuard('jwt'))
    @Post('sync/entries')
    async syncEntries(@Body() entries: SyncEntryDto[]) {
        return await this.entriesService.syncEntries(entries);
    }

    @ApiTags('admin')
    @ApiOperation({ summary: 'Lister les saisies en attente de validation' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiResponse({ status: 200, description: 'Liste des saisies' })
    @ApiBearerAuth()
    @UseGuards(AuthGuard('jwt'))
    @Roles(Role.ADMIN)
    @Get('admin/entries')
    async getPendingEntries(@Query('page') page: number, @Query('limit') limit: number) {
        return this.entriesService.getPendingEntries(Number(page) || 1, Number(limit) || 10);
    }

    @ApiTags('admin')
    @ApiOperation({ summary: 'Valider ou rejeter une saisie' })
    @ApiResponse({ status: 200, description: 'Saisie validée/rejetée' })
    @ApiResponse({ status: 404, description: 'Saisie non trouvée' })
    @ApiBearerAuth()
    @UseGuards(AuthGuard('jwt'))
    @Roles(Role.ADMIN)
    @Post('admin/entries/:id/validate')
    async validateEntry(
        @Param('id') id: string,
        @Body() validateEntryDto: ValidateEntryDto,
    ) {
        // Note: adminId should come from JWT token in production
        const adminId = 'admin-from-jwt'; // TODO: Extract from req.user

        return this.entriesService.validateEntry(
            id,
            validateEntryDto.decision,
            validateEntryDto.reason,
            adminId,
        );
    }
}
