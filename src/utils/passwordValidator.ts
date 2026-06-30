export const validatePassword = (password: string) => {
  const errors: string[] = [];
  
  const validations = {
    length: password.length >= 8,
    letter: /[a-zA-Z]/.test(password),
    number: /\d/.test(password),
    specialChar: /[\W_]/.test(password),
  };

  if (!validations.length) {
    errors.push('be at least 8 characters long');
  }
  if (!validations.letter) {
    errors.push('contain at least one letter');
  }
  if (!validations.number) {
    errors.push('contain at least one number');
  }
  if (!validations.specialChar) {
    errors.push('contain at least one special character');
  }

  const isValid = errors.length === 0;

  return { isValid, errors };
};