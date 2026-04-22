import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { FormGroup, Input, Button } from '../../components/FormFields';
import toast from 'react-hot-toast';

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const { forgotPassword, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError('Email is required');
      return;
    }

    const result = await forgotPassword(email);

    if (result.success) {
      setSubmitted(true);
      toast.success('Password reset email sent!');
      setTimeout(() => navigate('/login'), 3000);
    } else {
      setError(result.error || 'Password reset failed');
      toast.error(result.error || 'Password reset failed');
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-factory-600 to-factory-800">
      <div className="flex w-full flex-col justify-center items-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-2xl p-8">
            {!submitted ? (
              <>
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Reset Password
                  </h2>
                  <p className="text-gray-600">
                    Enter your email address and we'll send you a link to reset your
                    password
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <FormGroup label="Email" required error={error}>
                    <Input
                      type="email"
                      placeholder="factory@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError('');
                      }}
                      error={!!error}
                    />
                  </FormGroup>

                  <Button
                    type="submit"
                    isLoading={isLoading}
                    className="w-full"
                  >
                    Send Reset Email
                  </Button>
                </form>

                <Link
                  to="/login"
                  className="mt-6 flex items-center justify-center gap-2 text-factory-600 hover:text-factory-700 font-medium"
                >
                  <ChevronLeft size={18} />
                  Back to Login
                </Link>
              </>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">✓</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Check Your Email
                </h3>
                <p className="text-gray-600 mb-4">
                  We've sent a password reset link to {email}
                </p>
                <p className="text-sm text-gray-500 mb-6">
                  Redirecting to login in 3 seconds...
                </p>
                <Link
                  to="/login"
                  className="text-factory-600 hover:text-factory-700 font-medium"
                >
                  Back to Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
