/**
 * order router
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::order.order', {
  config: {
    find: {
      auth: {
        scope: ['find']
      }
    },
    findOne: {
      auth: {
        scope: ['findOne']
      }
    },
    create: {
      auth: {
        scope: ['create']
      }
    }
  }
});

// Custom routes
export const customRoutes = {
  routes: [
    {
      method: 'POST',
      path: '/orders/:id/confirm-payment',
      handler: 'order.confirmPayment',
      config: {
        auth: {
          scope: ['update']
        }
      }
    }
  ]
};
