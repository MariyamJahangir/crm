import React, { useState } from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import { authService } from '../services/authService';
import { useNavigate } from 'react-router-dom';

interface VerifyOTPProps {
  email: string;
  onBack: () => void;
}

const VerifyOTP: React.FC<VerifyOTPProps> = ({ email, onBack }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp.trim()) return setError('Please enter the OTP');
    if (otp.length !== 6) return setError('OTP must be 6 digits');

    setLoading(true);
    setError('');

    try {
      const res = await authService.verifyOtp({ email, otp });
      if (res.success && res.token && res.user) {
        login(res.token, res.user);
        navigate('/dashboard', { replace: true });
      } else {
        setError(res.message || 'Verification failed');
      }
    } catch (err: any) {
      setError(err?.data?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      const res = await authService.resendOtp({ email });
      if (!res.success) setError(res.message || 'Could not resend code');
    } catch (err: any) {
      setError(err?.data?.message || 'Network error. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <button onClick={onBack} className="absolute top-4 left-4 text-gray-500 hover:text-gray-700 p-2">
            <ArrowLeft size={20} />
          </button>
          <div className="bg-green-100 p-3 rounded-full w-fit mx-auto mb-4">
            <Shield className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Verify Your Email</h1>
          <p className="text-gray-600 mt-2">
            We've sent a 6-digit code to<br />
            <span className="font-medium">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Enter OTP Code"
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={error}
            placeholder="Enter 6-digit code"
            className="text-center text-2xl font-mono tracking-widest"
            maxLength={6}
          />

          <Button type="submit" loading={loading} className="w-full">
            Verify Email
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Didn't receive the code?{' '}
            <button onClick={handleResend} disabled={resending} className="text-blue-600 hover:text-blue-700 font-medium">
              {resending ? 'Resending...' : 'Resend'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;
