/**
 * Authenticated profile update (own user only) — avoids users-permissions PUT /users/:id policy issues.
 */

import type { Core } from '@strapi/strapi';

const USER_UID = 'plugin::users-permissions.user' as const;

const ALLOWED_KEYS = new Set([
  'username',
  'email',
  'AddressLine1',
  'AddressLine2',
  'City',
  'State',
  'Pin',
]);

function pickProfileData(body: Record<string, unknown>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      data[key] = body[key];
    }
  }
  return data;
}

async function resolveUserIdFromRequest(strapi: Core.Strapi, ctx: { request: { header: { authorization?: string } } }) {
  const auth = ctx.request.header.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const decoded = await jwtService.verify(auth.slice(7));
    const id = decoded?.id;
    return id != null ? Number(id) : null;
  } catch {
    return null;
  }
}

export default {
  async updateMe(ctx) {
    const userId = await resolveUserIdFromRequest(strapi, ctx);
    if (!userId) {
      return ctx.unauthorized('Missing or invalid credentials');
    }

    const raw = (ctx.request.body || {}) as Record<string, unknown>;
    const data = pickProfileData(raw);

    if (Object.keys(data).length === 0) {
      return ctx.badRequest('No valid profile fields to update');
    }

    if (typeof data.username === 'string' && data.username.trim().length < 3) {
      return ctx.badRequest('Name must be at least 3 characters');
    }

    if (data.Pin != null) {
      const pin = Number(data.Pin);
      if (!Number.isFinite(pin) || pin < 100000 || pin > 999999) {
        return ctx.badRequest('PIN must be a 6-digit number');
      }
      data.Pin = pin;
    }

    try {
      const updated = await strapi.entityService.update(USER_UID, userId, {
        data: data as never,
      });

      const user = await strapi.entityService.findOne(USER_UID, userId, {
        fields: [
          'id',
          'username',
          'email',
          'provider',
          'Phone',
          'AddressLine1',
          'AddressLine2',
          'City',
          'State',
          'Pin',
        ] as never,
      });

      return ctx.send(user ?? updated);
    } catch (error) {
      strapi.log.error('profile.updateMe failed:', error);
      const msg = error instanceof Error ? error.message : 'Update failed';
      if (msg.toLowerCase().includes('unique')) {
        return ctx.badRequest(msg);
      }
      return ctx.badRequest('Could not update profile');
    }
  },
};
