import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { FormGroup, Input, Button } from '../../components/FormFields';
import toast from 'react-hot-toast';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loginError, setLoginError] = useState('');
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors = {};
    if (!email) newErrors.email = 'Email is required';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors below');
      return;
    }

    setLoginError('');
    const result = await login(email, password);

    if (result.success) {
      toast.success('Login successful!');
      navigate('/');
    } else {
      const errMsg = result.error || 'Login failed. Please check your credentials.';
      setLoginError(errMsg);
      toast.error(errMsg);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-factory-600 to-factory-800">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center text-white p-12">
        <div className="max-w-md">
          <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center mb-6">
            <span className="text-2xl font-bold text-factory-600">FP</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">Factory Portal</h1>
          <p className="text-lg text-factory-100 mb-8">
            Manage your products, prices, orders, and shipments in one unified platform.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-factory-600 font-bold text-sm">✓</span>
              </div>
              <p>Real-time production tracking</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-factory-600 font-bold text-sm">✓</span>
              </div>
              <p>Seamless shipping document management</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-factory-600 font-bold text-sm">✓</span>
              </div>
              <p>Quality inspection scheduling and tracking</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center items-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome Back</h2>
              <p className="text-gray-600">Sign in to your factory account</p>
            </div>

            {loginError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{loginError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <FormGroup label="Email" required error={errors.email}>
                <Input
                  type="email"
                  placeholder="contact@ceramictile.cn"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors({ ...errors, email: '' });
                  }}
                  error={!!errors.email}
                />
              </FormGroup>

              <FormGroup label="Password" required error={errors.password}>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: '' });
                  }}
                  error={!!errors.password}
                />
              </FormGroup>

              <div className="flex items-center justify-end">
                <Link
                  to="/forgot-password"
                  className="text-sm text-factory-600 hover:text-factory-700 font-medium"
                >
                  Forgot password?
                </Link>
              </div>

              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full"
              >
                Sign In
              </Button>
            </form>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 text-center mb-1">Demo Credentials</p>
              <p className="text-xs text-gray-600 text-center font-mono">
                contact@ceramictile.cn / factory123
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-center text-sm text-gray-600">
                Don't have an account?{' '}
                <span className="text-factory-600 font-medium">
                  Contact your account manager
                </span>
              </p>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-white">
            <p>Factory Portal v1.0 - Trading Company ERP</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
