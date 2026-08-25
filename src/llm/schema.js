import {z} from 'zod';

export const enrichinputchema= z.object({
   title: z.string()
   .trim()
   .min(1,'title must not be empty')
   .max(300,'title cant be greater then 300 characters'),

   description: z.string()
   .max(3000,'description must be under 3000 characters')
   .nullable()
   .optional()
});

export const enrichoutputschema= z.object({
    category: z.enum(['fiction','non-fiction','poetry','children','other']),
    summary: z.string()
    .min(1,'summary must not be empty'),
    quality_flags:z.array(z.enum(['vague_description','too_short','missing_details','looks_fine']))
    .min(1,'quality_flags must contain atleast one flag'),
    confidence: z.number()
    .min(0)            
    .max(1)
})

