/**
 * Card Validation Utilities
 * Server-side validation for credit card data
 */

/**
 * Validates a credit card number using the Luhn algorithm
 * @param cardNumber - Card number as string (digits only)
 * @returns true if valid, false otherwise
 */
export function validateLuhn(cardNumber: string): boolean {
  // Remove all non-digit characters
  const digits = cardNumber.replace(/\D/g, '')

  // Must be at least 13 digits and at most 19
  if (digits.length < 13 || digits.length > 19) {
    return false
  }

  let sum = 0
  let isEven = false

  // Loop through digits from right to left
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10)

    if (isEven) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }

    sum += digit
    isEven = !isEven
  }

  return sum % 10 === 0
}

/**
 * Validates expiry date
 * @param month - Month (1-12)
 * @param year - Year (full year, e.g., 2025)
 * @returns true if valid and not expired
 */
export function validateExpiryDate(month: number, year: number): boolean {
  // Validate month range
  if (month < 1 || month > 12) {
    return false
  }

  // Get current date
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 0-indexed to 1-indexed

  // Check if card is expired
  if (year < currentYear) {
    return false
  }

  if (year === currentYear && month < currentMonth) {
    return false
  }

  // Check if expiry is too far in the future (more than 20 years)
  if (year > currentYear + 20) {
    return false
  }

  return true
}

/**
 * Validates CVV length based on card brand
 * @param cvv - CVV code
 * @param cardNumber - Optional card number to detect brand
 * @returns true if valid length
 */
export function validateCVV(cvv: string, cardNumber?: string): boolean {
  const digits = cvv.replace(/\D/g, '')

  // AMEX cards have 4-digit CVV, others have 3
  const brand = cardNumber ? detectCardBrand(cardNumber) : 'unknown'
  const expectedLength = brand === 'amex' ? 4 : 3

  return digits.length === expectedLength
}

/**
 * Detects card brand from card number
 * @param cardNumber - Card number (can include spaces/dashes)
 * @returns brand name
 */
export function detectCardBrand(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '')

  // Visa
  if (/^4/.test(digits)) {
    return 'visa'
  }

  // Mastercard
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) {
    return 'mastercard'
  }

  // American Express
  if (/^3[47]/.test(digits)) {
    return 'amex'
  }

  // Discover
  if (/^6(?:011|5)/.test(digits)) {
    return 'discover'
  }

  // Diners Club
  if (/^3(?:0[0-5]|[68])/.test(digits)) {
    return 'diners'
  }

  // JCB
  if (/^35/.test(digits)) {
    return 'jcb'
  }

  return 'unknown'
}

/**
 * Validates complete card data
 * @param card - Card data object
 * @returns Validation result with errors
 */
export function validateCard(card: {
  number: string
  exp_month: number
  exp_year: number
  cvv: string
}): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate card number with Luhn
  if (!validateLuhn(card.number)) {
    errors.push('Invalid card number')
  }

  // Validate expiry date
  if (!validateExpiryDate(card.exp_month, card.exp_year)) {
    errors.push('Card is expired or expiry date is invalid')
  }

  // Validate CVV
  if (!validateCVV(card.cvv, card.number)) {
    errors.push('Invalid CVV code')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
