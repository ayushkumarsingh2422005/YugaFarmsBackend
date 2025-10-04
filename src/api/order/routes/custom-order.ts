/**
 * custom order routes
 */

export default {
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
