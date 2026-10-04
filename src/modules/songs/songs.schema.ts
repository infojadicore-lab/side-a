import { z } from 'zod';

export const reactionSchema = z.object({
  kind: z.enum(['repeat', 'needed', 'skip']),
  fingerprint: z.string().min(1).default('anon'),
});

export const commentSchema = z.object({
  text: z.string().min(1).max(500),
});
