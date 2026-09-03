import { FormEvent, useState } from 'react';

type State = 'idle' | 'saving' | 'success' | 'error';

export function App() {
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('saving');
    setMessage('');
    const form = new FormData(event.currentTarget);

    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form)),
    }).catch(() => null);

    if (!response?.ok) {
      const body = response ? await response.json().catch(() => null) : null;
      setMessage(body?.error ?? 'No pudimos guardar el lead.');
      setState('error');
      return;
    }

    event.currentTarget.reset();
    setMessage('Lead creado correctamente.');
    setState('success');
  }

  return (
    <main>
      <section>
        <p className="eyebrow">AI Lead CRM</p>
        <h1>Convierte una conversación en una oportunidad.</h1>
        <p className="intro">Registra el primer contacto y deja que el equipo continúe desde ahí.</p>
        <form onSubmit={submit}>
          <label>Nombre<input name="name" required maxLength={120} /></label>
          <label>Email<input name="email" type="email" required maxLength={254} /></label>
          <label>Empresa<input name="company" maxLength={160} /></label>
          <label>Teléfono<input name="phone" maxLength={40} /></label>
          <input name="source" type="hidden" value="website" />
          <button disabled={state === 'saving'}>{state === 'saving' ? 'Guardando…' : 'Crear lead'}</button>
          {message && <p role="status" className={state}>{message}</p>}
        </form>
      </section>
    </main>
  );
}

