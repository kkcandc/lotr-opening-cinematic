import { DURATION, type Card, type Chapter } from './mood';

export type Ui = {
  setVeil: (opacity: number) => void;
  setCard: (card: Card | null, opacity: number) => void;
  setPlayhead: (time: number, chapterId: string, paused: boolean, ended: boolean) => void;
  setMuted: (muted: boolean) => void;
};

export function createUi(
  chapters: Chapter[],
  actions: {
    onSeek: (time: number) => void;
    onChapter: (time: number) => void;
    onReplay: () => void;
    onSkip: () => void;
    onMute: () => void;
  },
): Ui {
  const veil = document.getElementById('veil');
  const cardEl = document.getElementById('card');
  const pausedEl = document.getElementById('paused');
  const chrome = document.getElementById('chrome');
  if (!veil || !cardEl || !pausedEl || !chrome) {
    throw new Error('Film overlay is missing from the page.');
  }

  const nav = document.createElement('nav');
  nav.className = 'chapters';
  nav.setAttribute('aria-label', 'Chapters');
  const buttons = new Map<string, HTMLButtonElement>();
  for (const chapter of chapters) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = chapter.name;
    button.addEventListener('click', () => actions.onChapter(chapter.t));
    nav.append(button);
    buttons.set(chapter.id, button);
  }

  const transport = document.createElement('div');
  transport.className = 'transport';

  const replay = document.createElement('button');
  replay.type = 'button';
  replay.id = 'replay';
  replay.textContent = 'Replay';
  replay.addEventListener('click', actions.onReplay);

  const skip = document.createElement('button');
  skip.type = 'button';
  skip.textContent = 'Skip';
  skip.addEventListener('click', actions.onSkip);

  const mute = document.createElement('button');
  mute.type = 'button';
  mute.textContent = 'Unmute';
  mute.setAttribute('aria-pressed', 'false');
  mute.addEventListener('click', actions.onMute);

  transport.append(replay, skip, mute);

  const scrub = document.createElement('div');
  scrub.className = 'scrub';
  scrub.tabIndex = 0;
  scrub.setAttribute('role', 'slider');
  scrub.setAttribute('aria-label', 'Film time');
  scrub.setAttribute('aria-valuemin', '0');
  scrub.setAttribute('aria-valuemax', String(DURATION));
  const fill = document.createElement('span');
  fill.className = 'scrub-fill';
  scrub.append(fill);

  const seekFrom = (clientX: number) => {
    const rect = scrub.getBoundingClientRect();
    const u = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    actions.onSeek(u * DURATION);
  };
  scrub.addEventListener('pointerdown', (event) => {
    scrub.setPointerCapture(event.pointerId);
    seekFrom(event.clientX);
  });
  scrub.addEventListener('pointermove', (event) => {
    if (event.buttons !== 0) seekFrom(event.clientX);
  });

  chrome.append(nav, transport, scrub);

  let shown: Card | null = null;

  return {
    setVeil(opacity: number) {
      veil.style.opacity = String(opacity);
    },
    setCard(card: Card | null, opacity: number) {
      if (card !== shown) {
        shown = card;
        cardEl.replaceChildren();
        cardEl.classList.remove('center', 'lower');
        if (card) {
          cardEl.classList.add(card.place);
          if (card.kicker) {
            const kicker = document.createElement('p');
            kicker.className = 'kicker';
            kicker.textContent = card.kicker;
            cardEl.append(kicker);
          }
          if (card.title) {
            const title = document.createElement('h1');
            title.textContent = card.title;
            cardEl.append(title);
          }
          if (card.body) {
            const line = document.createElement('p');
            line.className = 'line';
            line.textContent = card.body;
            cardEl.append(line);
          }
        }
      }
      const visible = Boolean(card) && opacity > 0.02;
      cardEl.hidden = !visible;
      cardEl.style.opacity = String(visible ? opacity : 0);
    },
    setPlayhead(time: number, chapterId: string, paused: boolean, ended: boolean) {
      fill.style.transform = `scaleX(${Math.min(1, time / DURATION)})`;
      scrub.setAttribute('aria-valuenow', time.toFixed(1));
      for (const [id, button] of buttons) {
        const on = id === chapterId;
        button.classList.toggle('is-on', on);
        if (on) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      }
      pausedEl.hidden = !paused || ended;
      replay.classList.toggle('is-ready', ended);
    },
    setMuted(muted: boolean) {
      mute.textContent = muted ? 'Unmute' : 'Mute';
      mute.setAttribute('aria-pressed', muted ? 'false' : 'true');
    },
  };
}
