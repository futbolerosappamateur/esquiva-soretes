/** Ayudas mínimas para armar la interfaz HTML del panel online (sin frameworks). */

type Child = Node | string | number | null | undefined | false;

export interface Props {
  class?: string;
  text?: string;
  attrs?: Record<string, string | boolean | undefined>;
  on?: Partial<Record<keyof HTMLElementEventMap, (e: Event) => void>>;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.text !== undefined) el.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) {
    if (v === false || v === undefined) continue;
    el.setAttribute(k, v === true ? '' : v);
  }
  for (const [ev, fn] of Object.entries(props.on ?? {})) if (fn) el.addEventListener(ev, fn as EventListener);
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'number' ? String(c) : c);
  }
  return el;
}

export function button(label: string, onClick: () => void, variant: 'primary' | 'normal' | 'danger' | 'link' = 'normal', extra = ''): HTMLButtonElement {
  return h('button', { class: `es-btn es-btn-${variant} ${extra}`.trim(), text: label, attrs: { type: 'button' }, on: { click: () => onClick() } });
}

export function field(label: string, input: HTMLElement, hint?: string): HTMLDivElement {
  const id = `es-f-${Math.random().toString(36).slice(2, 8)}`;
  input.id = id;
  return h('div', { class: 'es-field' }, h('label', { text: label, attrs: { for: id } }), input, hint ? h('p', { class: 'es-hint', text: hint }) : null);
}

export function textInput(type: 'email' | 'password' | 'text', opts: { value?: string; autocomplete?: string; maxLength?: number; placeholder?: string } = {}): HTMLInputElement {
  const el = h('input', {
    class: 'es-input',
    attrs: {
      type,
      autocomplete: opts.autocomplete,
      autocapitalize: type === 'text' ? 'characters' : 'none',
      spellcheck: 'false',
      placeholder: opts.placeholder,
    },
  });
  if (opts.maxLength) el.maxLength = opts.maxLength;
  if (opts.value) el.value = opts.value;
  return el;
}

export function checkbox(label: string, checked = false, onChange?: (v: boolean) => void): { row: HTMLLabelElement; input: HTMLInputElement } {
  const input = h('input', { attrs: { type: 'checkbox' } });
  input.checked = checked;
  if (onChange) input.addEventListener('change', () => onChange(input.checked));
  return { row: h('label', { class: 'es-check' }, input, h('span', { text: label })), input };
}

/** Línea de mensaje (error o éxito) que se reutiliza. */
export function messageLine(): { el: HTMLParagraphElement; error: (t: string) => void; ok: (t: string) => void; clear: () => void } {
  const el = h('p', { class: 'es-msg', attrs: { role: 'status', 'aria-live': 'polite' } });
  return {
    el,
    error: (t) => {
      el.className = 'es-msg es-error';
      el.textContent = t;
    },
    ok: (t) => {
      el.className = 'es-msg es-ok';
      el.textContent = t;
    },
    clear: () => {
      el.className = 'es-msg';
      el.textContent = '';
    },
  };
}

/** Desactiva los botones de un formulario mientras espera al servidor. */
export async function busy<T>(root: HTMLElement, task: () => Promise<T>): Promise<T> {
  const controls = Array.from(root.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button, input, select'));
  const prev = controls.map((c) => c.disabled);
  controls.forEach((c) => (c.disabled = true));
  root.classList.add('es-busy');
  try {
    return await task();
  } finally {
    controls.forEach((c, i) => (c.disabled = prev[i]));
    root.classList.remove('es-busy');
  }
}

/** Correo enmascarado para mostrarle al dueño de la cuenta: m***@gmail.com. */
export function maskEmail(email: string | null): string {
  if (!email) return '';
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 1)}***@${domain}`;
}
