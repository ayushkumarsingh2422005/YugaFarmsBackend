/**
 * order service
 */

import { factories } from '@strapi/strapi';
import Razorpay from 'razorpay';

export default factories.createCoreService('api::order.order', ({ strapi }) => ({
  /**
   * Generate a unique order number
   */
  async generateOrderNumber(): Promise<string> {
    const prefix = 'YGF';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const orderNumber = `${prefix}-${timestamp}-${random}`;
    
    // Check if order number already exists
    const existing = await strapi.db.query('api::order.order').findOne({
      where: { orderNumber },
    });
    
    if (existing) {
      // If exists, generate a new one recursively
      return this.generateOrderNumber();
    }
    
    return orderNumber;
  },

  /**
   * Create a Razorpay order
   */
  async createRazorpayOrder(amount: number, orderNumber: string, currency: string = 'INR'): Promise<string | null> {
    try {
      const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
      const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!razorpayKeyId || !razorpayKeySecret) {
        strapi.log.warn('Razorpay credentials not configured. Skipping Razorpay order creation.');
        return null;
      }

      const razorpay = new Razorpay({
        key_id: razorpayKeyId,
        key_secret: razorpayKeySecret,
      });

      const options = {
        amount: Math.round(amount * 100), // Convert to paise
        currency: currency,
        receipt: orderNumber,
        notes: {
          order_number: orderNumber,
        },
      };

      const razorpayOrder = await razorpay.orders.create(options);
      
      strapi.log.info('Razorpay order created:', {
        razorpayOrderId: razorpayOrder.id,
        orderNumber: orderNumber,
      });

      return razorpayOrder.id;
    } catch (error) {
      strapi.log.error('Error creating Razorpay order:', error);
      return null;
    }
  },
}));
