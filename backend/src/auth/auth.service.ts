import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private prisma: PrismaService,
        private jwtService: JwtService,
    ) { }

    async login(phone: string) {
        // Generate 6-digit OTP
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Invalidate any existing unused OTPs for this phone
        await this.prisma.otp.updateMany({
            where: {
                phone,
                used: false,
                expiresAt: { gt: new Date() },
            },
            data: { used: true },
        });

        // Create new OTP with 5 minutes expiration
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 5);

        await this.prisma.otp.create({
            data: {
                phone,
                code,
                expiresAt,
            },
        });

        console.log(`OTP for ${phone}: ${code}`); // Log for dev (remove in production)
        return { message: 'OTP sent', expiresIn: 300 }; // 300 seconds = 5 minutes
    }

    async verify(phone: string, code: string) {
        // Find valid OTP
        const otp = await this.prisma.otp.findFirst({
            where: {
                phone,
                code,
                used: false,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!otp) {
            throw new UnauthorizedException('Invalid or expired OTP');
        }

        // Mark OTP as used
        await this.prisma.otp.update({
            where: { id: otp.id },
            data: { used: true },
        });

        // Find or create user
        let user = await this.prisma.agent.findUnique({ where: { phone } });
        if (!user) {
            user = await this.prisma.agent.create({
                data: {
                    phone,
                    name: 'New Agent', // Should be updated by user
                },
            });
        }

        // Generate tokens
        const tokens = await this.generateTokens(user.id, user.role);

        return tokens;
    }

    async refresh(refreshToken: string) {
        try {
            // Verify refresh token
            const payload = this.jwtService.verify(refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET || 'refreshSecretKey',
            });

            // Check if token exists and is not revoked
            const tokenHash = await bcrypt.hash(refreshToken, 10);
            const storedToken = await this.prisma.refreshToken.findFirst({
                where: {
                    agentId: payload.sub,
                    revoked: false,
                    expiresAt: { gt: new Date() },
                },
                orderBy: { createdAt: 'desc' },
            });

            if (!storedToken) {
                throw new UnauthorizedException('Invalid refresh token');
            }

            // Revoke old token (rotation)
            await this.prisma.refreshToken.update({
                where: { id: storedToken.id },
                data: { revoked: true },
            });

            // Generate new tokens
            const tokens = await this.generateTokens(payload.sub, payload.role);

            return tokens;
        } catch (error) {
            throw new UnauthorizedException('Invalid refresh token');
        }
    }

    private async generateTokens(userId: string, role: string) {
        const payload = { sub: userId, role };

        const accessToken = this.jwtService.sign(payload, {
            secret: process.env.JWT_SECRET || 'secretKey',
            expiresIn: '15m', // Short-lived access token
        });

        const refreshToken = this.jwtService.sign(payload, {
            secret: process.env.JWT_REFRESH_SECRET || 'refreshSecretKey',
            expiresIn: '7d', // Long-lived refresh token
        });

        // Store refresh token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await this.prisma.refreshToken.create({
            data: {
                agentId: userId,
                token: await bcrypt.hash(refreshToken, 10),
                expiresAt,
            },
        });

        return {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: 900, // 15 minutes in seconds
        };
    }

    async revokeAllTokens(userId: string) {
        await this.prisma.refreshToken.updateMany({
            where: { agentId: userId, revoked: false },
            data: { revoked: true },
        });
    }
}
