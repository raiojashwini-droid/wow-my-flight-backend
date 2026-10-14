/**
 * server/routes/clients.js
 * WowMyFlight CRM — Confirmed Travelers / Customer 360 REST API (PostgreSQL Prisma + Resilient Memory Fallback)
 * 
 * Features:
 *   - Real PostgreSQL persistence via Prisma (with auto-seeding & upsert protection)
 *   - Search, status, and tier filtering
 *   - Full travel profile metadata (passport, cabin class, preferences, city/country)
 *   - Real-time Socket.io broadcasting on create / update / delete
 * 
 * Endpoints:
 *   GET    /api/clients       - Fetch all clients (with search/tier/status filters)
 *   GET    /api/clients/:id   - Fetch single client by ID
 *   POST   /api/clients       - Create new client & broadcast via Socket.io
 *   PUT    /api/clients/:id   - Update client profile
 *   DELETE /api/clients/:id   - Delete client
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { prisma, isDbConnected } = require('../db');

// Extended metadata cache for flight-specific passenger preferences
const clientMetadataMap = new Map();

// Initial seed clients (VIP flight travelers)
const SEED_CLIENTS = [
  {
    id: 'CL-1001',
    firstName: 'Marcus',
    lastName: 'Vance',
    email: 'm.vance@vanceholdings.com',
    phone: '+1 212 555 0198',
    nationality: 'United States',
    country: 'United States',
    city: 'New York',
    timezone: 'UTC-05:00 Eastern Time',
    preferredLanguage: 'English',
    passportNumber: 'US98234109',
    passportExpiry: '2031-08-15',
    preferredCabinClass: 'First Class',
    seatPreference: 'Aisle (Lie-flat)',
    mealPreference: 'Vegetarian (Asian Style)',
    tier: 'VIP Frequent',
    totalSpent: 18500,
    status: 'Active',
    createdAt: new Date('2025-01-10T08:00:00Z'),
    updatedAt: new Date(),
  },
  {
    id: 'CL-1002',
    firstName: 'Amina',
    lastName: 'Al-Mansoor',
    email: 'amina.almansoor@emiratesinvest.ae',
    phone: '+971 50 123 4567',
    nationality: 'United Arab Emirates',
    country: 'United Arab Emirates',
    city: 'Dubai',
    timezone: 'UTC+04:00 Gulf Standard Time',
    preferredLanguage: 'Arabic & English',
    passportNumber: 'AE4482019',
    passportExpiry: '2032-11-20',
    preferredCabinClass: 'First Class',
    seatPreference: 'Window Suite',
    mealPreference: 'Halal Gourmet',
    tier: 'VIP Elite',
    totalSpent: 34200,
    status: 'Active',
    createdAt: new Date('2025-01-15T09:30:00Z'),
    updatedAt: new Date(),
  },
  {
    id: 'CL-1003',
    firstName: 'Liam',
    lastName: "O'Connor",
    email: 'liam.oconnor@dublintech.ie',
    phone: '+353 87 654 3210',
    nationality: 'Ireland',
    country: 'Ireland',
    city: 'Dublin',
    timezone: 'UTC+00:00 GMT',
    preferredLanguage: 'English',
    passportNumber: 'IE7729103',
    passportExpiry: '2030-05-12',
    preferredCabinClass: 'Business Class',
    seatPreference: 'Aisle',
    mealPreference: 'Standard',
    tier: 'Frequent Flyer',
    totalSpent: 12400,
    status: 'Active',
    createdAt: new Date('2025-02-01T11:15:00Z'),
    updatedAt: new Date(),
  },
  {
    id: 'CL-1004',
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@innovate.in',
    phone: '+91 98200 12345',
    nationality: 'India',
    country: 'India',
    city: 'Mumbai',
    timezone: 'UTC+05:30 IST',
    preferredLanguage: 'English & Hindi',
    passportNumber: 'IN8832104',
    passportExpiry: '2033-04-18',
    preferredCabinClass: 'Business Class',
    seatPreference: 'Window',
    mealPreference: 'Hindu Vegetarian (AVML)',
    tier: 'Gold',
    totalSpent: 9600,
    status: 'Active',
    createdAt: new Date('2025-02-12T14:20:00Z'),
    updatedAt: new Date(),
  },
  {
    id: 'CL-1005',
    firstName: 'Sophia',
    lastName: 'Laurent',
    email: 'sophia.laurent@luxevoyage.fr',
    phone: '+33 6 12 34 56 78',
    nationality: 'France',
    country: 'France',
    city: 'Paris',
    timezone: 'UTC+01:00 CET',
    preferredLanguage: 'French & English',
    passportNumber: 'FR1123490',
    passportExpiry: '2032-09-30',
    preferredCabinClass: 'Business Class',
    seatPreference: 'Aisle',
    mealPreference: 'Vegetarian',
    tier: 'Platinum',
    totalSpent: 26800,
    status: 'Active',
    createdAt: new Date('2025-02-20T16:45:00Z'),
    updatedAt: new Date(),
  },
];

// Seed metadata map
SEED_CLIENTS.forEach((c) => clientMetadataMap.set(c.id, c));

// In-memory fallback cache
let memoryClients = [...SEED_CLIENTS];

// Ensure PostgreSQL is seeded if empty
let isSeeded = false;
async function ensureDbSeeded() {
  if (isSeeded || !prisma || (typeof isDbConnected === 'function' && !isDbConnected())) return;
  try {
    const count = await prisma.client.count();
    if (count === 0) {
      console.log('🌱 [Clients API] Seeding initial clients into PostgreSQL...');
      for (const client of SEED_CLIENTS) {
        await prisma.client.create({
          data: {
            id: client.id,
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            phone: client.phone,
            nationality: client.nationality,
            tier: client.tier,
            totalSpent: client.totalSpent,
            status: client.status,
            createdAt: client.createdAt,
            updatedAt: client.updatedAt,
          },
        });
      }
      console.log('✅ [Clients API] Seeded initial clients successfully.');
    }
    isSeeded = true;
  } catch (err) {
    console.warn('⚠️ [Clients API] Could not auto-seed clients table:', err.message);
  }
}

// Format client record with frontend-friendly helper fields
function formatClient(c) {
  if (!c) return null;
  const meta = clientMetadataMap.get(c.id) || {};
  return {
    ...c,
    country: meta.country || c.nationality || 'United States',
    nationality: meta.nationality || c.nationality || 'American',
    city: meta.city || 'New York',
    timezone: meta.timezone || 'UTC-05:00 Eastern Time',
    preferredLanguage: meta.preferredLanguage || 'English',
    passportNumber: meta.passportNumber || '',
    passportExpiry: meta.passportExpiry || '2031-10-15',
    preferredCabinClass: meta.preferredCabinClass || (c.tier?.includes('Elite') || c.tier?.includes('Platinum') ? 'First Class' : 'Business Class'),
    seatPreference: meta.seatPreference || 'Aisle',
    mealPreference: meta.mealPreference || 'Vegetarian',
    totalSpent: typeof c.totalSpent === 'number' ? `$${c.totalSpent.toLocaleString()}` : (c.totalSpent || '$0'),
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. GET /api/clients
 * Fetch all clients with optional filters: search, status, tier
 * ─────────────────────────────────────────────────────────────────────────────
 */
