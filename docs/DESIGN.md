<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&amp;display=block">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&amp;display=swap">
<style>
:root{
--canvas:#EAE6DD;--surface:#F3EFE6;--ink:#26292E;--muted:#7A7566;--muted-strong:#63604F;
--accent:#0E6E75;--error:#BF3B2E;--error-strong:#A83527;--hairline:#D6D0C4;
}
[data-theme="dark"]{
--canvas:#16181A;--surface:#1E2124;--ink:#E6E2D8;--muted:#75705F;--muted-strong:#948F80;
--accent:#3FB3B8;--error:#E0685A;--error-strong:#E0685A;--hairline:#2C3033;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--canvas);-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
input,select{font:inherit;color:inherit}
a{color:var(--accent);text-decoration:none}
a:hover{color:var(--ink)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
::selection{background:var(--accent);color:var(--canvas)}
.char{transition:color 60ms linear}
.caret{transition:transform 90ms cubic-bezier(0.2,0,0,1)}
@keyframes blink{0%,45%{opacity:1}55%,100%{opacity:0}}
@keyframes draw{to{stroke-dashoffset:0}}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){
.caret{transition:transform 40ms linear;animation:none !important}
*{animation-duration:0.001ms !important;animation-delay:0ms !important;transition-duration:0.001ms !important}
}
</style>
</helmet>
<div data-theme="{{ theme }}" style="min-height:100vh;background:var(--canvas);color:var(--ink);font-family:'Instrument Sans',system-ui,sans-serif;display:flex;flex-direction:column">

  <header style="{{ chromeStyle }}">
    <button onClick="{{ goTest }}" style="display:flex;align-items:center;gap:10px;padding:4px;border-radius:4px">
      <span style="display:inline-flex;flex-direction:column;gap:3px">
        <span style="display:flex;align-items:flex-end;gap:3px;font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:16px;line-height:0.86;letter-spacing:-0.01em;color:var(--ink)">
          <span>crudu</span>
          <span style="width:2px;height:11px;background:var(--accent)"></span>
        </span>
        <span style="height:1px;background:var(--accent)"></span>
      </span>
    </button>
    <nav style="display:flex;align-items:center;gap:20px;font-size:13px;font-weight:500;letter-spacing:0.02em">
      <button onClick="{{ goTest }}" style="{{ navTest }}">Test</button>
      <button onClick="{{ goProgress }}" style="{{ navProgress }}">Progress</button>
      <button onClick="{{ goWeakness }}" style="{{ navWeakness }}">Weaknesses</button>
      <button onClick="{{ goSettings }}" style="{{ navSettings }}">Settings</button>
    </nav>
  </header>

  <sc-if value="{{ isTest }}" hint-placeholder-val="{{ true }}">
    <main style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:0 24px;position:relative">
      <div style="{{ counterStyle }}">{{ counterText }}</div>

      <div style="{{ testBlockStyle }}">
        <div style="{{ configBarStyle }}">
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center;font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--muted-strong);padding-bottom:32px">
            <div style="display:flex;gap:10px">
              <button onClick="{{ setModeTime }}" style="{{ modeTimeStyle }}">time</button>
              <button onClick="{{ setModeWords }}" style="{{ modeWordsStyle }}">words</button>
            </div>
            <div style="width:1px;height:14px;background:var(--hairline)"></div>
            <div style="display:flex;gap:10px">
              <sc-for list="{{ valueOptions }}" as="opt" hint-placeholder-count="4">
                <button onClick="{{ opt.onClick }}" style="{{ opt.style }}">{{ opt.label }}</button>
              </sc-for>
            </div>
            <div style="width:1px;height:14px;background:var(--hairline)"></div>
            <div style="display:flex;gap:10px">
              <button onClick="{{ togglePunct }}" style="{{ punctStyle }}">punctuation</button>
              <button onClick="{{ toggleNums }}" style="{{ numsStyle }}">numbers</button>
            </div>
          </div>
        </div>

        <div onClick="{{ refocus }}" style="{{ surfaceWrapStyle }}">
          <div style="{{ surfaceViewportStyle }}">
            <div ref="{{ surfaceRef }}" style="{{ surfaceInnerStyle }}">
              <sc-for list="{{ renderWords }}" as="w" hint-placeholder-count="24">
                <span style="display:inline-flex;white-space:nowrap">
                  <sc-for list="{{ w.chars }}" as="c" hint-placeholder-count="5">
                    <span class="char" data-c="{{ c.caret }}" style="{{ c.style }}">{{ c.ch }}</span>
                  </sc-for>
                </span>
              </sc-for>
            </div>
            <div class="caret" style="{{ caretStyle }}"></div>
            <div style="{{ traceTrackStyle }}">
              <div style="{{ traceStyle }}"></div>
            </div>
          </div>
        </div>

        <div style="{{ hintStyle }}">Start typing</div>
      </div>

      <sc-if value="{{ showPaused }}" hint-placeholder-val="{{ false }}">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
          <span style="font-size:16px;color:var(--ink);letter-spacing:0.01em">Click or press any key to resume</span>
        </div>
      </sc-if>

      <input ref="{{ inputRef }}" onKeyDown="{{ onKeyDown }}" onBlur="{{ onBlur }}" onFocus="{{ onFocus }}" onChange="{{ noop }}" value="" aria-label="Typing input" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck="false" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
    </main>
  </sc-if>

  <sc-if value="{{ isResults }}" hint-placeholder-val="{{ false }}">
    <main style="flex:1;width:100%;max-width:860px;margin:0 auto;padding:8px 24px 96px">
      <div style="display:flex;gap:64px;flex-wrap:wrap">
        <div>
          <div style="{{ wpmNumberStyle }}">{{ displayWpm }}</div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-top:4px">
            <span style="font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--muted-strong)">wpm</span>
            <span style="{{ wpmDeltaStyle }}">{{ wpmDelta }}</span>
          </div>
          <sc-if value="{{ isPB }}" hint-placeholder-val="{{ false }}">
            <div style="font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--accent);margin-top:6px">Best at this setting</div>
          </sc-if>
        </div>
        <div>
          <div style="font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:56px;line-height:1;font-variant-numeric:tabular-nums;color:var(--ink)">{{ displayAcc }}</div>
          <div style="display:flex;align-items:baseline;gap:8px;margin-top:4px">
            <span style="font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--muted-strong)">accuracy</span>
            <span style="{{ accDeltaStyle }}">{{ accDelta }}</span>
          </div>
        </div>
      </div>

      <div style="margin-top:48px;position:relative;height:180px;width:100%">
        <svg viewBox="0 0 900 180" preserveAspectRatio="none" style="width:100%;height:180px;display:block;overflow:visible">
          <line x1="0" y1="{{ medianY }}" x2="900" y2="{{ medianY }}" stroke="var(--hairline)" stroke-width="1" vector-effect="non-scaling-stroke"></line>
          <path d="{{ graphPath }}" fill="none" stroke="var(--accent)" stroke-width="2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" vector-effect="non-scaling-stroke" style="animation:draw 400ms 150ms linear forwards"></path>
          <sc-for list="{{ errorTicks }}" as="t" hint-placeholder-count="0">
            <line x1="{{ t.x }}" y1="172" x2="{{ t.x }}" y2="180" stroke="var(--error)" stroke-width="2" vector-effect="non-scaling-stroke"></line>
          </sc-for>
        </svg>
      </div>

      <div style="display:flex;gap:48px;flex-wrap:wrap;margin-top:32px;animation:rise 180ms 350ms cubic-bezier(0.2,0,0,1) both">
        <sc-for list="{{ secondary }}" as="s" hint-placeholder-count="4">
          <div>
            <div style="font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--muted-strong)">{{ s.label }}</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-weight:600;font-size:20px;font-variant-numeric:tabular-nums;color:var(--ink);margin-top:4px">{{ s.value }}</div>
          </div>
        </sc-for>
      </div>

      <div style="margin-top:48px;background:var(--surface);border:1px solid var(--hairline);border-radius:4px;padding:24px;animation:rise 180ms 390ms cubic-bezier(0.2,0,0,1) both">
        <sc-if value="{{ calibrating }}" hint-placeholder-val="{{ false }}">
          <div style="font-size:14px;color:var(--ink)">{{ calibratingCopy }}</div>
        </sc-if>
        <sc-if value="{{ showWeakCard }}" hint-placeholder-val="{{ true }}">
          <div>
            <div style="font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--muted-strong)">Slowest transitions</div>
            <div style="display:flex;flex-direction:column;gap:14px;margin-top:16px">
              <sc-for list="{{ weakTop }}" as="w" hint-placeholder-count="3">
                <div style="display:flex;align-items:baseline;gap:16px">
                  <span style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;color:var(--ink);min-width:3ch">{{ w.pair }}</span>
                  <span style="font-size:14px;color:var(--ink)">{{ w.body }}</span>
                </div>
              </sc-for>
            </div>
            <button onClick="{{ goWeakness }}" style="margin-top:24px;padding:9px 16px;border-radius:4px;background:var(--accent);color:var(--canvas);font-size:13px;font-weight:600;letter-spacing:0.02em">Drill these</button>
          </div>
        </sc-if>
      </div>

      <div style="display:flex;gap:24px;margin-top:32px;font-size:13px;font-weight:500;letter-spacing:0.02em">
        <button onClick="{{ repeatTest }}" style="color:var(--muted-strong);padding:4px;border-radius:4px">Repeat test</button>
        <button onClick="{{ newTest }}" style="color:var(--muted-strong);padding:4px;border-radius:4px">New test</button>
      </div>
    </main>
  </sc-if>

  <sc-if value="{{ isProgress }}" hint-placeholder-val="{{ false }}">
    <main style="flex:1;width:100%;max-width:860px;margin:0 auto;padding:24px 24px 96px">
      <sc-if value="{{ hasProgress }}" hint-placeholder-val="{{ true }}">
        <div>
          <div style="font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--muted-strong)">7 day rolling median</div>
          <div style="position:relative;margin-top:16px">
            <svg viewBox="0 0 900 220" preserveAspectRatio="none" style="width:100%;height:220px;display:block;overflow:visible">
              <line x1="0" y1="{{ progMedianY }}" x2="900" y2="{{ progMedianY }}" stroke="var(--hairline)" stroke-width="1" vector-effect="non-scaling-stroke"></line>
              <path d="{{ progPath }}" fill="none" stroke="var(--accent)" stroke-width="2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" vector-effect="non-scaling-stroke" style="animation:draw 500ms linear forwards"></path>
            </svg>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--muted-strong)">
            <span>{{ progFirstLabel }}</span>
            <span>{{ progLastLabel }}</span>
          </div>

          <div style="margin-top:64px;font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--muted-strong)">Improved this week</div>
          <div style="display:flex;flex-direction:column;gap:16px;margin-top:20px;max-width:520px">
            <sc-for list="{{ improved }}" as="r" hint-placeholder-count="4">
              <div style="display:flex;align-items:baseline;gap:20px">
                <span style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;color:var(--ink);min-width:3ch">{{ r.pair }}</span>
                <span style="font-family:'IBM Plex Mono',monospace;font-size:14px;color:var(--muted-strong);text-decoration:line-through">{{ r.before }}</span>
                <span style="font-family:'IBM Plex Mono',monospace;font-size:14px;color:var(--accent)">{{ r.after }}</span>
              </div>
            </sc-for>
          </div>
        </div>
      </sc-if>
      <sc-if value="{{ progressEmpty }}" hint-placeholder-val="{{ false }}">
        <div style="min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center">
          <div style="font-size:20px;color:var(--ink)">Nothing plotted yet.</div>
          <div style="font-size:14px;color:var(--muted-strong)">Run three tests and your first line appears here.</div>
          <button onClick="{{ newTest }}" style="margin-top:12px;padding:9px 16px;border-radius:4px;background:var(--accent);color:var(--canvas);font-size:13px;font-weight:600;letter-spacing:0.02em">Run a test.</button>
        </div>
      </sc-if>
    </main>
  </sc-if>

  <sc-if value="{{ isWeakness }}" hint-placeholder-val="{{ false }}">
    <main style="flex:1;width:100%;max-width:860px;margin:0 auto;padding:24px 24px 96px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--muted-strong)">
        <span>Tracked transitions, slowest first</span>
        <span>{{ weakCountLabel }}</span>
      </div>
      <div style="display:flex;flex-direction:column;margin-top:24px">
        <sc-for list="{{ weakRows }}" as="r" hint-placeholder-count="10">
          <div style="{{ r.rowStyle }}">
            <span style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;min-width:4ch">{{ r.pair }}</span>
            <span style="flex:1;height:6px;background:var(--hairline);border-radius:4px;overflow:hidden;min-width:80px">
              <span style="{{ r.barStyle }}"></span>
            </span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:14px;font-variant-numeric:tabular-nums;min-width:7ch;text-align:right">{{ r.latency }}</span>
            <span style="font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--muted-strong);min-width:13ch;text-align:right">{{ r.note }}</span>
          </div>
        </sc-for>
      </div>
      <sc-if value="{{ weaknessEmpty }}" hint-placeholder-val="{{ false }}">
        <div style="min-height:50vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center">
          <div style="font-size:20px;color:var(--ink)">Nothing plotted yet.</div>
          <div style="font-size:14px;color:var(--muted-strong)">Run three tests and your first line appears here.</div>
          <button onClick="{{ newTest }}" style="margin-top:12px;padding:9px 16px;border-radius:4px;background:var(--accent);color:var(--canvas);font-size:13px;font-weight:600;letter-spacing:0.02em">Run a test.</button>
        </div>
      </sc-if>
    </main>
  </sc-if>

  <sc-if value="{{ isSettings }}" hint-placeholder-val="{{ false }}">
    <main style="flex:1;width:100%;max-width:520px;margin:0 auto;padding:24px 24px 96px">
      <div style="font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--muted-strong)">Test</div>
      <div style="display:flex;flex-direction:column;gap:20px;margin-top:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:24px">
          <label style="font-size:14px;color:var(--ink)">Mode</label>
          <div style="display:flex;gap:10px;font-size:13px;font-weight:500;letter-spacing:0.02em">
            <button onClick="{{ setModeTime }}" style="{{ modeTimeStyle }}">time</button>
            <button onClick="{{ setModeWords }}" style="{{ modeWordsStyle }}">words</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:24px">
          <label style="font-size:14px;color:var(--ink)">{{ valueLabel }}</label>
          <div style="display:flex;gap:10px;font-size:13px;font-weight:500;letter-spacing:0.02em">
            <sc-for list="{{ valueOptions }}" as="opt" hint-placeholder-count="4">
              <button onClick="{{ opt.onClick }}" style="{{ opt.style }}">{{ opt.label }}</button>
            </sc-for>
          </div>
        </div>
      </div>

      <div style="height:1px;background:var(--hairline);margin:32px 0"></div>

      <div style="font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--muted-strong)">Behaviour</div>
      <div style="display:flex;flex-direction:column;gap:20px;margin-top:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:24px">
          <label style="font-size:14px;color:var(--ink)">Punctuation</label>
          <button onClick="{{ togglePunct }}" style="{{ punctSwitchStyle }}">{{ punctLabel }}</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:24px">
          <label style="font-size:14px;color:var(--ink)">Numbers</label>
          <button onClick="{{ toggleNums }}" style="{{ numsSwitchStyle }}">{{ numsLabel }}</button>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:24px">
          <label style="font-size:14px;color:var(--ink)">Stop on first error</label>
          <button onClick="{{ toggleStop }}" style="{{ stopSwitchStyle }}">{{ stopLabel }}</button>
        </div>
      </div>

      <div style="height:1px;background:var(--hairline);margin:32px 0"></div>

      <div style="font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--muted-strong)">Appearance</div>
      <div style="display:flex;flex-direction:column;gap:20px;margin-top:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:24px">
          <label style="font-size:14px;color:var(--ink)">Theme</label>
          <div style="display:flex;gap:10px;font-size:13px;font-weight:500;letter-spacing:0.02em">
            <sc-for list="{{ themeOptions }}" as="opt" hint-placeholder-count="3">
              <button onClick="{{ opt.onClick }}" style="{{ opt.style }}">{{ opt.label }}</button>
            </sc-for>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:24px">
          <label style="font-size:14px;color:var(--ink)">Caret blink</label>
          <button onClick="{{ toggleBlink }}" style="{{ blinkSwitchStyle }}">{{ blinkLabel }}</button>
        </div>
      </div>

      <sc-if value="{{ storageError }}" hint-placeholder-val="{{ false }}">
        <div style="margin-top:32px;font-size:13px;font-weight:500;letter-spacing:0.02em;color:var(--error-strong)">Could not save that test. Your history is intact.</div>
      </sc-if>
    </main>
  </sc-if>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props="{&quot;theme&quot;:{&quot;editor&quot;:&quot;enum&quot;,&quot;options&quot;:[&quot;light&quot;,&quot;dark&quot;],&quot;default&quot;:&quot;light&quot;,&quot;tsType&quot;:&quot;'light'|'dark'&quot;},&quot;defaultMode&quot;:{&quot;editor&quot;:&quot;enum&quot;,&quot;options&quot;:[&quot;time&quot;,&quot;words&quot;],&quot;default&quot;:&quot;time&quot;,&quot;tsType&quot;:&quot;'time'|'words'&quot;},&quot;defaultDuration&quot;:{&quot;editor&quot;:&quot;int&quot;,&quot;default&quot;:30,&quot;min&quot;:15,&quot;max&quot;:120,&quot;step&quot;:15,&quot;unit&quot;:&quot;s&quot;,&quot;tsType&quot;:&quot;number&quot;},&quot;punctuation&quot;:{&quot;editor&quot;:&quot;boolean&quot;,&quot;default&quot;:false,&quot;tsType&quot;:&quot;boolean&quot;},&quot;demoData&quot;:{&quot;editor&quot;:&quot;boolean&quot;,&quot;default&quot;:true,&quot;tsType&quot;:&quot;boolean&quot;,&quot;section&quot;:&quot;Data&quot;}}">
