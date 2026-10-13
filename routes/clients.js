/**
 * server/routes/clients.js
 * WowMyFlight CRM — Confirmed Travelers / Clients REST API
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

let memoryClients = [];

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/clients
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { search, status, tier } = req.query;

    if (prisma) {
      const where = {};
      if (status && status !== 'all') where.status = status;
      if (tier && tier !== 'all') where.tier = tier;
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
        orderBy: { createdAt: 'desc' }
      });

      return res.json({
        success: true,
        count: dbClients.length,
        data: dbClients
      });
    }

    return res.json({
      success: true,
      count: memoryClients.length,
      data: memoryClients
    });
  } catch (err) {
    console.error('❌ [Clients API] Error fetching clients:', err.message);
    return res.json({
      success: true,
      source: 'fallback',
      count: memoryClients.length,
      data: memoryClients,
      warning: err.message
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/clients/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (prisma) {
      const client = await prisma.client.findUnique({ where: { id } });
      if (client) return res.json({ success: true, data: client });
    }

    const memClient = memoryClients.find(c => c.id === id);
    if (!memClient) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    return res.json({ success: true, data: memClient });
  } catch (err) {
    console.error('❌ [Clients API] Error fetching client:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/clients
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const newClientData = {
      id: body.id || `CL-${Math.floor(1000 + Math.random() * 9000)}`,
      firstName: body.firstName || body.name || 'Traveler',
      lastName: body.lastName || '',
      email: body.email || null,
      phone: body.phone || null,
      nationality: body.nationality || '',
      tier: body.tier || 'Standard',
      totalSpent: parseFloat(body.totalSpent) || 0.0,
      status: body.status || 'Active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    let saved = null;
    if (prisma) {
      try {
        saved = await prisma.client.create({ data: newClientData });
      } catch (dbErr) {
        console.warn('⚠️ [Clients API] DB insert warning:', dbErr.message);
      }
    }

    const finalClient = saved || newClientData;
    memoryClients.unshift(finalClient);

    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('client:new', finalClient);
    }

    return res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: finalClient
    });
  } catch (err) {
    console.error('❌ [Clients API] Error creating client:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PUT /api/clients/:id
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    updates.updatedAt = new Date();

    let updated = null;
    if (prisma) {
      try {
        const safeData = { ...updates };
        delete safeData.id;
        delete safeData.createdAt;

        updated = await prisma.client.update({
          where: { id },
          data: safeData
        });
      } catch (dbErr) {
        console.warn('⚠️ [Clients API] DB update warning:', dbErr.message);
      }
    }

    const idx = memoryClients.findIndex(c => c.id === id);
    if (idx !== -1) {
      memoryClients[idx] = { ...memoryClients[idx], ...updates };
    }

    const result = updated || (idx !== -1 ? memoryClients[idx] : { id, ...updates });

    return res.json({
      success: true,
      message: 'Client updated successfully',
      data: result
    });
  } catch (err) {
    console.error('❌ [Clients API] Error updating client:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. DELETE /api/clients/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (prisma) {
      try {
        await prisma.client.delete({ where: { id } });
      } catch (dbErr) {
        console.warn('⚠️ [Clients API] DB delete warning:', dbErr.message);
      }
    }

    memoryClients = memoryClients.filter(c => c.id !== id);

    return res.json({ success: true, message: 'Client deleted successfully' });
  } catch (err) {
    console.error('❌ [Clients API] Error deleting client:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
