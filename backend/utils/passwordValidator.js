/**
 * Password Complexity Validator
 * @module utils/passwordValidator
 * @description Validates password complexity based on security requirements
 */

/**
 * Password complexity requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 */

class PasswordValidator {
  constructor() {
    this.minLength = 8;
    this.uppercaseRegex = /[A-Z]/;
    this.lowercaseRegex = /[a-z]/;
    this.numberRegex = /[0-9]/;
    this.specialRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
  }

  /**
   * Validate password complexity
   * @param {string} password - Password to validate
   * @returns {Object} { isValid: boolean, errors: string[] }
   */
  validate(password) {
    const errors = [];

    if (!password) {
      errors.push('Password is required');
      return { isValid: false, errors };
    }

    if (password.length < this.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters long`);
    }

    if (!this.uppercaseRegex.test(password)) {
      errors.push('Password must contain at least 1 uppercase letter');
    }

    if (!this.lowercaseRegex.test(password)) {
      errors.push('Password must contain at least 1 lowercase letter');
    }

    if (!this.numberRegex.test(password)) {
      errors.push('Password must contain at least 1 number');
    }

    if (!this.specialRegex.test(password)) {
      errors.push('Password must contain at least 1 special character (!@#$%^&*()_+-=[]{};\'"\\|,.<>/?)')
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get password strength score (0-5)
   * @param {string} password - Password to evaluate
   * @returns {number} Strength score
   */
  getStrength(password) {
    if (!password) return 0;

    let strength = 0;

    if (password.length >= this.minLength) strength++;
    if (password.length >= 12) strength++;
    if (this.uppercaseRegex.test(password)) strength++;
    if (this.lowercaseRegex.test(password)) strength++;
    if (this.numberRegex.test(password)) strength++;
    if (this.specialRegex.test(password)) strength++;

    return Math.min(strength, 5);
  }

  /**
   * Get password strength description
   * @param {string} password - Password to evaluate
   * @returns {string} Strength description
   */
  getStrengthDescription(password) {
    const strength = this.getStrength(password);
    const descriptions = [
      'Very Weak',
      'Weak',
      'Fair',
      'Good',
      'Strong',
      'Very Strong'
    ];
    return descriptions[strength] || 'Unknown';
  }
}

module.exports = new PasswordValidator();
