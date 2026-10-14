/**
 * server/routes/consultations.js
 * WowMyFlight CRM — Consultations & Calendar Scheduling REST API
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../db');

let memoryConsultations = [];

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /api/consultations
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { status, agentId, search } = req.query;

    if (prisma) {
      const where = {};
      if (status && status !== 'all') where.status = status;
      if (agentId) where.agentId = agentId;
      if (search) {
        where.OR = [
          { clientName: { contains: search, mode: 'insensitive' } },
          { clientEmail: { contains: search, mode: 'insensitive' } },
          { agentName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const dbCons = await prisma.consultation.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      return res.json({
        success: true,
        count: dbCons.length,
        data: dbCons
      });
    }

    return res.json({
      success: true,
      count: memoryConsultations.length,
      data: memoryConsultations
    });
  } catch (err) {
    console.error('❌ [Consultations API] Error fetching consultations:', err.message);
    return res.json({
      success: true,
      source: 'fallback',
      count: memoryConsultations.length,
      data: memoryConsultations,
      warning: err.message
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET /api/consultations/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (prisma) {
      const cons = await prisma.consultation.findUnique({ where: { id } });
      if (cons) return res.json({ success: true, data: cons });
    }

    const mem = memoryConsultations.find(c => c.id === id);
    if (!mem) return res.status(404).json({ success: false, error: 'Consultation not found' });
    return res.json({ success: true, data: mem });
  } catch (err) {
    console.error('❌ [Consultations API] Error fetching consultation:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. POST /api/consultations
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const newCons = {
      clientName: body.clientName || 'Traveler',
      clientEmail: body.clientEmail || null,
      clientPhone: body.clientPhone || null,
      agentId: body.agentId || null,
      agentName: body.agentName || 'Agent',
      serviceType: body.serviceType || 'Flight Consultation',
      dateTime: body.dateTime || new Date().toISOString(),
      status: body.status || 'Scheduled',
      meetingLink: body.meetingLink || `https://meet.jit.si/WowMyFlight-Consultation-${Math.random().toString(36).substring(2, 7)}`,
      notes: body.notes || null,
      outcome: body.outcome || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    let saved = null;
    if (prisma) {
      try {
        saved = await prisma.consultation.create({ data: newCons });
      } catch (dbErr) {
        console.warn('⚠️ [Consultations API] DB insert warning:', dbErr.message);
      }
    }

    const finalRecord = saved || { id: `cons-${Date.now()}`, ...newCons };
    memoryConsultations.unshift(finalRecord);

    const io = req.app.get('io');
    if (io) {
      io.to('agents_group').emit('consultation:new', finalRecord);
    }

    return res.status(201).json({
      success: true,
      message: 'Consultation scheduled successfully',
      data: finalRecord
    });
  } catch (err) {
    console.error('❌ [Consultations API] Error scheduling consultation:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PUT /api/consultations/:id
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

        updated = await prisma.consultation.update({
          where: { id },
          data: safeData
        });
      } catch (dbErr) {
        console.warn('⚠️ [Consultations API] DB update warning:', dbErr.message);
      }
    }

    const idx = memoryConsultations.findIndex(c => c.id === id);
    if (idx !== -1) {
      memoryConsultations[idx] = { ...memoryConsultations[idx], ...updates };
    }

    const result = updated || (idx !== -1 ? memoryConsultations[idx] : { id, ...updates });

    return res.json({
      success: true,
      message: 'Consultation updated successfully',
      data: result
    });
  } catch (err) {
    console.error('❌ [Consultations API] Error updating consultation:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. DELETE /api/consultations/:id
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (prisma) {
      try {
        await prisma.consultation.delete({ where: { id } });
      } catch (dbErr) {
        console.warn('⚠️ [Consultations API] DB delete warning:', dbErr.message);
      }
    }

    memoryConsultations = memoryConsultations.filter(c => c.id !== id);

    return res.json({ success: true, message: 'Consultation cancelled/deleted' });
  } catch (err) {
    console.error('❌ [Consultations API] Error deleting consultation:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
