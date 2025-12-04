import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { Unit } from '@prisma/client';

describe('Entries E2E Tests', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let authToken: string;
    let agentId: string;
    let productId: string;
    let marketId: string;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
            }),
        );
        await app.init();

        prisma = app.get<PrismaService>(PrismaService);

        // Setup test data
        await setupTestData();
    });

    afterAll(async () => {
        await cleanupTestData();
        await app.close();
    });

    async function setupTestData() {
        // Create test agent
        const agent = await prisma.agent.create({
            data: {
                name: 'Test Agent',
                phone: '+22900000000',
                role: 'AGENT',
            },
        });
        agentId = agent.id;

        // Get auth token
        const loginResponse = await request(app.getHttpServer())
            .post('/auth/login')
            .send({ phone: '+22900000000' });

        // In test, we need to get the OTP from database
        const otp = await prisma.otp.findFirst({
            where: { phone: '+22900000000', used: false },
            orderBy: { createdAt: 'desc' },
        });

        const verifyResponse = await request(app.getHttpServer())
            .post('/auth/verify')
            .send({ phone: '+22900000000', otp: otp.code });

        authToken = verifyResponse.body.access_token;

        // Create test product
        const product = await prisma.product.create({
            data: {
                name: 'Test Product',
                category: 'Test',
                unitsAllowed: ['kg'],
            },
        });
        productId = product.id;

        // Create test market
        await prisma.$executeRaw`
      INSERT INTO markets (id, name, city, location, created_at, updated_at)
      VALUES (gen_random_uuid(), 'Test Market', 'Test City', ST_SetSRID(ST_MakePoint(2.0, 6.0), 4326), NOW(), NOW())
    `;
        const market = await prisma.market.findFirst({
            where: { name: 'Test Market' },
        });
        marketId = market.id;
    }

    async function cleanupTestData() {
        await prisma.priceEntry.deleteMany({ where: { agentId } });
        await prisma.validation.deleteMany();
        await prisma.otp.deleteMany({ where: { phone: '+22900000000' } });
        await prisma.refreshToken.deleteMany({ where: { agentId } });
        await prisma.agent.deleteMany({ where: { id: agentId } });
        await prisma.product.deleteMany({ where: { id: productId } });
        await prisma.market.deleteMany({ where: { id: marketId } });
    }

    describe('POST /sync/entries', () => {
        it('should successfully create a valid entry', async () => {
            const validEntry = {
                productId,
                marketId,
                unit: Unit.kg,
                priceValue: 1500,
                currency: 'XOF',
                lat: 6.3654,
                lon: 2.4183,
                capturedAt: new Date().toISOString(),
            };

            const response = await request(app.getHttpServer())
                .post('/sync/entries')
                .set('Authorization', `Bearer ${authToken}`)
                .send([validEntry])
                .expect(201);

            expect(response.body).toHaveLength(1);
            expect(response.body[0]).toHaveProperty('id');
            expect(response.body[0].status).toBe('pending');
        });

        it('should reject invalid payload (missing required fields)', async () => {
            const invalidEntry = {
                productId,
                // missing marketId
                unit: Unit.kg,
                priceValue: 1500,
            };

            await request(app.getHttpServer())
                .post('/sync/entries')
                .set('Authorization', `Bearer ${authToken}`)
                .send([invalidEntry])
                .expect(400);
        });

        it('should reject invalid payload (price < 1)', async () => {
            const invalidEntry = {
                productId,
                marketId,
                unit: Unit.kg,
                priceValue: 0,
                currency: 'XOF',
                lat: 6.3654,
                lon: 2.4183,
                capturedAt: new Date().toISOString(),
            };

            await request(app.getHttpServer())
                .post('/sync/entries')
                .set('Authorization', `Bearer ${authToken}`)
                .send([invalidEntry])
                .expect(400);
        });

        it('should reject invalid payload (invalid currency)', async () => {
            const invalidEntry = {
                productId,
                marketId,
                unit: Unit.kg,
                priceValue: 1500,
                currency: 'xof', // lowercase
                lat: 6.3654,
                lon: 2.4183,
                capturedAt: new Date().toISOString(),
            };

            await request(app.getHttpServer())
                .post('/sync/entries')
                .set('Authorization', `Bearer ${authToken}`)
                .send([invalidEntry])
                .expect(400);
        });

        it('should reject invalid payload (invalid coordinates)', async () => {
            const invalidEntry = {
                productId,
                marketId,
                unit: Unit.kg,
                priceValue: 1500,
                currency: 'XOF',
                lat: 100, // > 90
                lon: 200, // > 180
                capturedAt: new Date().toISOString(),
            };

            await request(app.getHttpServer())
                .post('/sync/entries')
                .set('Authorization', `Bearer ${authToken}`)
                .send([invalidEntry])
                .expect(400);
        });

        it('should handle duplicate entries', async () => {
            const entry = {
                productId,
                marketId,
                unit: Unit.kg,
                priceValue: 2000,
                currency: 'XOF',
                lat: 6.3654,
                lon: 2.4183,
                capturedAt: new Date().toISOString(),
            };

            // First submission - should succeed
            await request(app.getHttpServer())
                .post('/sync/entries')
                .set('Authorization', `Bearer ${authToken}`)
                .send([entry])
                .expect(201);

            // Second submission - should fail with 409 Conflict
            const response = await request(app.getHttpServer())
                .post('/sync/entries')
                .set('Authorization', `Bearer ${authToken}`)
                .send([entry])
                .expect(409);

            expect(response.body.code).toBe('DUPLICATE_ENTRY');
        });

        it('should enforce daily limit (3 entries per day)', async () => {
            const baseEntry = {
                productId,
                marketId,
                unit: Unit.kg,
                currency: 'XOF',
                lat: 6.3654,
                lon: 2.4183,
                capturedAt: new Date().toISOString(),
            };

            // Create 3 entries
            for (let i = 0; i < 3; i++) {
                await request(app.getHttpServer())
                    .post('/sync/entries')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send([{ ...baseEntry, priceValue: 1000 + i }])
                    .expect(201);
            }

            // 4th entry should fail
            const response = await request(app.getHttpServer())
                .post('/sync/entries')
                .set('Authorization', `Bearer ${authToken}`)
                .send([{ ...baseEntry, priceValue: 1004 }]);

            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it('should require authentication', async () => {
            const validEntry = {
                productId,
                marketId,
                unit: Unit.kg,
                priceValue: 1500,
                currency: 'XOF',
                lat: 6.3654,
                lon: 2.4183,
                capturedAt: new Date().toISOString(),
            };

            await request(app.getHttpServer())
                .post('/sync/entries')
                .send([validEntry])
                .expect(401);
        });
    });
});
