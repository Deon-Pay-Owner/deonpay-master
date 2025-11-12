/**
 * Card Utilities
 * Helper functions for processing card data
 */

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown'

/**
 * Detect card brand from card number using IIN (Issuer Identification Number)
 * @param cardNumber - Card number (with or without spaces/dashes)
 * @returns Card brand
 */
export function detectCardBrand(cardNumber: string): CardBrand {
  // Remove spaces and dashes
  const cleaned = cardNumber.replace(/[\s-]/g, '')
  
  // Visa: starts with 4
  if (/^4/.test(cleaned)) {
    return 'visa'
  }
  
  // Mastercard: starts with 51-55 or 2221-2720
  if (/^5[1-5]/.test(cleaned) || /^2(22[1-9]|2[3-9][0-9]|[3-6][0-9]{2}|7[0-1][0-9]|720)/.test(cleaned)) {
    return 'mastercard'
  }
  
  // American Express: starts with 34 or 37
  if (/^3[47]/.test(cleaned)) {
    return 'amex'
  }
  
  // Discover: starts with 6011, 622126-622925, 644-649, or 65
  if (/^6011/.test(cleaned) || /^62212[6-9]/.test(cleaned) || /^6229[0-1][0-9]/.test(cleaned) || /^622[2-8][0-9]{2}/.test(cleaned) || /^64[4-9]/.test(cleaned) || /^65/.test(cleaned)) {
    return 'discover'
  }
  
  return 'unknown'
}

/**
 * Extract last 4 digits from card number
 * @param cardNumber - Card number (with or without spaces/dashes)
 * @returns Last 4 digits
 */
export function getCardLast4(cardNumber: string): string {
  const cleaned = cardNumber.replace(/[\s-]/g, '')
  return cleaned.slice(-4)
}

/**
 * Process raw card data into payment method format
 * Extracts brand and last4 from card number
 * 
 * @param rawCard - Raw card data from client
 * @returns Processed payment method
 */
export function processRawCardData(rawCard: {
  type: 'card'
  number: string
  exp_month: number
  exp_year: number
  cvv: string
}): {
  brand: CardBrand
  last4: string
  exp_month: number
  exp_year: number
} {
  const brand = detectCardBrand(rawCard.number)
  const last4 = getCardLast4(rawCard.number)
  
  return {
    brand,
    last4,
    exp_month: rawCard.exp_month,
    exp_year: rawCard.exp_year,
  }
}
