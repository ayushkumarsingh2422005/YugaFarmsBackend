module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  // Fix for secure cookie issue
  admin: {
    auth: {
      options: {
        expiresIn: '7d',
      },
      sessions: {
        maxRefreshTokenLifespan: '7d',
        maxSessionLifespan: '7d',
      },
    },
  },
  // Cookie configuration
  cookies: {
    secure: false,
    sameSite: 'none',
  },
});