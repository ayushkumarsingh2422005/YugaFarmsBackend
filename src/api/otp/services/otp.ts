/**
 * OTP service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::otp.otp', ({ strapi }) => ({
  /**
   * Generate a random OTP code
   */
  generateCode(length: number = 6): string {
    return Math.floor(100000 + Math.random() * 900000).toString().slice(0, length);
  },

  /**
   * Create and store OTP for a phone number
   */
  async createOTP(phone: string): Promise<string> {
    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Delete any existing unused OTPs for this phone using database query
    const existingOTPs = await strapi.db.query('api::otp.otp').findMany({
      where: {
        phone: cleanPhone,
        isUsed: false,
      },
    });
    
    // Delete each existing OTP
    for (const otp of existingOTPs) {
      await strapi.db.query('api::otp.otp').delete({
        where: { id: otp.id },
      });
    }

    // Generate new OTP
    const code = this.generateCode(6);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // OTP expires in 10 minutes

    // Store OTP
    await strapi.entityService.create('api::otp.otp', {
      data: {
        phone: cleanPhone,
        code,
        expiresAt,
        isUsed: false,
        attempts: 0,
      },
    });

    return code;
  },

  /**
   * Verify OTP code
   */
  async verifyOTP(phone: string, code: string): Promise<boolean> {
    const cleanPhone = phone.replace(/\D/g, '');

    // Find the most recent unused OTP for this phone using database query
    const otps = await strapi.db.query('api::otp.otp').findMany({
      where: {
        phone: cleanPhone,
        isUsed: false,
      },
      orderBy: { createdAt: 'desc' },
      limit: 1,
    });

    if (!otps || otps.length === 0) {
      return false;
    }

    const otp = otps[0];

    // Check if OTP is expired
    if (new Date(otp.expiresAt) < new Date()) {
      return false;
    }

    // Check if too many attempts
    if (otp.attempts >= 5) {
      return false;
    }

    // Verify code
    if (otp.code !== code) {
      // Increment attempts
      await strapi.db.query('api::otp.otp').update({
        where: { id: otp.id },
        data: {
          attempts: otp.attempts + 1,
        },
      });
      return false;
    }

    // Mark OTP as used
    await strapi.db.query('api::otp.otp').update({
      where: { id: otp.id },
      data: {
        isUsed: true,
      },
    });

    return true;
  },

  /**
   * Send OTP via SMS using Brevo Transactional SMS API
   */
  async sendSMS(phone: string, code: string): Promise<boolean> {
    try {
      // Get Brevo API key from environment
      const apiKey = process.env.BREVO_API_KEY;
      
      if (!apiKey) {
        strapi.log.error('BREVO_API_KEY is not configured in environment variables');
        return false;
      }

      // Get SMS sender name from environment (default to "YugaFarms")
      const senderName = process.env.BREVO_SMS_SENDER_NAME || 'YugaFarms';
      
      // Format phone number - Brevo expects it without + prefix, just digits
      // Example: +33680065433 becomes 33680065433
      const cleanPhone = phone.replace(/\D/g, '');
      
      // Create SMS message
      const message = `Your YugaFarms OTP is: ${code}. Valid for 10 minutes. Do not share this code with anyone.`;
      
      // Prepare request body according to Brevo API documentation
      const requestBody = {
        sender: senderName,
        recipient: cleanPhone,
        content: message,
        type: 'transactional', // Use 'transactional' for OTP, 'marketing' for promotions
        // Optional fields (uncomment if needed):
        // tag: 'otp-verification',
        // webUrl: '', // Optional webhook URL
        // unicodeEnabled: true, // Enable if sending in non-Latin scripts
        // organisationPrefix: 'YugaFarms', // Optional organization prefix
      };

      // Make API request to Brevo
      const response = await fetch('https://api.brevo.com/v3/transactionalSMS/send', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      // Parse response
      const responseData = await response.json();

      if (!response.ok) {
        strapi.log.error('Brevo SMS API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: responseData,
        });
        return false;
      }

      // Log success (optional - remove in production if sensitive)
      const messageId = (responseData as any)?.messageId || (responseData as any)?.id;
      strapi.log.info(`OTP SMS sent successfully to ${cleanPhone}`, {
        messageId: messageId,
      });

      return true;
    } catch (error) {
      strapi.log.error('Error sending SMS via Brevo:', error);
      return false;
    }
  },
}));