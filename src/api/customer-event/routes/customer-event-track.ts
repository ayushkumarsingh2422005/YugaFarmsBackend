/**
 * Append-only analytics: no public create on the core REST controller required.
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/customer-event/track',
      handler: 'customer-event.track',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
