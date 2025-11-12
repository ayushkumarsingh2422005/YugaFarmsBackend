/**
 * order controller
 */

import { factories } from '@strapi/strapi';

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
    });
    
    // Log for debugging
    strapi.log.info('Order created:', { 
      id: order.id,
      orderNumber: order.orderNumber,
      userId: user.id,
      paymentMethod: order.paymentMethod,
      razorpayOrderId: order.razorpayOrderId || 'N/A'
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
      populate: ['user'],
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
      populate: ['user'],
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
      populate: ['user'],
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
      populate: ['user'],
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
    });
    
    // Sanitize the response
    const sanitizedEntity = await this.sanitizeOutput(updatedOrder, ctx);
    
    return this.transformResponse(sanitizedEntity);
  },
}));
