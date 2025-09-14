import React, { useState,useEffect } from 'react';
import { Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Input from '../components/Input';
import Button from '../components/Button';
import { authService } from '../services/authService';

interface ResetPasswordProps {
  email: string;
  onBack: () => void;
  onSuccess: () => void;
}

interface FormData {
  otp: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  otp?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({ email, onBack, onSuccess }) => {
  const [formData, setFormData] = useState<FormData>({ otp: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
const [cooldown, setCooldown] = useState<number>(0);

useEffect(() => {
  if (cooldown <= 0) return;
  const t = setInterval(() => setCooldown((c) => c - 1), 1000);
  return () => clearInterval(t);
}, [cooldown]);

const resend = async () => {
  if (cooldown > 0) return;
  try {
    setLoading(true);
    const r = await authService.resendOtp({ email });
    if (!r.success) setErrors({ general: r.message || 'Could not resend OTP' });
    setCooldown(60);
  } catch (e: any) {
    setErrors({ general: e?.data?.message || 'Network error' });
  } finally {
    setLoading(false);
  }
};

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.otp.trim()) newErrors.otp = 'OTP is required';
    else if (formData.otp.length !== 6) newErrors.otp = 'OTP must be 6 digits';

    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';

    if (!formData.confirmPassword) newErrors.confirmPassword = 'Please confirm your password';
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const res = await authService.resetPassword({
        email,
        otp: formData.otp,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

      if (res.success) onSuccess();
      else setErrors({ general: res.message || 'Reset failed' });
    } catch (err: any) {
      setErrors({ general: err?.data?.message || 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <button onClick={onBack} className="absolute top-4 left-4 text-gray-500 hover:text-gray-700 p-2">
            <ArrowLeft size={20} />
          </button>
          <div className="bg-green-100 p-3 rounded-full w-fit mx-auto mb-4">
            <Lock className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-gray-600 mt-2">Enter the code sent to your email and set a new password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="OTP Code"
            type="text"
            name="otp"
            value={formData.otp}
            onChange={(e) => setFormData(prev => ({ ...prev, otp: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
            error={errors.otp}
            placeholder="Enter 6-digit code"
            className="text-center text-xl font-mono tracking-widest"
            maxLength={6}
          />

          <div className="relative">
            <Input
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              placeholder="Enter new password"
            />
            <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-9 text-gray-500 hover:text-gray-700">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="relative">
            <Input
              label="Confirm New Password"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
              placeholder="Confirm new password"
            />
            <button type="button" onClick={() => setShowConfirmPassword(p => !p)} className="absolute right-3 top-9 text-gray-500 hover:text-gray-700">
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {errors.general && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">{errors.general}</div>}

          <Button type="submit" loading={loading} className="w-full">
            Reset Password
          </Button>
        </form>
        <div className="text-sm text-gray-600">
  Didn’t get a code? <button type="button" disabled={cooldown>0} onClick={resend} className="text-blue-600">
    {cooldown>0 ? `Resend in ${cooldown}s` : 'Resend'}
  </button>
  <div className="text-xs text-gray-500 mt-1">Code expires in 10 minutes.</div>
</div>

      </div>
    </div>
  );
};

export default ResetPassword;