const WORDS = "the be of and a to in he have it that for they with as not on she at by this we you do but from or which one would all will there say who make when can more if no man out other so what time up go about than into could state only new year some take come these know see use get like then first any work now may such give over think most even find day also after way many must look before great back through long where much should well people down own just because good each those feel seem how high too place little world very still nation hand old life tell write become here show house both between need mean call develop under last right move thing general school never same another begin while number part turn real leave might want point form off child few small since against ask late home interest large person end open public follow during present without again hold around possible head consider word program problem however lead system set order eye plan run keep face fact group play stand increase early course change help line".split(" ");
const PUNCT = [",", ".", ";", ":", "'", "-", "(", ")"];
const KEY = "crudu.history.v1";

function median(a) {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function seedHistory() {
  const now = Date.now(), day = 86400000;
  const pairs = ["ol", "ny", "br", "gh", "pl", "rt", "sw", "mn", "cr", "kv", "ws", "yu", "qu", "zi", "xt"];
  const out = [];
  const wpms = [69, 72, 71, 75, 74, 78, 77, 81, 80];
  wpms.forEach((w, i) => {
    const bigrams = {};
    pairs.forEach((p, j) => {
      const base = 110 + j * 16 - i * 3;
      bigrams[p] = { n: 3 + ((i + j) % 9), total: base * (3 + ((i + j) % 9)) };
    });
    out.push({
      ts: now - (8 - i) * day * 0.75,
      wpm: w, acc: 94 + (i % 4), raw: w + 4 + (i % 3),
      mode: "time", value: 30, bigrams
    });
  });
  return out;
}

class Component extends DCLogic {
  constructor(props) {
    super(props);
    let history = [];
    let storageError = false;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) history = JSON.parse(raw);
    } catch (e) { storageError = true; }
    if (!history.length && (props.demoData ?? true)) history = seedHistory();
    this.state = {
      screen: "test",
      theme: props.theme || "light",
      mode: props.defaultMode || "time",
      value: props.defaultMode === "words" ? 25 : (props.defaultDuration ?? 30),
      punct: props.punctuation ?? false,
      nums: false,
      stopOnError: false,
      blink: true,
      words: [], typed: [], wi: 0, input: "", renderStart: 0,
      started: false, finished: false, paused: false, focused: true,
      timeLeft: props.defaultDuration ?? 30,
      caret: { left: 0, top: 0, row: 0 }, scrollRow: 0, lineW: 1,
      keys: [], results: null, displayWpm: 0, displayAcc: 0,
      history, storageError, narrow: false
    };
    this.inputRef = React.createRef();
    this.surfaceRef = React.createRef();
  }

  componentDidMount() {
    this.gen();
    this.measureNarrow();
    this._rs = () => this.measureNarrow();
    window.addEventListener("resize", this._rs);
    this._doc = (e) => {
      if (this.state.screen !== "test") return;
      if (!this.state.focused && this.inputRef.current) this.inputRef.current.focus();
    };
    window.addEventListener("keydown", this._doc);
    setTimeout(() => this.inputRef.current && this.inputRef.current.focus(), 0);
  }
  componentWillUnmount() {
    window.removeEventListener("resize", this._rs);
    window.removeEventListener("keydown", this._doc);
    clearInterval(this._t);
    cancelAnimationFrame(this._raf);
  }
  componentDidUpdate() { this.measureCaret(); }

  measureNarrow() {
    const n = window.innerWidth < 620;
    if (n !== this.state.narrow) this.setState({ narrow: n }, () => this.measureCaret());
  }

  lineH() { return this.state.narrow ? 34 : 46; }

  measureCaret() {
    const host = this.surfaceRef.current;
    if (!host) return;
    const el = host.querySelector('[data-c="1"],[data-c="2"]');
    const lh = this.lineH();
    let left = 0, top = 0;
    if (el) {
      left = el.offsetLeft + (el.dataset.c === "2" ? el.offsetWidth : 0);
      top = el.offsetTop;
    }
    const row = Math.round(top / lh);
    const scrollRow = Math.max(0, row - 1);
    const lineW = host.clientWidth || 1;
    const c = this.state.caret;
    if (c.left !== left || c.top !== top || this.state.scrollRow !== scrollRow || this.state.lineW !== lineW) {
      this.setState({ caret: { left, top, row }, scrollRow, lineW });
    }
  }

  gen() {
    this._pausedMs = 0; this._pauseStart = null;
    const count = this.state.mode === "words" ? this.state.value : Math.max(160, this.state.value * 4);
    const out = [];
    for (let i = 0; i < count; i++) {
      let w = WORDS[Math.floor(Math.random() * WORDS.length)];
      if (this.state.nums && Math.random() < 0.15) w = String(Math.floor(Math.random() * 9000) + 10);
      else if (this.state.punct && Math.random() < 0.2) w = w + PUNCT[Math.floor(Math.random() * PUNCT.length)];
      out.push(w);
    }
    this.setState({
      words: out, typed: [], wi: 0, input: "", started: false, finished: false,
      paused: false, keys: [], results: null, displayWpm: 0, displayAcc: 0,
      timeLeft: this.state.mode === "time" ? this.state.value : 0,
      caret: { left: 0, top: 0, row: 0 }, scrollRow: 0, renderStart: 0
    }, () => this.measureCaret());
    clearInterval(this._t);
  }

  start() {
    if (this.state.started) return;
    this._t0 = performance.now();
    this.setState({ started: true });
    if (this.state.mode === "time") {
      this._t = setInterval(() => {
        if (this.state.paused) return;
        const left = this.state.value - Math.floor((performance.now() - this._t0 - (this._pausedMs || 0)) / 1000);
        if (left <= 0) { this.setState({ timeLeft: 0 }); this.finish(); }
        else this.setState({ timeLeft: left });
      }, 100);
    }
  }

  onKeyDown = (e) => {
    if (this.state.finished) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    if (k === "Tab") return;
    if (k === "Escape") { e.preventDefault(); this.gen(); return;
    }
    if (k === "Backspace") {
      e.preventDefault();
      if (this.state.input.length) this.setState({ input: this.state.input.slice(0, -1) });
      else if (this.state.wi > 0) {
        const wi = this.state.wi - 1;
        const typed = this.state.typed.slice();
        this.setState({ wi, input: typed[wi] || "" });
      }
      return;
    }
    if (k === " ") {
      e.preventDefault();
      if (!this.state.input.length) return;
      this.start();
      const typed = this.state.typed.slice();
      typed[this.state.wi] = this.state.input;
      const wi = this.state.wi + 1;
      const rs = this.state.renderStart;
      this.setState({ typed, wi, input: "", renderStart: wi - rs > 60 ? rs + 30 : rs }, () => {
        if (this.state.mode === "words" && wi >= this.state.words.length) this.finish();
      });
      return;
    }
    if (k.length !== 1) return;
    e.preventDefault();
    this.start();
    const word = this.state.words[this.state.wi] || "";
    const pos = this.state.input.length;
    const correct = word[pos] === k;
    if (this.state.stopOnError && !correct) return;
    const keys = this.state.keys.concat([{ t: performance.now() - this._t0 - (this._pausedMs || 0), ch: k, prev: pos > 0 ? word[pos - 1] : null, correct }]);
    const input = this.state.input + k;
    this.setState({ keys, input }, () => {
      if (this.state.mode === "words" && this.state.wi === this.state.words.length - 1 && input.length >= word.length) {
        const typed = this.state.typed.slice();
        typed[this.state.wi] = input;
        this.setState({ typed }, () => this.finish());
      }
    });
  };

  onBlur = () => {
    this.setState(s => {
      const pause = s.started && !s.finished;
      if (pause) this._pauseStart = performance.now();
      return { focused: false, paused: pause };
    });
  };
  onFocus = () => {
    this.setState(s => {
      if (s.paused && this._pauseStart) {
        this._pausedMs = (this._pausedMs || 0) + (performance.now() - this._pauseStart);
        this._pauseStart = null;
      }
      return { focused: true, paused: false };
    });
  };
  refocus = () => { this.inputRef.current && this.inputRef.current.focus(); };
  noop = () => {};

  finish() {
    clearInterval(this._t);
    const keys = this.state.keys;
    const elapsed = this.state.mode === "time" ? this.state.value : Math.max(1, (keys.length ? keys[keys.length - 1].t : 1000) / 1000);
    const correct = keys.filter(k => k.correct).length;
    const wpm = Math.round((correct / 5) / (elapsed / 60));
    const raw = Math.round((keys.length / 5) / (elapsed / 60));
    const acc = keys.length ? Math.round((correct / keys.length) * 100) : 100;

    const buckets = {};
    keys.forEach(k => { const s = Math.floor(k.t / 1000); (buckets[s] = buckets[s] || []).push(k); });
    const secs = Object.keys(buckets).map(Number).sort((a, b) => a - b);
    const series = secs.map(s => ({ s, wpm: Math.round((buckets[s].filter(k => k.correct).length / 5) * 60), err: buckets[s].some(k => !k.correct) }));
    const mean = series.reduce((a, b) => a + b.wpm, 0) / (series.length || 1);
    const sd = Math.sqrt(series.reduce((a, b) => a + Math.pow(b.wpm - mean, 2), 0) / (series.length || 1));
    const consistency = series.length ? Math.max(0, Math.round(100 - (sd / (mean || 1)) * 100)) : 100;

    const bigrams = {};
    let prevT = 0;
    keys.forEach((k, i) => {
      const lat = i === 0 ? 0 : k.t - keys[i - 1].t;
      if (i > 0 && k.correct && keys[i - 1].correct && k.prev) {
        const key = k.prev + k.ch;
        const b = bigrams[key] = bigrams[key] || { n: 0, total: 0 };
        b.n++; b.total += Math.min(lat, 900);
      }
      prevT = k.t;
    });

    const entry = { ts: Date.now(), wpm, acc, raw, mode: this.state.mode, value: this.state.value, bigrams };
    const history = this.state.history.concat([entry]);
    let storageError = false;
    try { localStorage.setItem(KEY, JSON.stringify(history)); } catch (e) { storageError = true; }

    const sameSetting = this.state.history.filter(h => h.mode === entry.mode && h.value === entry.value);
    const isPB = sameSetting.length > 0 && wpm > Math.max.apply(null, sameSetting.map(h => h.wpm));
    const med = median(this.state.history.map(h => h.wpm));
    const medAcc = median(this.state.history.map(h => h.acc));

    this.setState({
      finished: true, screen: "results", history, storageError,
      results: { wpm, acc, raw, consistency, chars: keys.length, elapsed, series, isPB, med, medAcc, bigrams },
      displayWpm: 0, displayAcc: 0
    }, () => this.countUp(wpm, acc));
  }

  countUp(wpm, acc) {
    const t0 = performance.now();
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / 400);
      const e = 1 - Math.pow(1 - p, 3);
      this.setState({ displayWpm: Math.round(wpm * e), displayAcc: Math.round(acc * e) });
      if (p < 1) this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  allBigrams() {
    const agg = {};
    this.state.history.forEach(h => {
      Object.keys(h.bigrams || {}).forEach(k => {
        const a = agg[k] = agg[k] || { n: 0, total: 0 };
        a.n += h.bigrams[k].n; a.total += h.bigrams[k].total;
      });
    });
    return Object.keys(agg).map(k => ({ pair: k, n: agg[k].n, ms: Math.round(agg[k].total / agg[k].n) }));
  }

  chip(active, dim) {
    return {
      padding: "4px 8px", borderRadius: 4,
      color: active ? "var(--accent)" : "var(--muted-strong)",
      background: active ? "color-mix(in oklab, var(--accent) 12%, transparent)" : "transparent",
      fontWeight: 500, letterSpacing: "0.02em", opacity: dim ? 0.6 : 1
    };
  }
  navBtn(on) {
    return { color: on ? "var(--ink)" : "var(--muted-strong)", padding: "4px", borderRadius: 4, fontWeight: on ? 600 : 500, letterSpacing: "0.02em" };
  }
  sw(on) {
    return { padding: "5px 12px", borderRadius: 4, border: "1px solid " + (on ? "var(--accent)" : "var(--hairline)"), color: on ? "var(--accent)" : "var(--muted-strong)", fontSize: 13, fontWeight: 500, letterSpacing: "0.02em", minWidth: 64 };
  }

  renderVals() {
    const s = this.state;
    const active = s.screen === "test" && s.started && !s.finished && !s.paused;
    const lh = this.lineH();
    const fs = s.narrow ? 20 : 28;
    const maxCh = s.narrow ? 32 : 62;

    const rStart = s.renderStart || 0;
    const renderWords = s.words.slice(rStart, rStart + 120).map((w, k0) => {
      const i = rStart + k0;
      const t = i === s.wi ? s.input : (s.typed[i] || (i < s.wi ? "" : null));
      const chars = [];
      for (let j = 0; j < w.length; j++) {
        let color = "var(--muted)", ul = "none";
        if (t != null && j < t.length) {
          if (t[j] === w[j]) color = "var(--ink)";
          else { color = "var(--error)"; ul = "2px solid var(--error)"; }
        }
        chars.push({
          ch: w[j],
          caret: i === s.wi && j === s.input.length && s.input.length <= w.length ? "1" : "0",
          style: { color, borderBottom: ul, lineHeight: lh + "px", display: "inline-block" }
        });
      }
      if (t && t.length > w.length) {
        for (let j = w.length; j < t.length; j++) {
          chars.push({ ch: t[j], caret: "0", style: { color: "var(--error)", opacity: 0.6, borderBottom: "2px solid var(--error)", lineHeight: lh + "px", display: "inline-block" } });
        }
      }
      if (i === s.wi && s.input.length >= chars.length && chars.length) chars[chars.length - 1].caret = "2";
      return { chars };
    });

    const caretTop = s.caret.top - s.scrollRow * lh;
    const traceRow = s.caret.row - s.scrollRow;
    const r = s.results || {};
    const series = r.series || [];
    const maxW = Math.max(60, ...series.map(p => p.wpm));
    const gx = (i) => series.length > 1 ? (i / (series.length - 1)) * 900 : 0;
    const gy = (v) => 170 - (v / maxW) * 160;
    const graphPath = series.length > 1 ? series.map((p, i) => (i ? "L" : "M") + gx(i).toFixed(1) + " " + gy(p.wpm).toFixed(1)).join(" ") : "";
    const errorTicks = series.map((p, i) => p.err ? { x: gx(i).toFixed(1) } : null).filter(Boolean);

    const weak = this.allBigrams().filter(b => b.n >= 2).sort((a, b) => b.ms - a.ms);
    const avg = Math.round(this.allBigrams().reduce((a, b) => a + b.ms, 0) / (this.allBigrams().length || 1));
    const slowest = Math.max(1, ...weak.map(b => b.ms));
    const calibrating = s.history.length < 3;

    const days = {};
    s.history.forEach(h => { const d = new Date(h.ts); const k = d.getMonth() + "/" + d.getDate(); (days[k] = days[k] || []).push(h.wpm); });
    const dayKeys = Object.keys(days);
    const dayVals = dayKeys.map(k => median(days[k]));
    const roll = dayVals.map((_, i) => median(dayVals.slice(Math.max(0, i - 6), i + 1)));
    const pmin = Math.min(...roll) - 4, pmax = Math.max(...roll) + 4;
    const py = (v) => 200 - ((v - pmin) / Math.max(1, pmax - pmin)) * 180;
    const progPath = roll.length > 1 ? roll.map((v, i) => (i ? "L" : "M") + ((i / (roll.length - 1)) * 900).toFixed(1) + " " + py(v).toFixed(1)).join(" ") : "";

    const half = Math.floor(s.history.length / 2);
    const aggHalf = (arr) => {
      const m = {};
      arr.forEach(h => Object.keys(h.bigrams || {}).forEach(k => { const a = m[k] = m[k] || { n: 0, total: 0 }; a.n += h.bigrams[k].n; a.total += h.bigrams[k].total; }));
      return m;
    };
    const A = aggHalf(s.history.slice(0, half)), B = aggHalf(s.history.slice(half));
    const improved = Object.keys(B).filter(k => A[k]).map(k => ({
      pair: k, b: Math.round(A[k].total / A[k].n), a: Math.round(B[k].total / B[k].n)
    })).filter(x => x.a < x.b).sort((x, y) => (y.b - y.a) - (x.b - x.a)).slice(0, 5)
      .map(x => ({ pair: x.pair, before: x.b + "ms", after: x.a + "ms" }));

    const valueSets = { time: [15, 30, 60, 120], words: [10, 25, 50, 100] };
    const valueOptions = valueSets[s.mode].map(v => ({
      label: String(v),
      style: this.chip(s.value === v),
      onClick: () => this.setState({ value: v, timeLeft: s.mode === "time" ? v : 0 }, () => this.gen())
    }));

    const themeOptions = ["light", "dark"].map(t => ({
      label: t, style: this.chip(s.theme === t), onClick: () => this.setState({ theme: t })
    }));

    const wpmDelta = r.med ? (r.wpm >= r.med ? "+" : "") + (r.wpm - Math.round(r.med)) + " vs 7 day median" : "first plotted test";
    const accDelta = r.medAcc ? (r.acc >= r.medAcc ? "+" : "") + (r.acc - Math.round(r.medAcc)) + " vs 7 day median" : "first plotted test";
    const deltaStyle = (up) => ({ fontSize: 13, fontWeight: 500, letterSpacing: "0.02em", color: up ? "var(--accent)" : "var(--muted-strong)" });

    return {
      theme: s.theme,
      isTest: s.screen === "test", isResults: s.screen === "results",
      isProgress: s.screen === "progress", isWeakness: s.screen === "weakness", isSettings: s.screen === "settings",
      goTest: () => { this.setState({ screen: "test" }, () => { this.gen(); this.refocus(); }); },
      goProgress: () => this.setState({ screen: "progress" }),
      goWeakness: () => this.setState({ screen: "weakness" }),
      goSettings: () => this.setState({ screen: "settings" }),
      navTest: this.navBtn(s.screen === "test" || s.screen === "results"),
      navProgress: this.navBtn(s.screen === "progress"),
      navWeakness: this.navBtn(s.screen === "weakness"),
      navSettings: this.navBtn(s.screen === "settings"),

      chromeStyle: {
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
        padding: s.screen === "test" ? "16px 24px" : "16px 24px",
        maxWidth: 1200, width: "100%", margin: "0 auto",
        opacity: active ? 0 : 1, pointerEvents: active ? "none" : "auto",
        transition: "opacity 180ms linear", flexDirection: "row"
      },

      configBarStyle: {
        display: "flex", justifyContent: "center", width: "100%",
        opacity: active ? 0 : 1, pointerEvents: active ? "none" : "auto",
        transition: "opacity 180ms linear"
      },

      counterStyle: {
        position: "absolute", left: 24, top: 8, fontSize: 13, fontWeight: 500, letterSpacing: "0.02em",
        color: "var(--muted-strong)", fontFamily: "'IBM Plex Mono',monospace",
        opacity: s.started && !s.finished ? 1 : 0, transition: "opacity 180ms linear"
      },
      counterText: s.mode === "time" ? s.timeLeft + "s" : Math.max(0, s.words.length - s.wi) + " words",

      testBlockStyle: {
        width: "100%", maxWidth: maxCh + "ch", marginTop: "calc(46vh - " + (lh * 1.5 + 60) + "px)",
        display: "flex", flexDirection: "column", alignItems: "stretch",
        filter: s.paused ? "blur(4px)" : "none", opacity: s.paused ? 0.5 : 1,
        transition: "filter 180ms linear, opacity 180ms linear"
      },
      surfaceWrapStyle: { position: "relative", cursor: "text" },
      surfaceViewportStyle: { position: "relative", height: lh * 3 + 10 + "px", overflow: "hidden" },
      surfaceInnerStyle: {
        position: "relative", fontFamily: "'IBM Plex Mono','Commit Mono',monospace",
        fontSize: fs + "px", fontWeight: 420, lineHeight: lh + "px", letterSpacing: 0,
        display: "flex", flexWrap: "wrap", gap: "0 1ch", whiteSpace: "normal", alignContent: "flex-start",
        transform: "translate3d(0," + (-s.scrollRow * lh) + "px,0)", transition: "transform 120ms cubic-bezier(0.2,0,0,1)"
      },
      caretStyle: {
        position: "absolute", left: 0, top: 0, width: 2, height: fs + 4 + "px",
        background: "var(--accent)", boxShadow: "0 0 6px color-mix(in oklab, var(--accent) 30%, transparent)",
        transform: "translate3d(" + s.caret.left + "px," + (caretTop + (lh - fs - 4) / 2) + "px,0)",
        animation: active || !s.blink ? "none" : "blink 1.1s steps(1) infinite",
        pointerEvents: "none"
      },
      traceTrackStyle: {
        position: "absolute", left: 0, right: 0, height: 1, background: "var(--hairline)",
        top: (traceRow + 1) * lh - 4 + "px", overflow: "hidden"
      },
      traceStyle: {
        height: 1, background: "var(--accent)", transformOrigin: "left",
        transform: "scaleX(" + Math.min(1, s.caret.left / s.lineW) + ")",
        transition: "transform 90ms cubic-bezier(0.2,0,0,1)"
      },
      hintStyle: {
        marginTop: 32, textAlign: "center", fontSize: 13, fontWeight: 500, letterSpacing: "0.02em",
        color: "var(--muted-strong)", opacity: s.started ? 0 : 1, transition: "opacity 180ms linear"
      },
      showPaused: s.paused,
      renderWords, inputRef: this.inputRef, onKeyDown: this.onKeyDown, onBlur: this.onBlur, onFocus: this.onFocus, refocus: this.refocus, noop: this.noop,
      surfaceRef: this.surfaceRef,

      modeTimeStyle: this.chip(s.mode === "time"), modeWordsStyle: this.chip(s.mode === "words"),
      setModeTime: () => this.setState({ mode: "time", value: 30, timeLeft: 30 }, () => this.gen()),
      setModeWords: () => this.setState({ mode: "words", value: 25 }, () => this.gen()),
      valueOptions, valueLabel: s.mode === "time" ? "Duration" : "Word count",
      punctStyle: this.chip(s.punct), numsStyle: this.chip(s.nums),
      togglePunct: () => this.setState({ punct: !s.punct }, () => this.gen()),
      toggleNums: () => this.setState({ nums: !s.nums }, () => this.gen()),
      toggleStop: () => this.setState({ stopOnError: !s.stopOnError }),
      toggleBlink: () => this.setState({ blink: !s.blink }),
      punctSwitchStyle: this.sw(s.punct), numsSwitchStyle: this.sw(s.nums),
      stopSwitchStyle: this.sw(s.stopOnError), blinkSwitchStyle: this.sw(s.blink),
      punctLabel: s.punct ? "on" : "off", numsLabel: s.nums ? "on" : "off",
      stopLabel: s.stopOnError ? "on" : "off", blinkLabel: s.blink ? "on" : "off",
      themeOptions, storageError: s.storageError,

      displayWpm: s.displayWpm, displayAcc: s.displayAcc + "%",
      wpmNumberStyle: {
        fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, fontSize: 56, lineHeight: 1,
        fontVariantNumeric: "tabular-nums", color: r.isPB ? "var(--accent)" : "var(--ink)"
      },
      isPB: !!r.isPB,
      wpmDelta, accDelta,
      wpmDeltaStyle: deltaStyle(r.med ? r.wpm >= r.med : false),
      accDeltaStyle: deltaStyle(r.medAcc ? r.acc >= r.medAcc : false),
      graphPath, errorTicks, medianY: r.med ? gy(r.med).toFixed(1) : "170",
      secondary: [
        { label: "raw wpm", value: r.raw || 0 },
        { label: "consistency", value: (r.consistency || 0) + "%" },
        { label: "characters", value: r.chars || 0 },
        { label: "time", value: Math.round(r.elapsed || 0) + "s" }
      ],
      calibrating: calibrating,
      calibratingCopy: "Calibrating. " + (3 - s.history.length > 1 ? "Two more tests" : "One more test") + " before drills unlock.",
      showWeakCard: !calibrating,
      weakTop: weak.slice(0, 3).map(b => ({ pair: b.pair, body: b.ms + "ms, against your average of " + avg + "ms" })),
      repeatTest: () => this.setState({ screen: "test" }, () => { this.gen(); this.refocus(); }),
      newTest: () => this.setState({ screen: "test" }, () => { this.gen(); this.refocus(); }),

      hasProgress: s.history.length >= 3, progressEmpty: s.history.length < 3,
      progPath, progMedianY: py(median(roll)).toFixed(1),
      progFirstLabel: dayKeys[0] || "", progLastLabel: dayKeys[dayKeys.length - 1] || "",
      improved,

      weaknessEmpty: !weak.length,
      weakCountLabel: weak.length + " pairs",
      weakRows: weak.slice(0, 24).map((b, i) => {
        const low = b.n < 8;
        return {
          pair: b.pair, latency: b.ms + "ms", note: low ? "Needs more data" : b.n + " samples",
          rowStyle: {
            display: "flex", alignItems: "center", gap: 20, padding: "12px 0",
            color: low ? "var(--muted-strong)" : "var(--ink)",
            borderBottom: (i + 1) % 5 === 0 ? "1px solid var(--hairline)" : "none"
          },
          barStyle: {
            display: "block", height: "100%", width: (b.ms / slowest) * 100 + "%",
            background: low ? "var(--muted-strong)" : "var(--accent)", borderRadius: 4
          }
        };
      })
    };
  }
}
</script>
</body>
</html>
