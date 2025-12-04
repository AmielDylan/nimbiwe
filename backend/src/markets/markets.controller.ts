import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MarketsService } from './markets.service';
import { CreateMarketDto } from './dto/create-market.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('markets')
@Controller('markets')
export class MarketsController {
    constructor(private readonly marketsService: MarketsService) { }

    @ApiOperation({ summary: 'Créer un marché avec coordonnées GPS' })
    @ApiResponse({ status: 201, description: 'Marché créé avec succès' })
    @ApiResponse({ status: 400, description: 'Données invalides' })
    @ApiBearerAuth()
    @UseGuards(AuthGuard('jwt'))
    @Post()
    create(@Body() createMarketDto: CreateMarketDto) {
        return this.marketsService.create(createMarketDto);
    }

    @ApiOperation({ summary: 'Lister tous les marchés' })
    @ApiResponse({ status: 200, description: 'Liste des marchés' })
    @Get()
    findAll() {
        return this.marketsService.findAll();
    }
}
