/**
 * test order routes for development
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/test-orders',
      handler: 'order.createTestOrder',
      config: {
        auth: false // No authentication required for testing
      }
    },
    {
      method: 'GET',
      path: '/test-orders/:id',
      handler: 'order.getTestOrder',
      config: {
        auth: false // No authentication required for testing
      }
    },
    {
      method: 'GET',
      path: '/test-orders',
      handler: 'order.getTestOrders',
      config: {
        auth: false // No authentication required for testing
      }
    },
    {
      method: 'PUT',
      path: '/test-orders/:id/cancel',
      handler: 'order.cancelTestOrder',
      config: {
        auth: false // No authentication required for testing
      }
    },
    {
      method: 'POST',
      path: '/test-orders/:id/confirm-payment',
      handler: 'order.confirmTestPayment',
      config: {
        auth: false // No authentication required for testing
      }
    }
  ]
};
