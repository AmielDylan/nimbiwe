import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateAgentDto {
    @ApiProperty({ example: 'Jean Dupont', description: 'Nom complet' })
    @IsString()
    name: string;

    @ApiProperty({ example: '+22997123456', description: 'Numéro de téléphone' })
    @IsString()
    phone: string;

    @ApiPropertyOptional({ enum: Role, example: Role.AGENT, description: 'Rôle de l\'agent' })
    @IsEnum(Role)
    @IsOptional()
    role?: Role;
}
