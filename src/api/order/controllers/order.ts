/**
 * order controller
 */

import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const { ApplicationError } = errors;

async function resolveAuthenticatedUser(ctx: { state: { user?: { id: number } }; request: { header: { authorization?: string } } }) {
  if (ctx.state.user) {
    return ctx.state.user;
  }
  const auth = ctx.request.header.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return null;
  }
  try {
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const decoded = await jwtService.verify(auth.slice(7));
    if (!decoded?.id) return null;
    return { id: Number(decoded.id) };
  } catch {
    return null;
  }
}

function normalizeOrderInput(data: Record<string, unknown>, userId: number) {
  if (!data.user) {
    data.user = userId;
  }
  return data;
}

export default factories.createCoreController('api::order.order', ({ strapi }) => ({
  async create(ctx) {
    const body = (ctx.request.body || {}) as Record<string, unknown>;

    if (body.razorpayConfirm === true) {
      return this.confirmRazorpayPayment(ctx);
    }

    const { data } = body as { data?: Record<string, unknown> };
    if (!data) {
      return ctx.badRequest('Missing order data');
    }

    if (data.razorpayIntentOnly === true) {
      delete data.razorpayIntentOnly;
      data.paymentMethod = 'RAZORPAY';
      return this.createRazorpayIntent(ctx);
    }

    const user = await resolveAuthenticatedUser(ctx);
    if (!user) {
      return ctx.unauthorized('You must be authenticated to create an order');
    }
    ctx.state.user = user;

    if (data.paymentMethod === 'RAZORPAY') {
      return ctx.badRequest(
        'Online payment must use razorpay-intent (or razorpayIntentOnly on create).'
      );
    }

    const orderService = strapi.service('api::order.order');
    if (!data.orderNumber) {
      data.orderNumber = await orderService.generateOrderNumber();
    }

    if (!data.paymentStatus) {
      data.paymentStatus = 'PENDING';
    }

    if (!data.orderStatus) {
      data.orderStatus = 'CONFIRMED';
    }

    normalizeOrderInput(data, user.id);

    try {
      await orderService.applyCouponToOrderData(data, { decrement: true });
    } catch (err) {
      if (err instanceof ApplicationError) {
        return ctx.badRequest(err.message);
      }
      throw err;
    }

    const order = await strapi.entityService.create('api::order.order', {
      data,
      populate: ['coupon'] as never,
    });

    strapi.log.info('Order created (COD):', {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: user.id,
    });

    const sanitizedEntity = await this.sanitizeOutput(order, ctx);
    return this.transformResponse(sanitizedEntity);
  },

  /**
   * Step 1 — Create Razorpay checkout only (no Strapi order until payment succeeds).
   */
  async createRazorpayIntent(ctx) {
    const user = await resolveAuthenticatedUser(ctx);
    if (!user) {
      return ctx.unauthorized('You must be authenticated');
    }

    const { data } = ctx.request.body;
    if (!data || data.paymentMethod !== 'RAZORPAY') {
      return ctx.badRequest('paymentMethod must be RAZORPAY');
    }

    const orderService = strapi.service('api::order.order');
    normalizeOrderInput(data, user.id);

    try {
      await orderService.applyCouponToOrderData(data, { decrement: false });
    } catch (err) {
      if (err instanceof ApplicationError) {
        return ctx.badRequest(err.message);
      }
      throw err;
    }

    const total = parseFloat(String(data.total));
    if (!Number.isFinite(total) || total <= 0) {
      return ctx.badRequest('Invalid order total');
    }

    const receiptRef = orderService.generateRazorpayReceiptRef();
    const razorpayOrderId = await orderService.createRazorpayOrder(total, receiptRef);

    if (!razorpayOrderId) {
      return ctx.badRequest('Failed to create Razorpay order. Please try again or use COD.');
    }

    return ctx.send({
      razorpayOrderId,
      amount: Math.round(total * 100),
      currency: 'INR',
      receiptRef,
    });
  },

  /**
   * Step 2 — Verify payment and create the real Strapi order.
   */
  async confirmRazorpayPayment(ctx) {
    const user = await resolveAuthenticatedUser(ctx);
    if (!user) {
      return ctx.unauthorized('You must be authenticated');
    }

    const body = ctx.request.body as {
      data?: Record<string, unknown>;
      razorpay_payment_id?: string;
      razorpay_order_id?: string;
      razorpay_signature?: string;
    };

    const orderData = body.data;
    const razorpayPaymentId = body.razorpay_payment_id;
    const razorpayOrderId = body.razorpay_order_id;
    const razorpaySignature = body.razorpay_signature;

    if (!orderData || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return ctx.badRequest('Missing order data or payment verification fields');
    }

    const orderService = strapi.service('api::order.order');
    const valid = orderService.verifyRazorpayPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!valid) {
      return ctx.badRequest('Payment verification failed');
    }

    const existing = await strapi.db.query('api::order.order').findOne({
      where: { razorpayPaymentId },
    });

    if (existing) {
      const sanitizedEntity = await this.sanitizeOutput(existing, ctx);
      return this.transformResponse(sanitizedEntity);
    }

    normalizeOrderInput(orderData, user.id);
    orderData.paymentMethod = 'RAZORPAY';
    orderData.paymentStatus = 'PAID';
    orderData.orderStatus = 'CONFIRMED';
    orderData.razorpayOrderId = razorpayOrderId;
    orderData.razorpayPaymentId = razorpayPaymentId;
    orderData.razorpaySignature = razorpaySignature;
    orderData.orderNumber = await orderService.generateOrderNumber();

    try {
      await orderService.applyCouponToOrderData(orderData, { decrement: true });
    } catch (err) {
      if (err instanceof ApplicationError) {
        return ctx.badRequest(err.message);
      }
      throw err;
    }

    const order = await strapi.entityService.create('api::order.order', {
      data: orderData,
      populate: ['coupon'] as never,
    });

    strapi.log.info('Order created (Razorpay paid):', {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: user.id,
      razorpayPaymentId,
    });

    const sanitizedEntity = await this.sanitizeOutput(order, ctx);
    return this.transformResponse(sanitizedEntity);
  },

  async find(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be authenticated to view orders');
    }

    const orders = await strapi.entityService.findMany('api::order.order', {
      filters: {
        user: { id: user.id },
        $or: [
          { paymentMethod: 'COD' },
          { paymentStatus: 'PAID' },
          { paymentStatus: 'FAILED' },
          { paymentStatus: 'REFUNDED' },
        ],
      },
      sort: { createdAt: 'desc' },
      populate: ['user', 'coupon'] as never,
    });

    const sanitizedEntities = await this.sanitizeOutput(orders, ctx);
    return this.transformResponse(sanitizedEntities);
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be authenticated to view orders');
    }

    const order = await strapi.db.query('api::order.order').findOne({
      where: { id: parseInt(id) },
      populate: ['user', 'coupon'] as never,
    });

    if (!order) {
      return ctx.notFound('Order not found');
    }

    const orderUserId = typeof order.user === 'object' ? order.user?.id : order.user;
    if (orderUserId !== user.id) {
      return ctx.forbidden('You do not have permission to view this order');
    }

    if (
      order.paymentMethod === 'RAZORPAY' &&
      order.paymentStatus === 'PENDING'
    ) {
      return ctx.notFound('Order not found');
    }

    const orderEntity = await strapi.entityService.findOne('api::order.order', parseInt(id), {
      populate: ['user', 'coupon'] as never,
    });

    if (!orderEntity) {
      return ctx.notFound('Order not found');
    }

    const sanitizedEntity = await this.sanitizeOutput(orderEntity, ctx);
    return this.transformResponse(sanitizedEntity);
  },

  async update(ctx) {
    const { id } = ctx.params;
    const { data } = ctx.request.body;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be authenticated to update orders');
    }

    const order = await strapi.db.query('api::order.order').findOne({
      where: { id: parseInt(id) },
      populate: ['user', 'coupon'] as never,
    });

    if (!order) {
      return ctx.notFound('Order not found');
    }

    const orderUserId = typeof order.user === 'object' ? order.user?.id : order.user;
    if (orderUserId !== user.id) {
      return ctx.forbidden('You do not have permission to update this order');
    }

    if (data.orderStatus && !['PENDING', 'CONFIRMED', 'CANCELLED'].includes(data.orderStatus)) {
      return ctx.badRequest('Invalid order status update');
    }

    const updatedOrder = await strapi.entityService.update('api::order.order', parseInt(id), {
      data,
      populate: ['coupon'] as never,
    });

    const sanitizedEntity = await this.sanitizeOutput(updatedOrder, ctx);
    return this.transformResponse(sanitizedEntity);
  },
}));
