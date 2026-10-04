import type { FastifyInstance } from 'fastify';
import { requireGoogleUser } from '../../plugins/googleAuth.js';
import { reactionSchema, commentSchema } from './songs.schema.js';
import { listSongs, toggleReaction, addComment } from './songs.service.js';

export async function songRoutes(app: FastifyInstance): Promise<void> {
  app.get('/songs', async () => {
    const songs = await listSongs();
    return { songs };
  });

  app.post('/songs/:id/reactions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = reactionSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    const fp = (request.headers['x-fingerprint'] as string) ?? parsed.data.fingerprint;
    const song = await toggleReaction(id, parsed.data.kind, fp);
    return { song };
  });

  app.post('/songs/:id/comments', { preHandler: [requireGoogleUser] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = commentSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    // `who` is never trusted from the client — it comes from the verified Google identity.
    const user = request.googleUser!;
    const who = (user.displayName ?? user.email?.split('@')[0] ?? 'Member').trim().slice(0, 60) || 'Member';
    const comment = await addComment(id, who, parsed.data.text);
    return reply.status(201).send({ comment });
  });
}
