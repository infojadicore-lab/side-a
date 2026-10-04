import { useState } from 'react';
import { post } from '../../lib/api.js';
import { Spinner } from '../../components/Spinner.js';

export function SubmitPage(): React.ReactElement {
  const [name, setName] = useState('');
  const [track, setTrack] = useState('');
  const [why, setWhy] = useState('');
  const [link, setLink] = useState('');
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = (e: React.FormEvent): void => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || !track.trim() || !why.trim() || sending) return;
    setSending(true);
    void post('/api/recommendations', {
      name: name.trim(),
      track: track.trim(),
      why: why.trim(),
      link: link.trim(),
    })
      .then(() => setDone(true))
      .catch(() => setDone(true))
      .finally(() => setSending(false));
  };

  if (done) {
    return (
      <section className="screen active">
        <h2 className="section-title">Recommend a track</h2>
        <div className="rec-success show">
          <p className="title">Thank you.</p>
          <p className="body">
            Your pick is in the queue. If we play it, we will give you a shout.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="screen active">
      <h2 className="section-title">Recommend a track</h2>
      <p className="lede">
        Put a song or album up for the community. If we pick it, it plays as a future Song of the week, with your
        name on it.
      </p>
      <form className="rec-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="rec-name">Your name</label>
          <input
            type="text"
            id="rec-name"
            placeholder="Tomiwa Adebayo"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className={touched && !name.trim() ? 'err show' : 'err'}>Enter your name.</p>
        </div>
        <div className="field">
          <label htmlFor="rec-track">Song or album</label>
          <input
            type="text"
            id="rec-track"
            placeholder="e.g. Optimistic by Sounds of Blackness"
            value={track}
            onChange={(e) => setTrack(e.target.value)}
          />
          <p className={touched && !track.trim() ? 'err show' : 'err'}>Enter a song or album.</p>
        </div>
        <div className="field">
          <label htmlFor="rec-why">Why this, right now</label>
          <textarea
            id="rec-why"
            placeholder="One line on why it fits Side A this week."
            value={why}
            onChange={(e) => setWhy(e.target.value)}
          />
          <p className={touched && !why.trim() ? 'err show' : 'err'}>Tell us why it fits.</p>
        </div>
        <div className="field">
          <label htmlFor="rec-link">Streaming link</label>
          <input
            type="text"
            id="rec-link"
            placeholder="Spotify, Apple Music or YouTube link (optional)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <p className="hint">Helps us queue it up quickly if it&apos;s picked.</p>
        </div>
        <button type="submit" className="btn primary full" disabled={sending} aria-busy={sending}>
          {sending ? <Spinner /> : null} {sending ? 'Sending…' : 'Submit recommendation'}
        </button>
      </form>
    </section>
  );
}
