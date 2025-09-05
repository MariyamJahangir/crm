import React, { useState } from 'react';
import Login from './Login';
import Signup from './Signup';
import VerifyOTP from './VerifyOTP';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';

type AuthStep = 'login' | 'signup' | 'verify-otp' | 'forgot-password' | 'reset-password' | 'success';

const AuthFlow: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AuthStep>('login');
  const [email, setEmail] = useState('');

  const handleSwitchToSignup = () => setCurrentStep('signup');
  const handleSwitchToLogin = () => setCurrentStep('login');

  const handleSignupSuccess = (userEmail: string) => {
    setEmail(userEmail);
    setCurrentStep('verify-otp');
  };

  const handleForgotPassword = () => setCurrentStep('forgot-password');

  const handleForgotPasswordSuccess = (userEmail: string) => {
    setEmail(userEmail);
    setCurrentStep('reset-password');
  };

  const handleResetPasswordSuccess = () => {
    setCurrentStep('success');
    setTimeout(() => setCurrentStep('login'), 2000);
  };

  const handleBackToLogin = () => setCurrentStep('login');
  const handleBackToSignup = () => setCurrentStep('signup');

  if (currentStep === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
          <div className="bg-green-100 p-3 rounded-full w-fit mx-auto mb-4">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successful!</h2>
          <p className="text-gray-600">You can now sign in with your new password.</p>
        </div>
      </div>
    );
  }

  switch (currentStep) {
    case 'login':
      return (
        <Login
          onSwitchToSignup={handleSwitchToSignup}
          onForgotPassword={handleForgotPassword}
        />
      );
    case 'signup':
      return (
        <Signup
          onSwitchToLogin={handleSwitchToLogin}
          onSignupSuccess={handleSignupSuccess}
        />
      );
    case 'verify-otp':
      return (
        <VerifyOTP
          email={email}
          onBack={handleBackToSignup}
        />
      );
    case 'forgot-password':
      return (
        <ForgotPassword
          onBack={handleBackToLogin}
          onSuccess={handleForgotPasswordSuccess}
        />
      );
    case 'reset-password':
      return (
        <ResetPassword
          email={email}
          onBack={handleBackToLogin}
          onSuccess={handleResetPasswordSuccess}
        />
      );
    default:
      return (
        <Login
          onSwitchToSignup={handleSwitchToSignup}
          onForgotPassword={handleForgotPassword}
        />
      );
  }
};

export default AuthFlow;
