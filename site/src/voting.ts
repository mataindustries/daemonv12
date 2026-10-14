// Progressive enhancement only. Identity strings arrive from an authorized server
// response and are inserted as text, never HTML. No vote/session browser storage.
const ballot = document.querySelector<HTMLElement>('.os-ballot');
if (ballot) {
  const button = ballot.querySelector<HTMLButtonElement>('.os-vote-button')!;
  const fieldset = ballot.querySelector('fieldset')!;
  const status = document.getElementById('vote-note')!;
  const results = document.getElementById('vote-results')!;
  const retryButton = document.querySelector<HTMLButtonElement>('[data-vote-recover]')!;
  let csrfToken = '';
  let votingOpen = false;
  let complete = false;
  let busy = false;
  let attempt: {trackId: string; requestId: string} | undefined;
  class ApiError extends Error {
    code: string;
    constructor(code: string) { super(code); this.code = code; }
  }
  const selected = () => ballot.querySelector<HTMLInputElement>('input[name="favorite"]:checked')?.value;
  function update() {
    button.disabled = busy || complete || !votingOpen || !selected();
    button.textContent = busy ? 'Please wait…' : complete ? 'Vote recorded' : votingOpen ? 'Vote & Reveal' : 'Voting is closed';
    fieldset.disabled = busy || complete;
    ballot!.setAttribute('aria-busy', String(busy));
  }
  async function api(path: string, body?: object) {
    const response = await fetch(`/api/one-sound/${path}`, {
      method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: body ? {'Content-Type': 'application/json'} : undefined,
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) throw new ApiError(typeof data.error === 'string' ? data.error : 'unavailable');
    return data;
  }
  function showResults(data: {reveal?: Record<string, unknown>; results?: Record<string, unknown>; selectedTrack?: unknown}) {
    const names = data.reveal, counts = data.results;
    const ids = ['A', 'B', 'C'];
    if (!names || !counts || !ids.includes(String(data.selectedTrack)) || ids.some(id => typeof names[id] !== 'string' || (names[id] as string).length > 120 || !Number.isSafeInteger(counts[id]) || Number(counts[id]) < 0) || counts.total !== ids.reduce((sum, id) => sum + Number(counts[id]), 0) || Number(counts.total) < 1) throw new ApiError('unavailable');
    for (const id of ids) {
      const row = results.querySelector<HTMLElement>(`[data-result="${id}"]`)!;
      row.querySelector('[data-model]')!.textContent = names[id] as string;
      const count = Number(counts[id]);
      const percent = count / Number(counts.total) * 100;
      row.querySelector('[data-count]')!.textContent = `${percent.toFixed(1)}% · ${count.toLocaleString()} vote${count === 1 ? '' : 's'}`;
      const meter = row.querySelector('meter')!;
      meter.value = percent;
      meter.textContent = `${percent.toFixed(1)}%`;
      row.querySelector('[data-your-vote]')!.textContent = data.selectedTrack === id ? 'Your vote' : '';
    }
    results.querySelector('[data-total]')!.textContent = `${Number(counts.total).toLocaleString()} votes counted. Results as of this refresh; percentages are rounded.`;
    const chosen = ballot!.querySelector<HTMLInputElement>(`input[value="${data.selectedTrack}"]`);
    if (chosen) chosen.checked = true;
    ballot!.querySelector('.os-sealed')!.textContent = 'Your vote is final. You can refresh the community results at any time.';
    document.querySelectorAll('.os-anonymous').forEach(label => { label.textContent = 'Revealed below'; });
    results.hidden = false;
    complete = true;
    status.textContent = 'Your vote is recorded. The models and community results are revealed below.';
    retryButton.hidden = false;
    retryButton.textContent = 'Refresh results';
  }
  function showError(error: unknown) {
    const code = error instanceof ApiError ? error.code : 'network';
    const messages: Record<string, string> = {
      invalid_session: 'Your voting cookie is invalid or expired. This browser cannot recover its vote. Please contact the organizer if you need help.',
      throttled: 'Too many requests from this network. Please wait ten minutes before trying again.',
      voting_closed: 'Voting is currently closed. You can still listen to all three tracks.',
      challenge_required: 'Additional verification is required. Voting is unavailable in this interface until verification is configured.',
      invalid_csrf: 'Your session has changed. Use Check voting status before trying again.',
    };
    status.textContent = messages[code] ?? 'We could not confirm the vote or load results. Check voting status, or retry your selection. A retry will not count the same vote twice.';
    retryButton.hidden = false;
    if (!complete) retryButton.textContent = 'Check voting status';
  }
  async function loadSession() {
    if (busy) return;
    busy = true; update();
    try {
      const state = await api('session');
      if (typeof state.csrfToken !== 'string' || typeof state.hasVoted !== 'boolean' || typeof state.votingOpen !== 'boolean' || state.experimentId !== 'one-sound-001') throw new ApiError('unavailable');
      csrfToken = state.csrfToken;
      votingOpen = state.votingOpen;
      if (state.hasVoted) showResults(await api('reveal'));
      else status.textContent = votingOpen ? 'Choose your favorite, then vote to reveal the models. Your vote is final.' : 'Voting is currently closed. Listen now and return when voting opens.';
    } catch (error) { votingOpen = false; showError(error); }
    finally { busy = false; update(); }
  }
  fieldset.addEventListener('change', update);
  retryButton.addEventListener('click', () => void loadSession());
  button.addEventListener('click', async () => {
    const trackId = selected();
    if (!trackId || busy || complete || !votingOpen) return;
    if (!attempt || attempt.trackId !== trackId) attempt = {trackId, requestId: crypto.randomUUID()};
    busy = true; update(); status.textContent = 'Saving your vote…';
    try {
      showResults(await api('vote', {experimentId: 'one-sound-001', ...attempt, csrfToken}));
      results.focus();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'already_voted') {
        try { showResults(await api('reveal')); } catch (recoveryError) { showError(recoveryError); }
      } else showError(error);
    } finally { busy = false; update(); }
  });
  void loadSession();
}
