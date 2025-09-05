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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <button onClick={onBack} className="absolute top-4 left-4 text-gray-500 hover:text-gray-700 p-2">
            <ArrowLeft size={20} />
          </button>
          <div className="bg-orange-100 p-3 rounded-full w-fit mx-auto mb-4">
            <Mail className="h-8 w-8 text-orange-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Forgot Password</h1>
          <p className="text-gray-600 mt-2">Enter your email address and we'll send you a reset code</p>
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

          <Button type="submit" loading={loading} className="w-full">
            Send Reset Code
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={onBack} className="text-blue-600 hover:text-blue-700 font-medium">
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
