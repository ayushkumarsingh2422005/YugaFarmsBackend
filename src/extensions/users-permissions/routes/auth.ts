/**
 * Custom auth routes for phone/OTP authentication
 */

export default {
  routes: [
    {
      method: 'POST',
      path: '/auth/otp/send',
      handler: 'auth.sendOTP',
      config: {
        auth: false,
        prefix: '',
      },
    },
    {
      method: 'POST',
      path: '/auth/otp/verify',
      handler: 'auth.loginWithOTP',
      config: {
        auth: false,
        prefix: '',
      },
    },
  ],
};

