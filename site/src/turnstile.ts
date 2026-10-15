// Public widget key only. Siteverify and its secret remain server-side.
const SITE_KEY = '0x4AAAAAAFXD2CJDuINrpM0q';
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
type Options = {
  sitekey: string; action: string; size: 'compact'; theme: 'dark'; retry: 'never';
  'response-field': false; 'refresh-expired': 'manual';
  callback: (token: string) => void;
  'error-callback': () => void; 'expired-callback': () => void; 'timeout-callback': () => void;
};
type Turnstile = {render: (container: HTMLElement, options: Options) => string; reset: (id: string) => void; remove: (id: string) => void};
const browser = window as Window & {turnstile?: Turnstile};
let loading: Promise<Turnstile> | undefined;
function load(): Promise<Turnstile> {
  if (browser.turnstile) return Promise.resolve(browser.turnstile);
  if (loading) return loading;
  loading = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT; script.async = true;
    const timer = window.setTimeout(failed, 15000);
    function failed() {
      clearTimeout(timer); script.remove(); loading = undefined;
      reject(new Error('Verification unavailable'));
    }
    script.onerror = failed;
    script.onload = () => {
      clearTimeout(timer);
      if (browser.turnstile) resolve(browser.turnstile); else failed();
    };
    document.head.append(script);
  });
  return loading;
}
export function verification(container: HTMLElement, note: HTMLElement, retry: HTMLButtonElement, changed: () => void) {
  let token = '';
  let id: string | undefined;
  let generation = 0;
  let active = false;
  function invalidate(message: string) {
    token = ''; note.textContent = message; retry.hidden = false; changed();
  }
  async function start() {
    if (active) return;
    active = true;
    container.parentElement!.hidden = false;
    retry.hidden = true;
    note.textContent = 'Loading browser verification…';
    const current = ++generation;
    try {
      const api = await load();
      if (!active || current !== generation) return;
      note.textContent = 'Complete the browser verification before voting.';
      const invalid = (message: string) => { if (active && current === generation) invalidate(message); };
      id = api.render(container, {
        sitekey: SITE_KEY, action: 'one-sound-vote', size: 'compact', theme: 'dark', retry: 'never',
        'response-field': false, 'refresh-expired': 'manual',
        callback: value => {
          if (!active || current !== generation) return;
          token = value; note.textContent = 'Browser verified. You can submit your vote.'; retry.hidden = true; changed();
        },
        'error-callback': () => invalid('Verification failed. Retry verification or check your connection.'),
        'expired-callback': () => invalid('Verification expired. Retry verification before submitting a new vote.'),
        'timeout-callback': () => invalid('Verification timed out. Please retry verification.'),
      });
    } catch { if (current === generation) invalidate('Verification could not load. Check your connection or content blocker, then retry verification.'); }
  }
  function stop() {
    active = false; generation++; token = '';
    if (id !== undefined) browser.turnstile?.remove(id);
    id = undefined; container.replaceChildren(); container.parentElement!.hidden = true;
  }
  function reset() { stop(); void start(); changed(); }
  retry.addEventListener('click', reset);
  return {start, stop, reset, token: () => token, consume: () => { token = ''; }};
}
