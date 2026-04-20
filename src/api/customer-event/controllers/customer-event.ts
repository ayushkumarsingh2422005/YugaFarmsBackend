/**
 * customer-event controller
 */

import { factories } from '@strapi/strapi';

const MAX_PAYLOAD_BYTES = 12_000;

export default factories.createCoreController('api::customer-event.customer-event', ({ strapi }) => ({
  /**
   * Public endpoint: optional Bearer JWT links event to user (verified server-side).
   * Body: { data: { eventName, occurredAt?, path?, payload? } } (Strapi shape) or flat fields.
   */
  async track(ctx) {
    const body = (ctx.request.body || {}) as {
      data?: Record<string, unknown>;
      eventName?: string;
      occurredAt?: string;
      path?: string;
      payload?: unknown;
    };
    const data = (body.data || body) as Record<string, unknown>;
    const eventName = data.eventName as string | undefined;
    if (eventName !== 'cart' && eventName !== 'checkout') {
      return ctx.badRequest('Invalid eventName');
    }

    let userId: number | undefined;
    const auth = ctx.request.header.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const jwtService = strapi.plugin('users-permissions').service('jwt');
        const decoded = await jwtService.verify(auth.slice(7));
        if (decoded?.id) userId = Number(decoded.id);
      } catch {
        // ignore invalid or expired token
      }
    }

    const rawPayload = data.payload;
    if (rawPayload !== undefined && rawPayload !== null) {
      let serialized: string;
      try {
        serialized = JSON.stringify(rawPayload);
      } catch {
        return ctx.badRequest('Invalid payload');
      }
      if (serialized.length > MAX_PAYLOAD_BYTES) {
        return ctx.badRequest('Payload too large');
      }
    }

    const occurredAt = (data.occurredAt as string) || new Date().toISOString();
    const publishedAt = (data.publishedAt as string) || occurredAt;

    const createData: Record<string, unknown> = {
      eventName,
      occurredAt,
      path: typeof data.path === 'string' ? data.path : null,
      payload: rawPayload === undefined ? null : rawPayload,
      publishedAt,
    };
    if (userId) {
      createData.user = userId;
    }

    const created = await strapi.entityService.create('api::customer-event.customer-event', {
      data: createData as any,
    });

    return ctx.send({ data: { id: created.id } });
  },
}));
