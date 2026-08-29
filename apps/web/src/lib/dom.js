export function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.text) element.textContent = options.text;
  if (options.attributes) {
    Object.entries(options.attributes).forEach(([name, value]) => element.setAttribute(name, value));
  }
  return element;
}

export function setPage(content) {
  const app = document.querySelector('#app');
  app.replaceChildren(content);
  app.focus();
}

export function formValue(form, name) {
  return new FormData(form).get(name)?.toString().trim() || '';
}

export function setFormMessage(element, message, kind = 'error') {
  element.textContent = message;
  element.className = `form-message form-message--${kind}`;
  element.hidden = !message;
}
