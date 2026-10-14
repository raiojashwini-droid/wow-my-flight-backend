/**
 * routes/permissionControl.js
 * WowMyFlight CRM — Phase 3: Permission Control REST API
 * Route Name Matches Menu: "Permission Control" -> /api/permission-control
 */

const express = require('express');
const router = express.Router();

let ROLES = [
  {
    id: 'super_admin',
    name: 'Super Admin (CEO / Owner)',
    description: 'Master enterprise administrator with full system-wide permissions across all branches and modules.',
    isCustom: false,
    userCount: 1,
    permissions: [
      { key: 'leads_view', enabled: true, scope: 'all' },
      { key: 'leads_create', enabled: true, scope: 'all' },
      { key: 'leads_edit', enabled: true, scope: 'all' },
      { key: 'leads_assign', enabled: true, scope: 'all' },
      { key: 'leads_delete', enabled: true, scope: 'all' },
      { key: 'bookings_view', enabled: true, scope: 'all' },
      { key: 'bookings_modify', enabled: true, scope: 'all' },
      { key: 'bookings_cancel', enabled: true, scope: 'all' },
      { key: 'finance_approve_refund', enabled: true, scope: 'all' },
      { key: 'settings_edit_permissions', enabled: true, scope: 'all' }
    ]
  },
  {
    id: 'team_leader',
    name: 'Team Leader',
    description: 'Floor supervisor managing a pod of agents, handling real-time floor monitoring, coaching, discount approvals & lead assignment.',
    isCustom: false,
    userCount: 4,
    permissions: [
      { key: 'leads_view', enabled: true, scope: 'team' },
      { key: 'leads_assign', enabled: true, scope: 'team' },
      { key: 'leads_reassign', enabled: true, scope: 'team' },
      { key: 'quotes_discount_approve', enabled: true, scope: 'team' },
      { key: 'team_coach_agents', enabled: true, scope: 'team' },
      { key: 'bookings_view', enabled: true, scope: 'team' },
      { key: 'calls_recording_view', enabled: true, scope: 'team' }
    ]
  },
  {
    id: 'expert_team_leader',
    name: 'Expert Team Leader (Escalations Supervisor)',
    description: 'Senior supervisor overseeing complex escalations, GDS segment rebuilding, VIP lead overrides & SLA breach management.',
    isCustom: false,
    userCount: 2,
    permissions: [
      { key: 'leads_view', enabled: true, scope: 'department' },
      { key: 'leads_assign', enabled: true, scope: 'department' },
      { key: 'quotes_discount_approve', enabled: true, scope: 'department' },
      { key: 'escalations_override', enabled: true, scope: 'department' },
      { key: 'bookings_modify', enabled: true, scope: 'department' }
    ]
  },
  {
    id: 'sales_agent',
    name: 'Travel Sales Consultant',
    description: 'Frontline agent handling inbound flight requests, quoting Sabre fares, outbound calls, and closing flight bookings.',
    isCustom: false,
    userCount: 12,
    permissions: [
      { key: 'leads_view', enabled: true, scope: 'own' },
      { key: 'leads_create', enabled: true, scope: 'own' },
      { key: 'quotes_create', enabled: true, scope: 'own' },
      { key: 'calls_make', enabled: true, scope: 'own' },
      { key: 'calls_receive', enabled: true, scope: 'own' },
      { key: 'bookings_view', enabled: true, scope: 'own' }
    ]
  }
];

let USER_OVERRIDES = {};

let AUDIT_LOGS = [
  {
    id: 'AUDIT-PERM-01',
    targetType: 'Role',
    targetId: 'team_leader',
    targetName: 'Team Leader',
    action: 'EDIT_ROLE',
    modifiedBy: 'Super Admin',
    details: 'Added discount approve permission with scope "team"',
    reason: 'Delegated margin controls to floor TLs',
    timestamp: '2026-08-19T14:30:00Z'
  }
];

