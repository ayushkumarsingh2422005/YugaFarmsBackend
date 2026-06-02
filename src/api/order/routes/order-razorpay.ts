/**
 * Razorpay checkout: intent (no DB order) → confirm after payment.
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/orders/razorpay-intent',
      handler: 'order.createRazorpayIntent',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/orders/razorpay-confirm',
      handler: 'order.confirmRazorpayPayment',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