router.get('/', async (req, res) => {
  try {
    const { search, status, tier } = req.query;

    if (prisma && (typeof isDbConnected !== 'function' || isDbConnected())) {
      try {
        await ensureDbSeeded();

        const where = {};
        if (status && status !== 'all' && status !== 'All') {
          where.status = status;
        }
        if (tier && tier !== 'all' && tier !== 'All') {
          where.tier = tier;
        }
        if (search) {
          where.OR = [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ];
        }

        const dbClients = await prisma.client.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        });

        return res.json({
          success: true,
          source: 'PostgreSQL Database',
          count: dbClients.length,
          data: dbClients.map(formatClient),
        });
      } catch (dbErr) {
        console.warn('⚠️ [Clients API] DB query failed, falling back to memory:', dbErr.message);
      }
    }

    // Filter memory cache
    let filteredMem = [...memoryClients];
    if (status && status !== 'all' && status !== 'All') {
      filteredMem = filteredMem.filter((c) => c.status?.toLowerCase() === status.toLowerCase());
    }
    if (tier && tier !== 'all' && tier !== 'All') {
      filteredMem = filteredMem.filter((c) => c.tier?.toLowerCase() === tier.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      filteredMem = filteredMem.filter((c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q)
      );
    }

    return res.json({
      success: true,
      source: 'Memory Cache',
      count: filteredMem.length,
      data: filteredMem.map(formatClient),
    });
  } catch (err) {
    console.error('❌ [Clients API] Error fetching clients:', err.message);
    return res.json({
      success: true,
      source: 'fallback',
      count: memoryClients.length,
      data: memoryClients.map(formatClient),
      warning: err.message,
    });
  }
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. GET /api/clients/:id
 * Fetch single client by ID
 * ─────────────────────────────────────────────────────────────────────────────
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (prisma && (typeof isDbConnected !== 'function' || isDbConnected())) {
      try {
        const dbClient = await prisma.client.findUnique({
          where: { id },
        });
        if (dbClient) {
          return res.json({ success: true, data: formatClient(dbClient) });
        }
      } catch (dbErr) {
        console.warn(`⚠️ [Clients API] Could not fetch client ${id} from DB:`, dbErr.message);
      }
    }

    const memClient = memoryClients.find((c) => c.id === id);
    if (memClient) {
      return res.json({ success: true, data: formatClient(memClient) });
    }

    return res.status(404).json({ success: false, error: 'Client not found' });
  } catch (err) {
    console.error(`❌ [Clients API] Error fetching client ${id}:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. POST /api/clients
 * Create new client & broadcast via Socket.io
 * ─────────────────────────────────────────────────────────────────────────────
 */
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const clientId = body.id || `CL-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();

    const firstName = body.firstName || (body.name ? body.name.split(' ')[0] : 'Traveler');
    const lastName = body.lastName || (body.name && body.name.split(' ').length > 1 ? body.name.split(' ').slice(1).join(' ') : '');
    const email = body.email || null;
    const phone = body.phone || null;
    const nationality = body.country || body.nationality || 'United States';
    const tier = body.tier || 'VIP Frequent';
    const totalSpent = typeof body.totalSpent === 'number'
      ? body.totalSpent
      : parseFloat(String(body.totalSpent || '0').replace(/[^0-9.]/g, '')) || 0;
    const status = body.status || 'Active';

    // Store rich metadata
    clientMetadataMap.set(clientId, { ...body, id: clientId, firstName, lastName, email, phone, nationality, tier, totalSpent, status });

    const clientRecord = {
      id: clientId,
      firstName,
      lastName,
      email,
      phone,
      nationality,
      tier,
      totalSpent,
      status,
      createdAt: body.createdAt ? new Date(body.createdAt) : now,
      updatedAt: now,
    };

    let createdRecord = null;

    if (prisma && (typeof isDbConnected !== 'function' || isDbConnected())) {
      try {
        createdRecord = await prisma.client.upsert({
          where: { id: clientId },
          update: clientRecord,
          create: clientRecord,
        });
        console.log(`✅ [PostgreSQL] Saved client: ${createdRecord.id} (${firstName} ${lastName})`);
      } catch (dbErr) {
        console.warn('⚠️ [PostgreSQL] prisma.client.upsert failed, falling back to memory:', dbErr.message);
      }
    }

    const finalClient = createdRecord || clientRecord;
    memoryClients.unshift(finalClient);

    const formatted = formatClient(finalClient);

    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('client:new', formatted);
      console.log(`📡 [Socket.io] Broadcasted client:new (${formatted.id})`);
    }

    return res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: formatted,
    });
  } catch (err) {
    console.error('❌ [Clients API] Error creating client:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to create client',
      message: err.message,
    });
  }
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 4. PUT /api/clients/:id
 * Update an existing client
 * ─────────────────────────────────────────────────────────────────────────────
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  try {
    const existingMeta = clientMetadataMap.get(id) || {};
    clientMetadataMap.set(id, { ...existingMeta, ...updates });

    const updateData = {};
    if (updates.firstName !== undefined) updateData.firstName = updates.firstName;
    if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.nationality !== undefined || updates.country !== undefined) {
      updateData.nationality = updates.nationality || updates.country;
    }
    if (updates.tier !== undefined) updateData.tier = updates.tier;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.totalSpent !== undefined) {
      updateData.totalSpent = typeof updates.totalSpent === 'number'
        ? updates.totalSpent
        : parseFloat(String(updates.totalSpent).replace(/[^0-9.]/g, '')) || 0;
    }
    updateData.updatedAt = new Date();

    let updatedRecord = null;

    if (prisma && (typeof isDbConnected !== 'function' || isDbConnected())) {
      try {
        updatedRecord = await prisma.client.update({
          where: { id },
          data: updateData,
        });
        console.log(`✅ [PostgreSQL] Updated client: ${id}`);
      } catch (dbErr) {
        console.warn(`⚠️ [PostgreSQL] prisma.client.update failed for ${id}:`, dbErr.message);
      }
    }

    const memIndex = memoryClients.findIndex((c) => c.id === id);
    if (memIndex !== -1) {
      memoryClients[memIndex] = { ...memoryClients[memIndex], ...updateData };
      if (!updatedRecord) updatedRecord = memoryClients[memIndex];
    } else if (!updatedRecord) {
      updatedRecord = { id, ...updateData };
      memoryClients.unshift(updatedRecord);
    }

    const formatted = formatClient(updatedRecord);

    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('client:updated', formatted);
    }

    return res.json({
      success: true,
      message: 'Client updated successfully',
      data: formatted,
    });
  } catch (err) {
    console.error(`❌ [Clients API] Error updating client ${id}:`, err);
    return res.status(500).json({
      success: false,
      error: 'Failed to update client',
      message: err.message,
    });
  }
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 5. DELETE /api/clients/:id
 * Delete a client
 * ─────────────────────────────────────────────────────────────────────────────
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (prisma && (typeof isDbConnected !== 'function' || isDbConnected())) {
      try {
        await prisma.client.delete({ where: { id } });
        console.log(`✅ [PostgreSQL] Deleted client: ${id}`);
      } catch (dbErr) {
        console.warn(`⚠️ [PostgreSQL] prisma.client.delete failed for ${id}:`, dbErr.message);
      }
    }

    clientMetadataMap.delete(id);
    memoryClients = memoryClients.filter((c) => c.id !== id);

    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('client:deleted', { id });
    }

    return res.json({
      success: true,
      message: `Client ${id} deleted successfully`,
    });
  } catch (err) {
    console.error(`❌ [Clients API] Error deleting client ${id}:`, err);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete client',
      message: err.message,
    });
  }
});

module.exports = router;
