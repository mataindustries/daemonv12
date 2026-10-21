// The only script the page ships. Progressive enhancement: everything works without it.
//  - GLASS//FIRE starts muted when it is in view after the page has loaded (never under
//    reduced motion, Save-Data or a 2G/3G connection), pauses when it leaves, and falls
//    back to a play button if autoplay is refused. preload="none" in the markup keeps the
//    MP4 off the network until then; playback streams it progressively (faststart).
//  - "Watch GLASS//FIRE" plays from the top with sound: the click is the user gesture.
import './styles.css';

// Track showcase, technology and conversion links without delaying navigation.
// The inline gtag stub queues the event even if gtag.js is still loading.
const analytics = window as Window & {gtag?: (...args: unknown[]) => void};
document.querySelectorAll<HTMLAnchorElement>('a[data-outbound]').forEach(link => {
  link.addEventListener('click', () => {
    const cta = link.dataset.outbound;
    if (cta) analytics.gtag?.('event', 'daemonv12_cta_click', {cta_name: cta, link_url: link.href});
  });
});

const video = document.querySelector<HTMLVideoElement>('video[data-promo]');
const playButton = document.querySelector<HTMLButtonElement>('[data-promo-play]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const connection = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
const constrained = connection?.saveData === true || /(^|-)(2g|3g)$/.test(connection?.effectiveType ?? '');

if (video) {
  let autoStarted = false;
  let userControlled = false;
  let scriptPause = false;

  const showPlay = (show: boolean) => {
    if (playButton) playButton.hidden = !show;
  };

  const tryAutoplay = () => {
    if (userControlled || reduceMotion.matches || constrained) {
      showPlay(video.paused);
      return;
    }
    video.muted = true;
    video
      .play()
      .then(() => {
        autoStarted = true;
        showPlay(false);
      })
      .catch(() => showPlay(true));
  };

  const markUser = () => {
    userControlled = true;
  };
  video.addEventListener('volumechange', () => {
    if (!video.muted) markUser();
  });
  video.addEventListener('seeking', markUser);
  video.addEventListener('play', () => showPlay(false));
  // A pause we didn't cause came from the native controls: stop managing playback.
  video.addEventListener('pause', () => {
    if (!scriptPause) markUser();
    scriptPause = false;
  });

  const observe = () =>
    new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          if (video.paused && !userControlled) tryAutoplay();
        } else if (autoStarted && !userControlled && !video.paused) {
          scriptPause = true;
          video.pause();
        }
      },
      {threshold: 0.3},
    ).observe(video);

  if (!('IntersectionObserver' in window)) showPlay(true);
  // Wait for load so the film never competes with first paint.
  else if (document.readyState === 'complete') observe();
  else window.addEventListener('load', observe, {once: true});

  const playWithSound = () => {
    markUser();
    video.preload = 'auto';
    video.muted = false;
    video.currentTime = 0;
    void video.play().catch(() => {
      video.muted = true;
      void video.play().catch(() => showPlay(true));
    });
  };

  playButton?.addEventListener('click', playWithSound);

  document.querySelectorAll<HTMLAnchorElement>('a[data-watch]').forEach(link =>
    link.addEventListener('click', event => {
      event.preventDefault();
      const film = document.getElementById('glass-fire');
      film?.scrollIntoView({behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'center'});
      history.replaceState(null, '', '#glass-fire');
      playWithSound();
    }),
  );

  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches && autoStarted && !userControlled && !video.paused) {
      scriptPause = true;
      video.pause();
      showPlay(true);
    }
  });
}
