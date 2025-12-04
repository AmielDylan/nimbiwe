import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ArrayMinSize } from 'class-validator';

export class CreateProductDto {
    @ApiProperty({ example: 'Tomate', description: 'Nom du produit' })
    @IsString()
    name: string;

    @ApiPropertyOptional({ example: 'Légumes', description: 'Catégorie du produit' })
    @IsString()
    @IsOptional()
    category?: string;

    @ApiProperty({ example: ['kg', 'basket'], description: 'Unités autorisées', type: [String] })
    @IsArray()
    @ArrayMinSize(1)
    @IsString({ each: true })
    unitsAllowed: string[];
}
