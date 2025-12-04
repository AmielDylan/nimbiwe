import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, Min, Max, Length, Matches, IsDateString, IsUUID } from 'class-validator';
import { Unit } from '@prisma/client';

export class SyncEntryDto {
    @ApiProperty({ example: 'mobile-uuid-12345', description: 'ID client unique pour idempotence' })
    @IsString()
    clientId: string;

    @ApiProperty({ example: '770e8400-e29b-41d4-a716-446655440002', description: 'ID de l\'agent' })
    @IsUUID()
    agentId: string;

    @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ID du produit' })
    @IsUUID()
    productId: string;

    @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440001', description: 'ID du marché' })
    @IsUUID()
    marketId: string;

    @ApiProperty({ enum: Unit, example: Unit.kg, description: 'Unité de mesure' })
    @IsEnum(Unit)
    unit: Unit;

    @ApiProperty({ example: 1500, description: 'Prix', minimum: 1 })
    @IsNumber()
    @Min(1)
    priceValue: number;

    @ApiProperty({ example: 'XOF', description: 'Code devise ISO 4217', minLength: 3, maxLength: 3 })
    @IsString()
    @Length(3, 3)
    @Matches(/^[A-Z]{3}$/, { message: 'Currency must be a 3-letter uppercase ISO code' })
    currency: string;

    @ApiPropertyOptional({ example: 'https://storage.example.com/photo.jpg', description: 'URL de la photo' })
    @IsString()
    @IsOptional()
    photoUrl?: string;

    @ApiProperty({ example: 6.3654, description: 'Latitude', minimum: -90, maximum: 90 })
    @IsNumber()
    @Min(-90)
    @Max(90)
    lat: number;

    @ApiProperty({ example: 2.4183, description: 'Longitude', minimum: -180, maximum: 180 })
    @IsNumber()
    @Min(-180)
    @Max(180)
    lon: number;

    @ApiProperty({ example: '2025-12-04T10:00:00Z', description: 'Date et heure de capture' })
    @IsDateString()
    capturedAt: string;
}