let HIERARCHY = {
  company: 'WOW MY FLIGHT Travel Agency Group',
  branches: [
    {
      id: 'branch-newyork',
      name: 'New York HQ (USA)',
      code: 'NYC-HQ',
      departments: [
        {
          id: 'dept-sales-usa',
          name: 'North America Sales Dept',
          teams: [
            { id: 'team-alpha', name: 'Alpha Sales Team', leader: 'Michael Chang' },
            { id: 'team-beta', name: 'VIP Concierge Team', leader: 'Sofia Rodriguez' }
          ]
        }
      ]
    },
    {
      id: 'branch-delhi',
      name: 'New Delhi Operational Center (India)',
      code: 'DEL-OPS',
      departments: [
        {
          id: 'dept-sales-india',
          name: 'International Sales & Support',
          teams: [
            { id: 'team-gamma', name: 'Global Direct Sales', leader: 'Sarah Jenkins' }
          ]
        }
      ]
    }
  ]
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Roles CRUD
// ─────────────────────────────────────────────────────────────────────────────
router.get('/roles', (req, res) => {
  res.json({ success: true, count: ROLES.length, data: ROLES });
});

router.post('/roles', (req, res) => {
  const { name, description, permissions } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'Role name required' });

  const newRole = {
    id: `role_custom_${Date.now()}`,
    name,
    description: description || 'Custom configured role',
    isCustom: true,
    userCount: 0,
    permissions: permissions || []
  };

  ROLES.push(newRole);

  AUDIT_LOGS.unshift({
    id: `AUDIT-PERM-${Date.now()}`,
    targetType: 'Role',
    targetId: newRole.id,
    targetName: newRole.name,
    action: 'CREATE_ROLE',
    modifiedBy: req.body.modifiedBy || 'Super Admin',
    details: `Created custom role "${name}"`,
    reason: 'New Role Onboarding',
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: `Role "${name}" created successfully`, data: newRole });
});

router.put('/roles/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, permissions, modifiedBy = 'Super Admin' } = req.body;
  const role = ROLES.find(r => r.id === id);
  if (!role) return res.status(404).json({ success: false, error: 'Role not found' });

  if (name) role.name = name;
  if (description !== undefined) role.description = description;
  if (permissions) role.permissions = permissions;

  AUDIT_LOGS.unshift({
    id: `AUDIT-PERM-${Date.now()}`,
    targetType: 'Role',
    targetId: role.id,
    targetName: role.name,
    action: 'EDIT_ROLE',
    modifiedBy,
    details: `Updated permissions for role "${role.name}"`,
    reason: 'Administrative RBAC Policy Update',
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: `Role "${role.name}" updated successfully`, data: role });
});

router.delete('/roles/:id', (req, res) => {
  const { id } = req.params;
  const idx = ROLES.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Role not found' });
  const deleted = ROLES.splice(idx, 1)[0];
  res.json({ success: true, message: `Role "${deleted.name}" deleted successfully` });
});

router.post('/roles/:id/clone', (req, res) => {
  const { id } = req.params;
  const { newRoleName } = req.body;
  const src = ROLES.find(r => r.id === id);
  if (!src) return res.status(404).json({ success: false, error: 'Source role not found' });

  const cloned = {
    id: `role_clone_${Date.now()}`,
    name: newRoleName || `${src.name} (Copy)`,
    description: `Cloned from ${src.name}. ${src.description}`,
    isCustom: true,
    userCount: 0,
    permissions: JSON.parse(JSON.stringify(src.permissions))
  };

  ROLES.push(cloned);
  res.json({ success: true, message: `Role cloned into "${cloned.name}"`, data: cloned });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Overrides, Hierarchy & Audit Logs
// ─────────────────────────────────────────────────────────────────────────────
router.get('/overrides', (req, res) => {
  res.json({ success: true, data: USER_OVERRIDES });
});

router.post('/overrides', (req, res) => {
  const { userId, userName, overrides, modifiedBy = 'Super Admin' } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

  USER_OVERRIDES[userId] = {
    userId,
    userName: userName || 'Agent',
    overrides: overrides || {},
    updatedAt: new Date().toISOString(),
    updatedBy: modifiedBy
  };

  AUDIT_LOGS.unshift({
    id: `AUDIT-PERM-${Date.now()}`,
    targetType: 'User',
    targetId: userId,
    targetName: userName,
    action: 'USER_PERMISSION_OVERRIDE',
    modifiedBy,
    details: `Updated granular user permissions for ${userName}`,
    reason: 'Individual Security Scope Adjustment',
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: `User override saved for ${userName}`, data: USER_OVERRIDES[userId] });
});

router.get('/hierarchy', (req, res) => {
  res.json({ success: true, data: HIERARCHY });
});

router.get('/audit-logs', (req, res) => {
  res.json({ success: true, count: AUDIT_LOGS.length, data: AUDIT_LOGS });
});

module.exports = router;
