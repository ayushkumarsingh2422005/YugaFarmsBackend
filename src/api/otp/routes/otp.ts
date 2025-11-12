/**
 * OTP router
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/otp/send',
      handler: 'otp.sendOTP',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/otp/verify',
      handler: 'otp.verifyOTP',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/otp/login',
      handler: 'otp.loginWithOTP',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
