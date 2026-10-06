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
