/**
 * callStore.js
 * In-memory store for call logs, dispositions, and active call tracking.
 * This will be replaced by a real database (PostgreSQL) in Phase 2.
 */

const { v4: uuidv4 } = require('uuid');

// Active calls map: callControlId -> call object
const activeCalls = new Map();

// All call logs (persisted in memory during server session)
const callLogs = [];

// Call dispositions
const dispositions = [];

/**
 * Create a new call log entry when a call is initiated
 */
function createCallLog({ callControlId, direction, fromNumber, toNumber, agentId, agentName }) {
  const log = {
    id: uuidv4(),
    callControlId,
    direction,          // 'outbound' | 'inbound'
    fromNumber,
    toNumber,
    agentId,
    agentName,
    status: 'initiated',
    startedAt: new Date().toISOString(),
    answeredAt: null,
    endedAt: null,
    durationSeconds: 0,
    recordingUrl: null,
    disposition: null,
    notes: '',
    createdAt: new Date().toISOString(),
  };

  callLogs.push(log);
  activeCalls.set(callControlId, log);
  return log;
}

/**
 * Update an existing call log by callControlId
 */
function updateCallLog(callControlId, updates) {
  const log = callLogs.find(l => l.callControlId === callControlId);
  if (log) {
    Object.assign(log, updates);
    if (activeCalls.has(callControlId)) {
      activeCalls.set(callControlId, log);
    }
  }
  return log;
}

/**
 * Mark a call as answered
 */
function markCallAnswered(callControlId) {
  return updateCallLog(callControlId, {
    status: 'answered',
    answeredAt: new Date().toISOString(),
  });
}

/**
 * Mark a call as ended and calculate duration
 */
function markCallEnded(callControlId) {
  const log = callLogs.find(l => l.callControlId === callControlId);
  if (log) {
    const endedAt = new Date().toISOString();
    const startTime = new Date(log.answeredAt || log.startedAt);
    const durationSeconds = Math.floor((new Date(endedAt) - startTime) / 1000);
    updateCallLog(callControlId, {
      status: 'completed',
      endedAt,
      durationSeconds,
    });
    activeCalls.delete(callControlId);
  }
  return log;
}

/**
 * Save recording URL against a call
 */
function saveRecording(callControlId, recordingUrl) {
  return updateCallLog(callControlId, { recordingUrl });
}

/**
 * Save a call disposition after the call ends
 */
function saveDisposition({ callId, agentId, disposition, notes }) {
  const entry = {
    id: uuidv4(),
    callId,
    agentId,
    disposition, // e.g. 'interested', 'callback', 'quoted', 'booked', 'no_answer', 'voicemail', 'wrong_number', 'not_interested'
    notes,
    createdAt: new Date().toISOString(),
  };
  dispositions.push(entry);

  // Also update the call log
  const log = callLogs.find(l => l.id === callId);
  if (log) {
    updateCallLog(log.callControlId, { disposition, notes });
  }

  return entry;
}

/**
 * Get all call logs (newest first), optionally filtered by agentId
 */
function getCallLogs({ agentId, limit = 50 } = {}) {
  let logs = [...callLogs].reverse();
  if (agentId) {
    logs = logs.filter(l => l.agentId === agentId);
  }
  return logs.slice(0, limit);
}

/**
 * Get a single call log by callControlId
 */
function getCallByControlId(callControlId) {
  return callLogs.find(l => l.callControlId === callControlId);
}

/**
 * Get currently active call for a given agent
 */
function getActiveCall(agentId) {
  for (const call of activeCalls.values()) {
    if (call.agentId === agentId) return call;
  }
  return null;
}

module.exports = {
  createCallLog,
  updateCallLog,
  markCallAnswered,
  markCallEnded,
  saveRecording,
  saveDisposition,
  getCallLogs,
  getCallByControlId,
  getActiveCall,
  activeCalls,
};
