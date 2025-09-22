import React, { useState } from 'react';
import { Mail, ArrowLeft } from 'lucide-react';
import Input from '../components/Input';
import Button from '../components/Button';
import { authService } from '../services/authService';

interface ForgotPasswordProps {
  onBack: () => void;
  onSuccess: (email: string) => void;
}

const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) return setError('Email is required');
    if (!/\S+@\S+\.\S+/.test(email)) return setError('Please enter a valid email');

    setLoading(true);
    setError('');

    try {
      const res = await authService.forgotPassword({ email });
      if (res.success) {
        onSuccess(email);
      } else {
        setError(res.message || 'Unable to process request');
      }
    } catch (err: any) {
      setError(err?.data?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

 return (
  <div
    className="min-h-screen flex items-center justify-center bg-cover bg-center p-4 relative"
  >
    {/* overlay */}
    <div className="absolute inset-0 bg-midnight-900/40"></div>

    <div className="bg-cloud-800/30 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20 relative z-10">
      <div className="text-center mb-8">
        {/* back button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 text-cloud-300 hover:text-sky-400 transition p-2"
        >
          <ArrowLeft size={20} />
        </button>

        {/* icon */}
        <div className="bg-sky-700/30 p-3 rounded-full w-fit mx-auto mb-4 shadow-md">
          <Mail className="h-8 w-8 text-sky-300" />
        </div>

        <h1 className="text-3xl font-bold text-ivory-100">Forgot Password</h1>
        <p className="text-cloud-200 mt-2">
          Enter your email address and we'll send you a reset code
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
          placeholder="Enter your email"
        />

        <Button
          type="submit"
          loading={loading}
          className="w-full bg-sky-600 hover:bg-sky-500 text-midnight-900 font-medium py-2 px-4 rounded-lg transition-all duration-300 shadow-md"
        >
          Send Reset Code
        </Button>
      </form>

      <div className="mt-6 text-center">
        <button
          onClick={onBack}
          className="text-sky-400 hover:text-sky-300 font-medium transition"
        >
          Back to Sign In
        </button>
      </div>
    </div>
  </div>
);
};

export default ForgotPassword;
