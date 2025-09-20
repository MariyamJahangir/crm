import React, { useState } from 'react';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import { authService } from '../services/authService';
import { useNavigate } from 'react-router-dom';
import {API_BASE_URL} from '../services/api'
interface LoginProps {
  onSwitchToSignup?: () => void;
  onForgotPassword?: () => void;
}

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

const Login: React.FC<LoginProps> = ({ onSwitchToSignup, onForgotPassword }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email';

    if (!formData.password) newErrors.password = 'Password is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const data = await authService.login(formData);
      console.log(API_BASE_URL);
      if (data.success && data.token && data.user) {
       
        login(data.token, data.user);
        navigate('/dashboard', { replace: true });
      } else {
        setErrors({ general: data.message || 'Login failed' });
      }
    } catch (err: any) {
      setErrors({ general: err?.data?.message || 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center p-4"
      
    >

      <div className="absolute inset-0 bg-midnight-900/20"></div>

      <div className="bg-cloud-800/30 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/20">
        <div className="text-center mb-8">
          <div className="bg-sky-700/30 p-3 rounded-full w-fit mx-auto mb-4 shadow-md">
            <LogIn className="h-8 w-8 text-sky-400" />
          </div>
          <h1 className="text-3xl font-bold text-ivory-100">Welcome Back</h1>
          <p className="text-cloud-200 mt-2">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Email Address"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            placeholder="Enter your email"
          />

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleChange}
              error={errors.password}
              placeholder="Enter your password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
              className="absolute right-3 top-9 text-cloud-300 hover:text-sky-400 transition"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-sky-500 focus:ring-sky-500 border-midnight-600 rounded bg-midnight-700/50"
              />
              <label
                htmlFor="remember-me"
                className="ml-2 block text-sm text-ivory-200"
              >
                Remember me
              </label>
            </div>

            {onForgotPassword && (
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-sky-400 hover:text-sky-300 transition"
              >
                Forgot password?
              </button>
            )}
          </div>

          {errors.general && (
            <div className="bg-midnight-700/50 border border-sky-700/40 text-sky-300 px-4 py-3 rounded-lg">
              {errors.general}
            </div>
          )}

          <Button
            type="submit"
            loading={loading}
            className="w-full bg-sky-600 hover:bg-sky-500 text-midnight-900 font-medium py-2 px-4 rounded-lg transition-all duration-300 shadow-md"
          >
            Sign In
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
