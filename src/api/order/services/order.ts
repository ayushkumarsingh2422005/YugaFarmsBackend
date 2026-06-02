/**
 * order service
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import Razorpay from 'razorpay';

const { ApplicationError } = errors;

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

  /**
   * Validate coupon and adjust order total. Optionally decrement coupon usage.
   */
  async applyCouponToOrderData(
    data: Record<string, unknown>,
    options: { decrement: boolean }
  ): Promise<void> {
    if (!data.coupon) return;

    const coupon: any = await strapi.entityService.findOne('api::coupon.coupon', data.coupon as number);

    if (!coupon) {
      throw new ApplicationError('Invalid coupon code');
    }

    if (new Date() > new Date(coupon.Expiry)) {
      throw new ApplicationError('Coupon has expired');
    }

    if (coupon.Count <= 0) {
      throw new ApplicationError('Coupon usage limit reached');
    }

    const subtotal = parseFloat(String(data.subtotal));
    const tax = parseFloat(String(data.tax || 0));
    const shipping = parseFloat(String(data.shipping || 0));
    let discount = 0;

    if (coupon.Percentage) {
      discount = (subtotal * coupon.Value) / 100;
    } else {
      discount = coupon.Value;
    }

    discount = Math.min(discount, subtotal);
    data.total = subtotal + tax + shipping - discount;
    data.coupon = coupon.id;

    if (options.decrement) {
      await strapi.entityService.update('api::coupon.coupon', coupon.id, {
        data: { Count: coupon.Count - 1 } as never,
      });
    }
  },

  verifyRazorpayPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return false;
    }
    const expected = createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    try {
      return timingSafeEqual(
        Buffer.from(expected, 'utf8'),
        Buffer.from(razorpaySignature, 'utf8')
      );
    } catch {
      return expected === razorpaySignature;
    }
  },

  /** Receipt id for Razorpay only — no Strapi order row until payment succeeds. */
  generateRazorpayReceiptRef(): string {
    return `INTENT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  },
}));
