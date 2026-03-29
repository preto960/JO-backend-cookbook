import rateLimit from 'express-rate-limit';

// Rate limiter specifically for shopping lists to prevent resource exhaustion
export const shoppingListRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per windowMs for shopping lists
  message: {
    error: 'Too many shopping list requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip successful responses for rate limiting (only count errors/heavy operations)
  skip: (req, res) => res.statusCode < 400,
});

// More restrictive rate limit for expensive operations
export const shoppingListGenerateRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Only 5 generate requests per 5 minutes
  message: {
    error: 'Too many shopping list generation requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});