import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EntryStatus, ValidationDecision } from '@prisma/client';
import { LOGGER_KEY, PinoLogger } from 'nestjs-pino';
import { SyncEntryDto } from './dto/sync-entry.dto';

type SyncResponse = {
    clientId: string;
    status: 'accepted' | 'rejected' | 'duplicate' | 'limit_exceeded';
    reason?: string;
    id?: string;
};

@Injectable()
export class EntriesService {
    constructor(
        private prisma: PrismaService,
        @Inject(LOGGER_KEY) private readonly logger: PinoLogger,
    ) {
        this.logger.setContext(EntriesService.name);
    }

    async syncEntries(entries: SyncEntryDto[]): Promise<SyncResponse[]> {
        const results: SyncResponse[] = [];

        for (const entry of entries) {
            try {
                // 1. Check idempotence - if client_id already exists
                if (entry.clientId) {
                    const existing = await this.prisma.priceEntry.findUnique({
                        where: { clientId: entry.clientId },
                    });

                    if (existing) {
                        this.logger.info({
                            msg: 'Idempotent request - returning cached result',
                            clientId: entry.clientId,
                            existingId: existing.id,
                        });

                        results.push({
                            clientId: entry.clientId,
                            status: this.mapStatusToResponse(existing.status),
                            reason: 'Already processed',
                            id: existing.id,
                        });
                        continue;
                    }
                }

                // 2. Check daily limit (3 per day per agent/product/market)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const todayCount = await this.prisma.priceEntry.count({
                    where: {
                        agentId: entry.agentId,
                        productId: entry.productId,
                        marketId: entry.marketId,
                        capturedAt: {
                            gte: today,
                            lt: tomorrow,
                        },
                    },
                });

                if (todayCount >= 3) {
                    this.logger.warn({
                        msg: 'Daily limit exceeded',
                        clientId: entry.clientId,
                        agentId: entry.agentId,
                        productId: entry.productId,
                        marketId: entry.marketId,
                    });

                    results.push({
                        clientId: entry.clientId,
                        status: 'limit_exceeded',
                        reason: 'Daily limit reached (3 entries per day per agent/product/market)',
                    });
                    continue;
                }

                // 3. Create entry
                const created = await this.prisma.priceEntry.create({
                    data: {
                        clientId: entry.clientId,
                        agentId: entry.agentId,
                        productId: entry.productId,
                        marketId: entry.marketId,
                        unit: entry.unit,
                        priceValue: entry.priceValue,
                        currency: entry.currency,
                        photoUrl: entry.photoUrl,
                        lat: entry.lat,
                        lon: entry.lon,
                        capturedAt: new Date(entry.capturedAt),
                        status: EntryStatus.pending,
                    },
                });

                this.logger.info({
                    msg: 'Entry created',
                    clientId: entry.clientId,
                    entryId: created.id,
                    agentId: entry.agentId,
                });

                results.push({
                    clientId: entry.clientId,
                    status: 'accepted',
                    id: created.id,
                });
            } catch (error) {
                // Handle duplicate constraint violation
                if (error.code === 'P2002') {
                    this.logger.warn({
                        msg: 'Duplicate entry detected',
                        clientId: entry.clientId,
                        constraint: error.meta?.target,
                    });

                    results.push({
                        clientId: entry.clientId,
                        status: 'duplicate',
                        reason: 'Entry with same product/market/unit/date/price already exists',
                    });
                } else {
                    this.logger.error({
                        msg: 'Error creating entry',
                        clientId: entry.clientId,
                        error: error.message,
                    });

                    results.push({
                        clientId: entry.clientId,
                        status: 'rejected',
                        reason: error.message || 'Internal server error',
                    });
                }
            }
        }

        return results;
    }

    private mapStatusToResponse(
        status: EntryStatus,
    ): 'accepted' | 'rejected' | 'duplicate' | 'limit_exceeded' {
        switch (status) {
            case EntryStatus.pending:
            case EntryStatus.validated:
                return 'accepted';
            case EntryStatus.rejected:
                return 'rejected';
            default:
                return 'accepted';
        }
    }

    async getPendingEntries(page: number = 1, limit: number = 10) {
        const skip = (page - 1) * limit;

        return this.prisma.priceEntry.findMany({
            where: { status: EntryStatus.pending },
            include: {
                product: true,
                market: true,
                agent: true,
            },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
        });
    }

    async validateEntry(
        entryId: string,
        decision: ValidationDecision,
        reason: string | undefined,
        adminId: string,
    ) {
        const entry = await this.prisma.priceEntry.findUnique({
            where: { id: entryId },
        });

        if (!entry) {
            throw new NotFoundException('Entry not found');
        }

        // Update entry status
        const newStatus =
            decision === ValidationDecision.validated
                ? EntryStatus.validated
                : EntryStatus.rejected;

        const updated = await this.prisma.priceEntry.update({
            where: { id: entryId },
            data: { status: newStatus },
        });

        // Create validation record
        await this.prisma.validation.create({
            data: {
                priceEntryId: entryId,
                adminId,
                decision,
                reason,
            },
        });

        // Log admin action
        this.logger.info({
            msg: 'Entry validated',
            action: decision === ValidationDecision.validated ? 'VALIDATE' : 'REJECT',
            entryId,
            adminId,
            decision,
            reason,
            productId: entry.productId,
            marketId: entry.marketId,
            priceValue: entry.priceValue,
        });

        return updated;
    }
}
