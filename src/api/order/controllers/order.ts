/**
 * order controller
 */

import { factories } from '@strapi/strapi';
import { errors } from '@strapi/utils';
const { ApplicationError } = errors;

export default factories.createCoreController('api::order.order', ({ strapi }) => ({
  async create(ctx) {
    const { data } = ctx.request.body;

    // Get authenticated user
    const user = ctx.state.user;
    if (!user) {
      return ctx.unauthorized('You must be authenticated to create an order');
    }

    // Generate order number if not provided
    const orderService = strapi.service('api::order.order');
    if (!data.orderNumber) {
      data.orderNumber = await orderService.generateOrderNumber();
    }

    // Set default payment status
    if (!data.paymentStatus) {
      data.paymentStatus = 'PENDING';
    }

    // Set default order status
    if (!data.orderStatus) {
      data.orderStatus = 'PENDING';
    }

    // Ensure user is set
    if (!data.user) {
      data.user = user.id;
    }

    // Handle Coupon Logic
    if (data.coupon) {
      const coupon: any = await strapi.entityService.findOne('api::coupon.coupon', data.coupon);

      if (!coupon) {
        throw new ApplicationError('Invalid coupon code');
      }

      // Check Expiry
      if (new Date() > new Date(coupon.Expiry)) {
        throw new ApplicationError('Coupon has expired');
      }

      // Check Count
      if (coupon.Count <= 0) {
        throw new ApplicationError('Coupon usage limit reached');
      }

      // Calculate and Apply Discount
      const subtotal = parseFloat(data.subtotal);
      const tax = parseFloat(data.tax || 0);
      const shipping = parseFloat(data.shipping || 0);
      let discount = 0;

      if (coupon.Percentage) {
        discount = (subtotal * coupon.Value) / 100;
      } else {
        discount = coupon.Value;
      }

      // Ensure discount doesn't exceed subtotal (optional safety)
      discount = Math.min(discount, subtotal);

      const expectedTotal = subtotal + tax + shipping - discount;

      // Update total to match backend calculation
      data.total = expectedTotal;

      // Decrement Coupon Count
      await strapi.entityService.update('api::coupon.coupon', coupon.id, {
        data: {
          Count: coupon.Count - 1
        } as any
      });

      // Explicitly ensure coupon ID is set in data for relation linking
      data.coupon = coupon.id;
    }

    // If payment method is RAZORPAY, create Razorpay order
    if (data.paymentMethod === 'RAZORPAY' && data.total) {
      const razorpayOrderId = await orderService.createRazorpayOrder(
        parseFloat(data.total.toString()),
        data.orderNumber
      );

      if (razorpayOrderId) {
        data.razorpayOrderId = razorpayOrderId;
      } else {
        // If Razorpay order creation fails, return error
        return ctx.badRequest('Failed to create Razorpay order. Please try again or use COD.');
      }
    }

    // Create the order using entityService
    const order = await strapi.entityService.create('api::order.order', {
      data,
      populate: ['coupon'] as any
    });

    // Log for debugging
    strapi.log.info('Order created:', {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: user.id,
      paymentMethod: order.paymentMethod,
      razorpayOrderId: order.razorpayOrderId || 'N/A',
      couponId: typeof (order as any).coupon === 'object' ? (order as any).coupon?.id : (order as any).coupon
    });

    // Sanitize the response
    const sanitizedEntity = await this.sanitizeOutput(order, ctx);

    return this.transformResponse(sanitizedEntity);
  },

  async find(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be authenticated to view orders');
    }

    // Filter orders by the authenticated user
    const orders = await strapi.entityService.findMany('api::order.order', {
      filters: {
        user: {
          id: user.id,
        },
      },
      sort: { createdAt: 'desc' },
      populate: ['user', 'coupon'] as any,
    });

    // Sanitize the response
    const sanitizedEntities = await this.sanitizeOutput(orders, ctx);

    return this.transformResponse(sanitizedEntities);
  },

  async findOne(ctx) {
    const { id } = ctx.params;
    const user = ctx.state.user;

    if (!user) {
      return ctx.unauthorized('You must be authenticated to view orders');
    }

    // Find order by id
    const order = await strapi.db.query('api::order.order').findOne({
      where: { id: parseInt(id) },
      populate: ['user', 'coupon'] as any,
    });

    if (!order) {
      return ctx.notFound('Order not found');
    }

    // Check if order belongs to the authenticated user
    const orderUserId = typeof order.user === 'object' ? order.user?.id : order.user;
    if (orderUserId !== user.id) {
      return ctx.forbidden('You do not have permission to view this order');
    }

    // Use entityService to get the order in the correct format
    const orderEntity = await strapi.entityService.findOne('api::order.order', parseInt(id), {
      populate: ['user', 'coupon'] as any,
    });

    if (!orderEntity) {
      return ctx.notFound('Order not found');
    }

    // Sanitize the response
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

    // Find order by id
    const order = await strapi.db.query('api::order.order').findOne({
      where: { id: parseInt(id) },
      populate: ['user', 'coupon'] as any,
    });

    if (!order) {
      return ctx.notFound('Order not found');
    }

    // Check if order belongs to the authenticated user
    const orderUserId = typeof order.user === 'object' ? order.user?.id : order.user;
    if (orderUserId !== user.id) {
      return ctx.forbidden('You do not have permission to update this order');
    }

    // Only allow certain status updates
    if (data.orderStatus && !['PENDING', 'CONFIRMED', 'CANCELLED'].includes(data.orderStatus)) {
      return ctx.badRequest('Invalid order status update');
    }

    // Update the order
    const updatedOrder = await strapi.entityService.update('api::order.order', parseInt(id), {
      data,
      populate: ['coupon'] as any
    });

    // Sanitize the response
    const sanitizedEntity = await this.sanitizeOutput(updatedOrder, ctx);

    return this.transformResponse(sanitizedEntity);
  },
}));
