import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('products')
@Controller('products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @ApiOperation({ summary: 'Créer un produit' })
    @ApiResponse({ status: 201, description: 'Produit créé avec succès' })
    @ApiResponse({ status: 400, description: 'Données invalides' })
    @ApiBearerAuth()
    @UseGuards(AuthGuard('jwt'))
    @Post()
    create(@Body() createProductDto: CreateProductDto) {
        return this.productsService.create(createProductDto);
    }

    @ApiOperation({ summary: 'Lister tous les produits' })
    @ApiResponse({ status: 200, description: 'Liste des produits' })
    @Get()
    findAll() {
        return this.productsService.findAll();
    }
}
