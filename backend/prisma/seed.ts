import { PrismaClient, Role } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding database...');


    // Clean existing data (development only)
    await prisma.priceEntry.deleteMany();
    await prisma.validation.deleteMany();
    await prisma.product.deleteMany();
    await prisma.market.deleteMany();
    await prisma.agent.deleteMany();

    // Create 3 products
    const products = await Promise.all([
        prisma.product.create({
            data: {
                name: 'Tomate',
                category: 'Légumes',
                unitsAllowed: ['kg', 'basket'],
            },
        }),
        prisma.product.create({
            data: {
                name: 'Oignon',
                category: 'Légumes',
                unitsAllowed: ['kg', 'piece'],
            },
        }),
        prisma.product.create({
            data: {
                name: 'Riz',
                category: 'Céréales',
                unitsAllowed: ['kg'],
            },
        }),
    ]);

    console.log(`✅ Created ${products.length} products`);

    // Create 5 markets in Cotonou with PostGIS geometry
    const markets: Array<{ name: string; city: string; lat: number; lon: number }> = [];
    const marketData = [
        { name: 'Marché Dantokpa', city: 'Cotonou', lat: 6.3654, lon: 2.4183 },
        { name: 'Marché St Michel', city: 'Cotonou', lat: 6.3702, lon: 2.4289 },
        { name: 'Marché Ganhi', city: 'Cotonou', lat: 6.3589, lon: 2.4312 },
        { name: 'Marché Missebo', city: 'Cotonou', lat: 6.3845, lon: 2.4156 },
        { name: 'Marché Tokpa', city: 'Cotonou', lat: 6.3612, lon: 2.4267 },
    ];

    for (const market of marketData) {
        const created = await prisma.$executeRaw`
      INSERT INTO markets(id, name, city, location, created_at, updated_at)
VALUES(
    gen_random_uuid(),
    ${market.name},
    ${market.city},
    ST_SetSRID(ST_MakePoint(${market.lon}, ${market.lat}), 4326),
    NOW(),
    NOW()
)
    `;
        markets.push(market);
    }

    console.log(`✅ Created ${markets.length} markets in Cotonou`);

    // Create 2 agents
    const agents = await Promise.all([
        prisma.agent.create({
            data: {
                name: 'Jean Dupont',
                phone: '+22997123456',
                role: Role.AGENT,
            },
        }),
        prisma.agent.create({
            data: {
                name: 'Marie Koffi',
                phone: '+22997654321',
                role: Role.AGENT,
            },
        }),
    ]);

    console.log(`✅ Created ${agents.length} agents`);

    console.log('✨ Seeding completed successfully!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
