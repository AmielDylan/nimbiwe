import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, Min, Max } from 'class-validator';

export class CreateMarketDto {
    @ApiProperty({ example: 'Marché Dantokpa', description: 'Nom du marché' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'Cotonou', description: 'Ville' })
    @IsString()
    city: string;

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
}
