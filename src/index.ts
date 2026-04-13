import type { Context } from 'koa';
import type { Core } from '@strapi/strapi';

const USER_UID = 'plugin::users-permissions.user' as const;
const CART_BACKFILL_STORE_KEY = 'cart_has_items_backfill_v1';

/** True when saved cart JSON is a non-empty array (storefront cart shape). */
function cartHasNonEmptyItems(cart: unknown): boolean {
  if (cart == null) return false;
  if (Array.isArray(cart)) return cart.length > 0;
  if (typeof cart === 'string') {
    try {
      const parsed = JSON.parse(cart) as unknown;
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  }
  return false;
}

function applyCartHasItemsFromCart(data: Record<string, unknown> | undefined) {
  if (!data || !Object.prototype.hasOwnProperty.call(data, 'cart')) return;
  data.cartHasItems = cartHasNonEmptyItems(data.cart);
}

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }: { strapi: Core.Strapi }) {
    strapi.db.lifecycles.subscribe({
      models: [USER_UID],
      async beforeCreate(event) {
        applyCartHasItemsFromCart(event.params.data as Record<string, unknown>);
      },
      async beforeUpdate(event) {
        applyCartHasItemsFromCart(event.params.data as Record<string, unknown>);
      },
    });
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Meta catalog feed at site root (not under /api). Content API is mounted at /api, so
    // /api/catalog_products.csv would also work if registered there; this matches common feed URLs.
    const catalogCsvHandler = async (ctx: Context) => {
      const ctrl = strapi.controller('api::product.product') as {
        catalogCsv: (c: Context) => Promise<void>;
      };
      await ctrl.catalogCsv(ctx);
    };

    strapi.server.routes([
      {
        method: 'GET',
        path: '/catalog_products.csv',
        handler: catalogCsvHandler,
        config: { auth: false, policies: [], middlewares: [] },
      },
      {
        method: 'GET',
        path: '/api/catalog_products.csv',
        handler: catalogCsvHandler,
        config: { auth: false, policies: [], middlewares: [] },
      },
    ]);

    // Clean up expired OTPs periodically (optional)
    setInterval(async () => {
      try {
        const expiredOTPs = await strapi.db.query('api::otp.otp').findMany({
          where: {
            expiresAt: {
              $lt: new Date(),
            },
            isUsed: false,
          },
        });

        for (const otp of expiredOTPs) {
          await strapi.db.query('api::otp.otp').delete({
            where: { id: otp.id },
          });
        }
      } catch (error) {
        strapi.log.error('Error cleaning up expired OTPs:', error);
      }
    }, 60 * 60 * 1000); // Run every hour

    void (async () => {
      try {
        const done = await strapi.store.get({
          type: 'plugin',
          name: 'yuga-farms',
          key: CART_BACKFILL_STORE_KEY,
        });
        if (done) return;

        const users = await strapi.db.query(USER_UID).findMany({
          select: ['id', 'cart'],
        });

        for (const u of users) {
          const hasItems = cartHasNonEmptyItems(u.cart);
          await strapi.db.query(USER_UID).update({
            where: { id: u.id },
            data: { cartHasItems: hasItems },
          });
        }

        await strapi.store.set({
          type: 'plugin',
          name: 'yuga-farms',
          key: CART_BACKFILL_STORE_KEY,
          value: true,
        });

        strapi.log.info(
          `[yuga-farms] Backfilled cartHasItems for ${users.length} user(s) (Content Manager filter).`
        );
      } catch (error) {
        strapi.log.error('[yuga-farms] cartHasItems backfill failed:', error);
      }
    })();
  },
};
