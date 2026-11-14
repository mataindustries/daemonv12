# Mathematics for Fable's separate GRIND / BOLLO work

Planning notes only. Neither instrument is implemented here.

## GRIND

For phase-continuous 808 glide, maintain one oscillator phase across notes. A linear MIDI/cents glide over T seconds has `p(t)=p0+(p1-p0)t/T`, `k=ln(2)(p1-p0)/(12T)`, `f(t)=f0 exp(kt)`. Its accumulated phase is `phi(t)=phi0+2*pi*f0*expm1(kt)/k`; for k near zero use `phi0+2*pi*f0*t`. Carry the terminal phase into the next segment and hold the terminal frequency after T. A retriggered envelope and a restarted oscillator are independent choices. The existing sample-rate glide integrates a linear rate instead; it does not provide oscillator legato.

For deterministic hats, express subdivisions as rational beat positions `b0+j/q`; convert each absolute boundary independently with integer-microsecond tempo and nearest-frame rounding. Never add a rounded step length repeatedly. Use an explicitly seeded PRNG for velocity/timing variations and define the ordering of coincident hits. Resolve choke/release starts from absolute frames.

Preserve transients by measuring the first 5–20 ms separately from the sustained body. A compressor's attack coefficient is `exp(-1/(tau*sampleRate))`; gain smoothing, detector delay and lookahead determine whether the front survives. A slow gain envelope alone cannot undo transient flattening from saturation. Oversample nonlinear stages, filter before downsampling, and test impulse alignment, crest factor and true peak on the actual output.

## BOLLO

Treat each coin impact as a deterministic event, with event-index-derived seeds so adding a later bounce cannot change earlier ones. An ideal bounce with restitution `0<e<1` has `v[n+1]=e*v[n]`, flight interval `dt[n]=2*v[n]/g`, and impact energy proportional to `v[n]^2`; intervals shrink geometrically. Accumulate event times in full precision, then round each absolute time to a sample. Set a minimum interval/energy or a maximum bounce count to terminate the finite-time accumulation.

For accelerating chatter, use an explicit phase law, e.g. `f(t)=f0+a*t` and `theta(t)=2*pi*(f0*t+0.5*a*t^2)`, placing impacts at phase crossings. Solve crossings analytically and round absolute times; do not schedule by repeatedly rounding the current period. A wobble envelope can modulate amplitude/contact strength while keeping event timing independent.

Model a metallic impact as a sum of damped, inharmonic modes: `x(t)=sum A[m]*exp(-t/tau[m])*sin(2*pi*f[m]*t+phi[m])`. Choose noninteger frequency ratios, mode-dependent decay and seeded strike weights; multiple contacts excite the same resonant state rather than resetting its decay each time. A discrete resonator has poles at `r*exp(+-i*w)` with `r=exp(-1/(tau*sampleRate))`; its denominator is `1-2*r*cos(w)*z^-1+r^2*z^-2`. Keep modes below Nyquist and normalize impact energy before summing dense chatter. Test repeatability, accumulated headroom and finite decay explicitly.
