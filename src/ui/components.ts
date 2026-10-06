type AttributeValue = string | number | boolean;

export interface ElementOptions {
  className?: string;
  text?: string;
  attrs?: Record<string, AttributeValue>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  for (const [key, value] of Object.entries(options.attrs ?? {})) {
    if (value === false) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) node.append(child);
  return node;
}

export interface OptionParams {
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  label: string;
  id: string;
  checked: boolean;
}

export function createOption(params: OptionParams): HTMLLabelElement {
  const input = el('input', {
    className: 'option__input',
    attrs: { type: params.type, name: params.name, value: params.value, id: params.id },
  });
  input.checked = params.checked;

  return el('label', { className: 'option', attrs: { for: params.id } }, [
    input,
    el('span', { className: 'option__label', text: params.label }),
  ]);
}

export interface PriorityToggleParams {
  id: string;
  name: string;
  checked: boolean;
  label: string;
  disabled?: boolean;
}

export function createPriorityToggle(params: PriorityToggleParams): HTMLLabelElement {
  const input = el('input', {
    className: 'priority__input',
    attrs: { type: 'checkbox', name: params.name, id: params.id },
  });
  input.checked = params.checked;
  input.disabled = params.disabled ?? false;

  return el('label', { className: 'priority', attrs: { for: params.id } }, [
    input,
    el('span', { text: params.label }),
  ]);
}

export interface ButtonParams {
  label: string;
  variant: 'primary' | 'secondary' | 'ghost';
  type?: 'button' | 'submit';
  action?: string;
}

export function createButton(params: ButtonParams): HTMLButtonElement {
  const attrs: Record<string, AttributeValue> = { type: params.type ?? 'button' };
  if (params.action) attrs['data-action'] = params.action;
  return el('button', {
    className: `button button--${params.variant}`,
    text: params.label,
    attrs,
  });
}
