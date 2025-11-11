const { z } = require('zod');

/**
 * Core field schemas
 */

const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .email('Enter a valid email')
  .max(255, 'Email too long')
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be 128 characters or less');

const nameSchema = z
  .string({ required_error: 'Required' })
  .trim()
  .min(1, 'Required')
  .max(60, 'Too long');

const roleSchema = z.enum(['TALENT', 'AGENCY']);

/**
 * Auth schemas
 */

const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required')
});

const signupSchema = z.object({
  first_name: nameSchema,
  last_name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema
});

const agencySignupSchema = z.object({
  agency_name: z
    .string({ required_error: 'Agency name is required' })
    .trim()
    .min(1, 'Agency name is required')
    .max(100, 'Agency name is too long'),
  company_website: z
    .string()
    .trim()
    .max(255, 'Website URL is too long')
    .optional()
    .transform((val) => {
      if (!val || val.trim() === '') return undefined;
      return val.trim();
    })
    .refine((val) => {
      if (!val) return true;
      // Basic URL validation - must start with http:// or https://
      return /^https?:\/\/.+/i.test(val);
    }, {
      message: 'Enter a valid URL starting with http:// or https://'
    }),
  contact_name: nameSchema,
  contact_role: z.enum(['Booker', 'Director', 'Scout', 'Other'], {
    required_error: 'Please select your role'
  }),
  email: emailSchema,
  password: passwordSchema
});

/**
 * Profile + Apply
 */

const heightSchema = z
  .preprocess(
    (val) => {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        // Try to parse feet and inches format (e.g., "5' 11"", "5'11"", "5ft 11in")
        const feetInchesMatch = trimmed.match(/(\d+)\s*['ft]+\s*(\d+)?/i);
        if (feetInchesMatch) {
          const feet = parseInt(feetInchesMatch[1], 10);
          const inches = parseInt(feetInchesMatch[2] || '0', 10);
          const cm = Math.round((feet * 30.48) + (inches * 2.54));
          return cm;
        }
        // Try to parse "180 cm" format
        const cmMatch = trimmed.match(/(\d+)\s*cm/i);
        if (cmMatch) {
          return parseInt(cmMatch[1], 10);
        }
        // Try to parse just a number
        const numMatch = trimmed.match(/(\d+)/);
        if (numMatch) {
          return parseInt(numMatch[1], 10);
        }
      }
      return val;
    },
    z.union([
      z.string().min(1, 'Height is required'),
      z.number()
    ])
  )
  .transform((val) => {
    if (typeof val === 'number') return val;
    return parseInt(val, 10);
  })
  .refine(
    (val) => Number.isFinite(val) && val >= 120 && val <= 220,
    { message: 'Provide height in cm between 120 and 220 (or use feet/inches like 5\' 11")' }
  );

const bioSchema = z
  .string({ required_error: 'Bio required' })
  .trim()
  .min(10, 'Tell us more so we can curate')
  .max(600, 'Bio is too long');

const measurementsSchema = z
  .string({ required_error: 'Measurements required' })
  .trim()
  .min(2, 'Measurements required')
  .max(60, 'Too long');

const phoneSchema = z
  .string()
  .trim()
  .max(20, 'Phone number too long')
  .optional();

const bustSchema = z
  .preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.union([
      z.string().min(1).transform((val) => parseInt(val, 10)),
      z.number()
    ])
  )
  .refine((val) => !val || (Number.isFinite(val) && val >= 20 && val <= 60), {
    message: 'Bust must be between 20 and 60 inches'
  })
  .optional();

const waistSchema = z
  .preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.union([
      z.string().min(1).transform((val) => parseInt(val, 10)),
      z.number()
    ])
  )
  .refine((val) => !val || (Number.isFinite(val) && val >= 20 && val <= 50), {
    message: 'Waist must be between 20 and 50 inches'
  })
  .optional();

const hipsSchema = z
  .preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.union([
      z.string().min(1).transform((val) => parseInt(val, 10)),
      z.number()
    ])
  )
  .refine((val) => !val || (Number.isFinite(val) && val >= 25 && val <= 60), {
    message: 'Hips must be between 25 and 60 inches'
  })
  .optional();

const applyProfileSchema = z
  .object({
    first_name: nameSchema,
    last_name: nameSchema,
    city: nameSchema,
    phone: phoneSchema,
    height_cm: heightSchema,
    bust: bustSchema,
    waist: waistSchema,
    hips: hipsSchema,
    shoe_size: z.string().trim().max(10).optional(),
    eye_color: z.string().trim().max(30).optional(),
    hair_color: z.string().trim().max(30).optional(),
    measurements: measurementsSchema,
    bio: bioSchema,
    specialties: z.array(z.string()).optional(),
    partner_agency_email: z
      .string()
      .trim()
      .email('Enter a valid email')
      .max(255, 'Email too long')
      .transform((val) => val.toLowerCase())
      .optional()
  })
  .strict();

const talentProfileUpdateSchema = z
  .object({
    city: nameSchema,
    height_cm: heightSchema,
    measurements: measurementsSchema,
    bio: bioSchema
  })
  .strict();

/**
 * Partner claim
 */

const partnerClaimSchema = z.object({
  slug: z.string().trim().min(1, 'Profile required')
});

module.exports = {
  loginSchema,
  signupSchema,
  agencySignupSchema,
  applyProfileSchema,
  talentProfileUpdateSchema,
  partnerClaimSchema
};
