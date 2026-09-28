/**
 * chatStore.js
 * In-memory store for live chat sessions and messages.
 * This will be replaced by a real database in the future.
 */

const { v4: uuidv4 } = require('uuid');

// Store all chat sessions
// A session represents a chat between a customer and the system/agents
const chatSessions = [];

// Store all messages
const messages = [];

/**
 * Create a new chat session for a customer
 */
function createSession({ customerName, customerEmail, customerPhone }) {
  const session = {
    id: uuidv4(),
    customerName: customerName || 'Guest',
    customerEmail: customerEmail || '',
    customerPhone: customerPhone || '',
    status: 'active', // 'active', 'closed'
    agentId: null,    // ID of the agent who joined, if any
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
  };

  chatSessions.push(session);
  return session;
}

/**
 * Get a session by ID
 */
function getSession(sessionId) {
  return chatSessions.find(s => s.id === sessionId);
}

/**
 * Get all chat sessions (for the agent dashboard)
 */
function getAllSessions() {
  return chatSessions.sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt));
}

/**
 * Resolve a session
 */
function resolveSession(sessionId) {
  const session = getSession(sessionId);
  if (session) {
    session.status = 'resolved';
    session.lastActivityAt = new Date().toISOString();
  }
  return session;
}

/**
 * Assign an agent to a chat session
 */
function assignAgentToSession(sessionId, agentId) {
  const session = getSession(sessionId);
  if (session) {
    session.agentId = agentId;
    session.lastActivityAt = new Date().toISOString();
  }
  return session;
}

/**
 * Unassign agent from session (Transfer)
 */
function unassignSession(sessionId) {
  const session = getSession(sessionId);
  if (session) {
    session.agentId = null;
    session.lastActivityAt = new Date().toISOString();
  }
  return session;
}

/**
 * Block a user's session
 */
function blockSession(sessionId) {
  const session = getSession(sessionId);
  if (session) {
    session.status = 'blocked';
    session.lastActivityAt = new Date().toISOString();
  }
  return session;
}

/**
 * Add a new message to a session
 */
function addMessage({ sessionId, senderType, senderId, senderName, text, type, attachment }) {
  const session = getSession(sessionId);
  if (!session) return null;

  const msg = {
    id: uuidv4(),
    sessionId,
    senderType, // 'customer' or 'agent'
    senderId,   // socket.id for customer, or agentId for agent
    senderName,
    text,
    type,
    attachment,
    timestamp: new Date().toISOString(),
    status: 'delivered', // 'sent', 'delivered', 'read'
  };

  messages.push(msg);
  
  // Update last activity
  session.lastActivityAt = msg.timestamp;

  return msg;
}

/**
 * Get all messages for a specific session
 */
function getMessagesForSession(sessionId) {
  return messages
    .filter(m => m.sessionId === sessionId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * Mark messages as read
 */
function markMessagesAsRead(sessionId, readerType) {
  let updated = false;
  messages.forEach(m => {
    if (m.sessionId === sessionId && m.senderType !== readerType && m.status !== 'read') {
      m.status = 'read';
      updated = true;
    }
  });
  return updated;
}

module.exports = {
  createSession,
  getSession,
  getAllSessions,
  resolveSession,
  assignAgentToSession,
  unassignSession,
  blockSession,
  addMessage,
  getMessagesForSession,
  markMessagesAsRead,
};
