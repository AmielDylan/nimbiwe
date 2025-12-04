import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';
import { ValidationDecision } from '@prisma/client';

export class ValidateEntryDto {
    @ApiProperty({ enum: ValidationDecision, example: ValidationDecision.validated, description: 'Décision de validation' })
    @IsEnum(ValidationDecision)
    decision: ValidationDecision;

    @ApiPropertyOptional({ example: 'Prix cohérent avec le marché', description: 'Raison de la décision' })
    @IsString()
    @IsOptional()
    reason?: string;
}
