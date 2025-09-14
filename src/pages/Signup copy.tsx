import React, { useState } from 'react';
import { User, Eye, EyeOff } from 'lucide-react';
import Input from '../components/Input';
import Button from '../components/Button';
import { authService } from '../services/authService';

interface SignupProps {
  onSwitchToLogin: () => void;
  onSignupSuccess: (email: string) => void;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

const Signup: React.FC<SignupProps> = ({ onSwitchToLogin, onSignupSuccess }) => {
  const [formData, setFormData] = useState<FormData>({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    else if (formData.name.trim().length < 2) newErrors.name = 'Name must be at least 2 characters';

    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email';

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
      const res = await authService.signup(formData);
      if (res.success) {
        onSignupSuccess(formData.email);
      } else {
        setErrors({ general: res.message || 'Signup failed' });
      }
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
      <div className="bg-white p-8 rounded-2xl shadow-xl w/full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-blue-100 p-3 rounded-full w-fit mx-auto mb-4">
            <User className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600 mt-2">Join us today and get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input label="Full Name" type="text" name="name" value={formData.name} onChange={handleChange} error={errors.name} placeholder="Enter your full name" />
          <Input label="Email Address" type="email" name="email" value={formData.email} onChange={handleChange} error={errors.email} placeholder="Enter your email" />

          <div className="relative">
            <Input label="Password" type={showPassword ? 'text' : 'password'} name="password" value={formData.password} onChange={handleChange} error={errors.password} placeholder="Enter your password" />
            <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-9 text-gray-500 hover:text-gray-700">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="relative">
            <Input label="Confirm Password" type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} error={errors.confirmPassword} placeholder="Confirm your password" />
            <button type="button" onClick={() => setShowConfirmPassword(p => !p)} className="absolute right-3 top-9 text-gray-500 hover:text-gray-700">
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {errors.general && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">{errors.general}</div>}

          <Button type="submit" loading={loading} className="w-full">Create Account</Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <button onClick={onSwitchToLogin} className="text-blue-600 hover:text-blue-700 font-medium">Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
