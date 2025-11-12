import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }: { strapi: Core.Strapi }) {
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
  },
};
