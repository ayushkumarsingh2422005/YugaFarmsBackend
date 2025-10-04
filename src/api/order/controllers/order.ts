/**
 * order controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::order.order', ({ strapi }) => ({
  async create(ctx) {
    try {
      const { data } = ctx.request.body;
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized('You must be logged in to create an order');
      }

      // Generate unique order number
      const orderNumber = `YGF${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // Create order data
      const orderData: any = {
        orderNumber,
        user: user.id,
        items: data.items,
        shippingAddress: data.shippingAddress,
        billingAddress: data.billingAddress,
        subtotal: data.subtotal,
        tax: data.tax,
        shipping: data.shipping,
        total: data.total,
        paymentMethod: data.paymentMethod,
        paymentStatus: data.paymentMethod === 'COD' ? 'PENDING' : 'PENDING',
        orderStatus: 'PENDING' as const,
        notes: data.notes || null,
        publishedAt: new Date().toISOString()
      };

      // If Razorpay payment, create Razorpay order
      if (data.paymentMethod === 'RAZORPAY') {
        const Razorpay = require('razorpay');
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        const razorpayOrder = await razorpay.orders.create({
          amount: data.total * 100, // Amount in paise
          currency: 'INR',
          receipt: orderNumber,
        });

        orderData.razorpayOrderId = razorpayOrder.id;
      }

      // Create order
      const order = await strapi.entityService.create('api::order.order', {
        data: orderData,
        populate: ['user']
      });

      // Create transaction record
      await strapi.entityService.create('api::transaction.transaction', {
        data: {
          order: order.id,
          user: user.id,
          amount: data.total,
          currency: 'INR',
          paymentMethod: data.paymentMethod,
          transaction_status: 'PENDING',
          razorpayOrderId: orderData.razorpayOrderId || null,
          publishedAt: new Date().toISOString()
        }
      });

      ctx.body = { data: order };
    } catch (error) {
      console.error('Error creating order:', error);
      ctx.badRequest('Failed to create order', { error: error.message });
    }
  },

  async confirmPayment(ctx) {
    try {
      const { id } = ctx.params;
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = ctx.request.body;
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized('You must be logged in');
      }

      // Get the order
      const order = await strapi.entityService.findOne('api::order.order', id, {
        populate: ['user']
      });

      if (!order) {
        return ctx.notFound('Order not found');
      }

      if ((order as any).user.id !== user.id) {
        return ctx.forbidden('You can only confirm payments for your own orders');
      }

      // Verify Razorpay signature
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return ctx.badRequest('Invalid payment signature');
      }

      // Update order
      const updatedOrder = await strapi.entityService.update('api::order.order', id, {
        data: {
          paymentStatus: 'PAID',
          orderStatus: 'CONFIRMED',
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature
        }
      });

      // Update transaction
      const transactions = await strapi.entityService.findMany('api::transaction.transaction', {
        filters: { order: id }
      });

      if (transactions.length > 0) {
        await strapi.entityService.update('api::transaction.transaction', transactions[0].id, {
          data: {
            transaction_status: 'SUCCESS',
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            gatewayResponse: {
              payment_id: razorpay_payment_id,
              order_id: razorpay_order_id,
              signature: razorpay_signature
            }
          }
        });
      }

      ctx.body = { data: updatedOrder };
    } catch (error) {
      console.error('Error confirming payment:', error);
      ctx.badRequest('Failed to confirm payment', { error: error.message });
    }
  },

  async find(ctx) {
    try {
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized('You must be logged in');
      }

      // Get user's orders
      const orders = await strapi.entityService.findMany('api::order.order', {
        filters: { user: user.id },
        sort: { createdAt: 'desc' },
        populate: ['user']
      });

      ctx.body = { data: orders };
    } catch (error) {
      console.error('Error fetching orders:', error);
      ctx.badRequest('Failed to fetch orders', { error: error.message });
    }
  },

  async findOne(ctx) {
    try {
      const { id } = ctx.params;
      const user = ctx.state.user;

      if (!user) {
        return ctx.unauthorized('You must be logged in');
      }

      // Get the order
      const order = await strapi.entityService.findOne('api::order.order', id, {
        populate: ['user']
      });

      if (!order) {
        return ctx.notFound('Order not found');
      }

      if ((order as any).user.id !== user.id) {
        return ctx.forbidden('You can only view your own orders');
      }

      ctx.body = { data: order };
    } catch (error) {
      console.error('Error fetching order:', error);
      ctx.badRequest('Failed to fetch order', { error: error.message });
    }
  },

  async createTestOrder(ctx) {
    try {
      const { data } = ctx.request.body;

      // Generate unique order number
      const orderNumber = `YGF${Date.now()}${Math.floor(Math.random() * 1000)}`;

      // Create order data
      const orderData: any = {
        orderNumber,
        user: 1, // Use user ID 1 for testing
        items: data.items,
        shippingAddress: data.shippingAddress,
        billingAddress: data.billingAddress,
        subtotal: data.subtotal,
        tax: data.tax,
        shipping: data.shipping,
        total: data.total,
        paymentMethod: data.paymentMethod,
        paymentStatus: data.paymentMethod === 'COD' ? 'PENDING' : 'PENDING',
        orderStatus: 'PENDING' as const,
        notes: data.notes || null,
        publishedAt: new Date().toISOString()
      };

      // If Razorpay payment, create real Razorpay order
      if (data.paymentMethod === 'RAZORPAY') {
        try {
          const Razorpay = require('razorpay');
          const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
          });

          const razorpayOrder = await razorpay.orders.create({
            amount: data.total * 100, // Amount in paise
            currency: 'INR',
            receipt: orderData.orderNumber,
          });
          orderData.razorpayOrderId = razorpayOrder.id;
        } catch (razorpayError) {
          console.log('Razorpay error:', razorpayError.message);
          // Fallback to test order ID if Razorpay fails
          orderData.razorpayOrderId = `order_test_${Date.now()}`;
        }
      }

      // Create order
      const order = await strapi.entityService.create('api::order.order', {
        data: orderData,
        populate: ['user']
      });

      // Create transaction record
      await strapi.entityService.create('api::transaction.transaction', {
        data: {
          order: order.id,
          user: 1,
          amount: data.total,
          currency: 'INR',
          paymentMethod: data.paymentMethod,
          transaction_status: 'PENDING',
          razorpayOrderId: orderData.razorpayOrderId || null,
          publishedAt: new Date().toISOString()
        }
      });

      ctx.body = { data: order };
    } catch (error) {
      console.error('Error creating test order:', error);
      ctx.badRequest('Failed to create test order', { error: error.message });
    }
  },

  async getTestOrder(ctx) {
    try {
      const { id } = ctx.params;

      // Get the order
      const order = await strapi.entityService.findOne('api::order.order', id, {
        populate: ['user']
      });

      if (!order) {
        return ctx.notFound('Order not found');
      }

      ctx.body = { data: order };
    } catch (error) {
      console.error('Error fetching test order:', error);
      ctx.badRequest('Failed to fetch test order', { error: error.message });
    }
  },

  async getTestOrders(ctx) {
    try {
      // Get all orders for testing (normally would filter by user)
      const orders = await strapi.entityService.findMany('api::order.order', {
        populate: ['user'],
        sort: { createdAt: 'desc' }
      });

      ctx.body = { data: orders };
    } catch (error) {
      console.error('Error fetching test orders:', error);
      ctx.badRequest('Failed to fetch test orders', { error: error.message });
    }
  },

  async cancelTestOrder(ctx) {
    try {
      const { id } = ctx.params;

      // Get the order
      const order = await strapi.entityService.findOne('api::order.order', id);

      if (!order) {
        return ctx.notFound('Order not found');
      }

      // Check if order can be cancelled (only if status is PENDING or CONFIRMED)
      if (order.orderStatus === 'PROCESSING' || order.orderStatus === 'SHIPPED' || order.orderStatus === 'DELIVERED') {
        return ctx.badRequest('Order cannot be cancelled. It is already being processed or has been shipped.');
      }

      if (order.orderStatus === 'CANCELLED') {
        return ctx.badRequest('Order is already cancelled.');
      }

      // Update order status to CANCELLED
      const updatedOrder = await strapi.entityService.update('api::order.order', id, {
        data: {
          orderStatus: 'CANCELLED',
          paymentStatus: order.paymentStatus === 'PAID' ? 'REFUNDED' : order.paymentStatus
        }
      });

      // Update transaction status if exists
      const transactions = await strapi.entityService.findMany('api::transaction.transaction', {
        filters: { order: id }
      });

      if (transactions.length > 0) {
        for (const transaction of transactions) {
          await strapi.entityService.update('api::transaction.transaction', transaction.id, {
            data: {
              transaction_status: 'CANCELLED'
            }
          });
        }
      }

      ctx.body = { 
        data: updatedOrder,
        message: 'Order cancelled successfully'
      };
    } catch (error) {
      console.error('Error cancelling test order:', error);
      ctx.badRequest('Failed to cancel order', { error: error.message });
    }
  },

  async confirmTestPayment(ctx) {
    try {
      const { id } = ctx.params;
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = ctx.request.body;

      // Get the order
      const order = await strapi.entityService.findOne('api::order.order', id);

      if (!order) {
        return ctx.notFound('Order not found');
      }

      // Verify Razorpay signature (optional for testing)
      if (process.env.RAZORPAY_KEY_SECRET && razorpay_signature) {
        const crypto = require('crypto');
        const expectedSignature = crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
          .update(`${razorpay_order_id}|${razorpay_payment_id}`)
          .digest('hex');

        if (expectedSignature !== razorpay_signature) {
          return ctx.badRequest('Invalid payment signature');
        }
      }

      // Update order status
      const updatedOrder = await strapi.entityService.update('api::order.order', id, {
        data: {
          paymentStatus: 'PAID',
          orderStatus: 'CONFIRMED',
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature
        }
      });

      // Update transaction status
      const transactions = await strapi.entityService.findMany('api::transaction.transaction', {
        filters: { order: id }
      });

      if (transactions.length > 0) {
        for (const transaction of transactions) {
          await strapi.entityService.update('api::transaction.transaction', transaction.id, {
            data: {
              transaction_status: 'SUCCESS',
              razorpayPaymentId: razorpay_payment_id,
              razorpaySignature: razorpay_signature,
              gatewayResponse: {
                razorpay_order_id,
                razorpay_payment_id,
                razorpay_signature
              }
            }
          });
        }
      }

      ctx.body = { 
        data: updatedOrder,
        message: 'Payment confirmed successfully'
      };
    } catch (error) {
      console.error('Error confirming test payment:', error);
      ctx.badRequest('Failed to confirm payment', { error: error.message });
    }
  }
}));
