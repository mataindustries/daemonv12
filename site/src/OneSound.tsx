const tracks = ['A', 'B', 'C'] as const;

const Player = ({id, file, label}: {id: string; file: string; label: string}) => (
  <div className="os-player">
    <audio id={id} data-one-sound controls preload="none" aria-label={label} aria-describedby={`${id}-error`} src={`/media/one-sound/${file}`}>
      Your browser does not support audio playback. <a href={`/media/one-sound/${file}`}>Open {label}</a>.
    </audio>
    <p id={`${id}-error`} className="os-error" data-audio-error hidden role="status">
      Audio could not load. <a href={`/media/one-sound/${file}`}>Open {label} directly</a> or try again.
    </p>
  </div>
);

export const OneSound = () => (
  <div className="one-sound" id="top">
    <a className="skip" href="#one-sound-main">Skip to listening experiment</a>
    <header className="os-header wrap">
      <a className="wordmark" href="/" aria-label="DaemonV12 home">DAEMONV12</a>
      <a href="/#try">Try DaemonV12 <span aria-hidden="true">↗</span></a>
    </header>
    <main id="one-sound-main" className="wrap">
      <section className="os-hero" aria-labelledby="os-title">
        <p className="os-eyebrow">Experiment 001 <span>Blind listening / Experiment 001</span></p>
        <h1 id="os-title">ONE SOUND.<br /><span>THREE MINDS.</span></h1>
        <div className="os-intro">
          <p>One metallic hit. Three AI coding models. Three ways to make it move.</p>
          <p>Each model composed a unique 30-second beat from the exact same 1.5-second sample using DaemonV12. Listen without the names. Let your ears decide.</p>
        </div>
        <a className="os-listen-link" href="#source">Start with the sound <span aria-hidden="true">↓</span></a>
        <dl className="os-specs">
          <div><dt>Source</dt><dd>1.5 seconds</dd></div>
          <div><dt>Tempo</dt><dd>128 BPM</dd></div>
          <div><dt>Key</dt><dd>C# minor</dd></div>
          <div><dt>Arrangements</dt><dd>30 seconds</dd></div>
        </dl>
      </section>

      <section id="source" className="os-section os-source" aria-labelledby="source-title">
        <div>
          <p className="os-eyebrow">01 / The starting point</p>
          <h2 id="source-title">Everything starts here.</h2>
          <p>A single metallic C#3 hit. This is the original, unaltered sample that all three models received.</p>
        </div>
        <div className="os-source-player">
          <div className="os-source-mark" aria-hidden="true"><span>+</span> 1 → 3</div>
          <div className="os-player-heading"><h3>Original sound</h3><span>1.5s / WAV</span></div>
          <Player id="audio-source" file="Original_One_Sound.wav" label="Original sound, 1.5 seconds" />
        </div>
      </section>

      <section id="tracks" className="os-section" aria-labelledby="tracks-title">
        <p className="os-eyebrow">02 / The interpretations</p>
        <h2 id="tracks-title">Same starting point.<br />Different instincts.</h2>
        <p className="os-copy">One shared engine. Equal challenge rules. Three anonymous arrangements at 128 BPM in C# minor. The listening copies are loudness matched so you can focus on the music.</p>
        <p className="os-hint">Headphones recommended. Start any player to pause the others. Each track keeps its place when paused.</p>
        <noscript><p>JavaScript is off: pause the current player before starting another.</p></noscript>
        <div className="os-tracks">
          {tracks.map(track => (
            <article key={track} className="os-track" aria-labelledby={`track-${track}`}>
              <div className="os-track-top"><span className="os-letter" aria-hidden="true">{track}</span><span className="os-anonymous">Identity sealed</span></div>
              <div className="os-player-heading"><h3 id={`track-${track}`}>Track {track}</h3><span>30s / MP3</span></div>
              <Player id={`audio-${track}`} file={`Track_${track}.mp3`} label={`Track ${track}, 30 seconds`} />
            </article>
          ))}
        </div>
      </section>

      <section id="vote" className="os-section os-vote" aria-labelledby="vote-title">
        <div>
          <p className="os-eyebrow">03 / Your verdict</p>
          <h2 id="vote-title">Which one stays<br />with you?</h2>
          <p>Listen to all three, then choose your favorite. After your vote is saved, discover the models behind the music and see the community results.</p>
        </div>
        <div className="os-ballot">
          <fieldset aria-describedby="vote-note">
            <legend>Your favorite track</legend>
            <div className="os-choices">
              {tracks.map(track => <label key={track}><input type="radio" name="favorite" value={track} /><span>Track {track}</span></label>)}
            </div>
          </fieldset>
          <p id="vote-note" role="status" aria-live="polite">Checking voting availability… JavaScript is required to vote.</p>
          <p>Voting uses a secure cookie for up to 90 days to remember your vote. Cookie restrictions cannot fully prevent repeat voting across browsers or devices. This is an informal listening experiment.</p>
          <div className="os-verification" hidden>
            <p id="verification-note" role="status" aria-live="polite" />
            <div id="vote-verification" aria-describedby="verification-note" />
            <button type="button" className="os-recover" data-verification-retry hidden>Retry verification</button>
          </div>
          <button type="button" className="os-vote-button" disabled aria-describedby="vote-note">Vote &amp; Reveal</button>
          <button type="button" className="os-recover" data-vote-recover hidden>Check voting status</button>
          <p className="os-sealed">Identities and results unlock only after a saved vote.</p>
        </div>
      </section>
      <section id="vote-results" className="os-section os-results" aria-labelledby="results-title" tabIndex={-1} hidden>
        <p className="os-eyebrow">04 / Behind the sound</p>
        <h2 id="results-title">The minds behind the music.</h2>
        <p data-total />
        <div className="os-results-grid">
          {tracks.map(track => <article key={track} data-result={track}>
            <p className="os-eyebrow">Track {track} <span data-your-vote /></p>
            <h3 data-model />
            <meter min="0" max="100" value="0" aria-label={`Track ${track} vote percentage`} />
            <p data-count />
          </article>)}
        </div>
      </section>
      <section className="os-outro" aria-labelledby="os-try">
        <p className="os-eyebrow">The instrument behind the experiment</p>
        <h2 id="os-try">Give your agent instruments.</h2>
        <p>DaemonV12 is a headless music engine for coding agents. Compose, process and render music without a DAW.</p>
        <a className="btn btn--primary" href="/#try">Try DaemonV12 <span aria-hidden="true">↗</span></a>
        <a className="os-home" href="/">Explore DaemonV12</a>
      </section>
    </main>
    <footer className="os-footer wrap"><a href="/">DAEMONV12</a><span>ONE SOUND / THREE MINDS · 001</span></footer>
  </div>
);
