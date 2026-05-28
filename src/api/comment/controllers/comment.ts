/**
 * comment controller
 */

import { factories } from '@strapi/strapi';

const ALLOWED_TYPES = new Set(['Common', 'Ghee', 'Honey']);
const clampRating = (value: number) => Math.max(0, Math.min(5, Math.round(value)));
const getRelatedUserId = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') return null;
  const v = value as { id?: unknown; data?: { id?: unknown } | null };
  if (v.id != null) {
    const id = Number(v.id);
    return Number.isFinite(id) ? id : null;
  }
  if (v.data?.id != null) {
    const id = Number(v.data.id);
    return Number.isFinite(id) ? id : null;
  }
  return null;
};

export default factories.createCoreController('api::comment.comment' as never, ({ strapi }) => ({
  async create(ctx) {
    const payload = (ctx.request.body?.data ?? ctx.request.body ?? {}) as {
      Comment?: string;
      Type?: 'Common' | 'Ghee' | 'Honey';
      Rating?: number;
    };

    const comment = String(payload.Comment ?? '').trim();
    const type = payload.Type;
    const rating = payload.Rating;

    if (!comment) {
      return ctx.badRequest('Comment is required');
    }
    if (!type || !ALLOWED_TYPES.has(type)) {
      return ctx.badRequest('Type must be Common, Ghee, or Honey');
    }

    const data: Record<string, unknown> = {
      Comment: comment,
      Type: type,
      // Make review visible on public API immediately (comment model has draft/publish on).
      publishedAt: new Date(),
    };

    if (typeof rating === 'number' && Number.isFinite(rating)) {
      data.Rating = Math.max(0, Math.min(5, Math.round(rating)));
    }

    if (ctx.state.user?.id) {
      data.user = ctx.state.user.id;
    }

    const created = await strapi.entityService.create('api::comment.comment' as never, {
      data,
      populate: { user: true },
    });

    ctx.body = { data: created };
  },

  async update(ctx) {
    const commentId = Number.parseInt(String(ctx.params.id), 10);
    if (!Number.isFinite(commentId) || commentId <= 0) {
      return ctx.badRequest('Invalid comment id');
    }

    if (!ctx.state.user?.id) {
      return ctx.unauthorized('Login required');
    }

    const existing = await strapi.entityService.findOne('api::comment.comment' as never, commentId, {
      populate: { user: true },
    }) as { user?: { id?: number } | null } | null;

    if (!existing) {
      return ctx.notFound('Comment not found');
    }

    const ownerId = getRelatedUserId(existing.user);
    if (!ownerId || ownerId !== Number(ctx.state.user.id)) {
      return ctx.forbidden('You can edit only your own comment');
    }

    const payload = (ctx.request.body?.data ?? ctx.request.body ?? {}) as {
      Comment?: string;
      Rating?: number;
    };

    const data: Record<string, unknown> = {};
    if (typeof payload.Comment === 'string') {
      const nextComment = payload.Comment.trim();
      if (!nextComment) {
        return ctx.badRequest('Comment cannot be empty');
      }
      data.Comment = nextComment;
    }

    if (typeof payload.Rating === 'number' && Number.isFinite(payload.Rating)) {
      data.Rating = clampRating(payload.Rating);
    }

    // Keep edited reviews published/visible.
    data.publishedAt = new Date();

    if (Object.keys(data).length === 0) {
      return ctx.badRequest('No editable fields provided');
    }

    const updated = await strapi.entityService.update('api::comment.comment' as never, commentId, {
      data,
      populate: { user: true },
    });

    ctx.body = { data: updated };
  },

  async delete(ctx) {
    const commentId = Number.parseInt(String(ctx.params.id), 10);
    if (!Number.isFinite(commentId) || commentId <= 0) {
      return ctx.badRequest('Invalid comment id');
    }
    if (!ctx.state.user?.id) {
      return ctx.unauthorized('Login required');
    }

    const existing = await strapi.entityService.findOne('api::comment.comment' as never, commentId, {
      populate: { user: true },
    }) as { user?: unknown } | null;

    if (!existing) {
      return ctx.notFound('Comment not found');
    }

    const ownerId = getRelatedUserId(existing.user);
    if (!ownerId || ownerId !== Number(ctx.state.user.id)) {
      return ctx.forbidden('You can delete only your own comment');
    }

    const deleted = await strapi.entityService.delete('api::comment.comment' as never, commentId, {
      populate: { user: true },
    });
    ctx.body = { data: deleted };
  },
}));
