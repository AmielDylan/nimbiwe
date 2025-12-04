import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @ApiOperation({ summary: 'Demander un code OTP' })
    @ApiResponse({ status: 200, description: 'OTP envoyé avec succès' })
    @ApiResponse({ status: 429, description: 'Trop de requêtes' })
    @Throttle({ default: { limit: 5, ttl: 3600000 } })
    @Post('login')
    async login(@Body('phone') phone: string) {
        return this.authService.login(phone);
    }

    @ApiOperation({ summary: 'Vérifier le code OTP et obtenir les tokens' })
    @ApiResponse({ status: 200, description: 'Tokens générés avec succès' })
    @ApiResponse({ status: 401, description: 'OTP invalide ou expiré' })
    @ApiResponse({ status: 429, description: 'Trop de requêtes' })
    @Throttle({ default: { limit: 5, ttl: 3600000 } })
    @Post('verify')
    async verify(@Body('phone') phone: string, @Body('otp') otp: string) {
        return this.authService.verify(phone, otp);
    }

    @ApiOperation({ summary: 'Rafraîchir l\'access token' })
    @ApiResponse({ status: 200, description: 'Nouveaux tokens générés' })
    @ApiResponse({ status: 401, description: 'Refresh token invalide' })
    @ApiResponse({ status: 429, description: 'Trop de requêtes' })
    @Throttle({ default: { limit: 10, ttl: 3600000 } })
    @Post('refresh')
    async refresh(@Body('refresh_token') refreshToken: string) {
        return this.authService.refresh(refreshToken);
    }
}
