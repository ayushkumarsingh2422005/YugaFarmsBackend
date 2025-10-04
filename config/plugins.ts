export default ({ env }) => ({
  email: {
    config: {
      provider: 'strapi-provider-email-brevo',
      providerOptions: {
        apiKey: env('BREVO_API_KEY'), // Use environment variable for security
      },
      settings: {
        defaultSenderEmail: env('EMAIL_FROM'),
        defaultSenderName: env('EMAIL_FROM_NAME'),
        defaultReplyTo: env('EMAIL_REPLY_TO'),
      },
    },
  },
});
