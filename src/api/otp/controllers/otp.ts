/**
 * OTP controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::otp.otp', ({ strapi }) => ({
  /**
   * Send OTP to phone number
   */
  async sendOTP(ctx) {
    try {
      const { phone } = ctx.request.body;

      if (!phone) {
        return ctx.badRequest('Phone number is required');
      }

      // Validate phone number format
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        return ctx.badRequest('Invalid phone number format');
      }

      // Generate and store OTP
      const otpService = strapi.service('api::otp.otp');
      const code = await otpService.createOTP(cleanPhone);

      // Send SMS via Brevo - pass original phone to preserve format for logging
      const sent = await otpService.sendSMS(phone, code);
      
      if (!sent) {
        return ctx.internalServerError('Failed to send OTP');
      }

      // Don't send the code back in production for security
      return ctx.send({
        message: 'OTP sent successfully to your phone number',
      });
    } catch (error) {
      strapi.log.error('Error in sendOTP:', error);
      return ctx.internalServerError('Failed to send OTP');
    }
  },

  /**
   * Verify OTP (this will be handled by auth controller, but keeping for flexibility)
   */
  async verifyOTP(ctx) {
    try {
      const { phone, code } = ctx.request.body;

      if (!phone || !code) {
        return ctx.badRequest('Phone and OTP code are required');
      }

      const otpService = strapi.service('api::otp.otp');
      const isValid = await otpService.verifyOTP(phone, code);

      if (!isValid) {
        return ctx.badRequest('Invalid or expired OTP');
      }

      return ctx.send({ message: 'OTP verified successfully' });
    } catch (error) {
      strapi.log.error('Error in verifyOTP:', error);
      return ctx.internalServerError('Failed to verify OTP');
    }
  },

  /**
   * Login or Register with OTP
   */
  async loginWithOTP(ctx) {
    try {
      const { phone, code } = ctx.request.body;

      if (!phone || !code) {
        return ctx.badRequest('Phone and OTP code are required');
      }

      const cleanPhone = phone.replace(/\D/g, '');

      // Verify OTP
      const otpService = strapi.service('api::otp.otp');
      const isValid = await otpService.verifyOTP(cleanPhone, code);

      if (!isValid) {
        return ctx.badRequest('Invalid or expired OTP');
      }

      // Check if user exists
      const user = await strapi.db
        .query('plugin::users-permissions.user')
        .findOne({
          where: { Phone: cleanPhone },
          populate: ['role'],
        });

      let userId;
      let userData;

      if (user) {
        // User exists - login
        userId = user.id;
        userData = user;
      } else {
        // User doesn't exist - create new user
        const defaultRole = await strapi.db
          .query('plugin::users-permissions.role')
          .findOne({
            where: { type: 'authenticated' },
          });

        if (!defaultRole) {
          return ctx.internalServerError('Default role not found');
        }

        // Generate a username from phone (ensure uniqueness)
        let username = `user_${cleanPhone.slice(-6)}`;
        let counter = 1;
        
        // Check if username already exists
        while (await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { username },
        })) {
          username = `user_${cleanPhone.slice(-6)}_${counter}`;
          counter++;
        }

        userData = await strapi.db
          .query('plugin::users-permissions.user')
          .create({
            data: {
              Phone: cleanPhone,
              username,
              confirmed: true,
              provider: 'local',
              role: defaultRole.id,
            },
          });

        userId = userData.id;
      }

      // Generate JWT token
      const jwtService = strapi.plugin('users-permissions').service('jwt');
      const jwt = jwtService.issue({
        id: userId,
      });

      // Get user with relations
      const userWithRelations = await strapi.db
        .query('plugin::users-permissions.user')
        .findOne({
          where: { id: userId },
          populate: ['role'],
        });

      return ctx.send({
        jwt,
        user: {
          id: userWithRelations.id,
          username: userWithRelations.username,
          email: userWithRelations.email,
          Phone: userWithRelations.Phone,
          role: userWithRelations.role,
        },
      });
    } catch (error) {
      strapi.log.error('Error in loginWithOTP:', error);
      return ctx.internalServerError('Authentication failed');
    }
  },
}));
