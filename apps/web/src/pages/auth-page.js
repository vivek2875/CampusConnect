import { apiClient } from '../lib/api-client.js';
import { campusBrandMarkup } from '../lib/brand.js';
import { createElement, formValue, setFormMessage } from '../lib/dom.js';
import { sessionStore } from '../lib/session-store.js';

const DEFAULT_TENANT_SLUG = localStorage.getItem('cc_tenant_slug') || 'campusconnect-demo';

export function renderAuthPage(mode, navigate) {
  const content = createElement('section', { className: 'auth-layout' });
  content.innerHTML = `
    <aside class="brand-panel" aria-label="CampusConnect">
      ${campusBrandMarkup()}
      <div class="brand-panel__content">
        <p class="eyebrow">One connected campus</p>
        <h1>Everything campus, in one secure place.</h1>
        <p>Buy, report, discover and connect—without losing the thread.</p>
      </div>
      <p class="brand-panel__footer">Built for campus communities.</p>
    </aside>
    <section class="auth-card-wrap">
      <div class="auth-card" data-auth-content></div>
    </section>`;

  const panel = content.querySelector('[data-auth-content]');
  if (mode === 'login') renderLogin(panel, navigate);
  if (mode === 'register') renderRegister(panel, navigate);
  if (mode === 'forgot-password') renderForgotPassword(panel, navigate);
  return content;
}

function renderLogin(panel, navigate) {
  panel.innerHTML = `
    <p class="eyebrow">Welcome back</p><h2>Sign in to CampusConnect</h2>
    <p class="muted">Use the email issued by your institution.</p>
    <form class="stack" novalidate>
      ${tenantField()}
      <label>Email<input name="email" type="email" autocomplete="email" required /></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
      <button class="button button--primary" type="submit">Sign in</button>
      <p class="form-message" hidden></p>
    </form>
    <p class="auth-link"><a href="/forgot-password" data-link>Forgot password?</a></p>
    <p class="auth-link">New here? <a href="/register" data-link>Create an account</a></p>`;

  setTenantDefault(panel);

  bindAuthenticationForm(panel.querySelector('form'), async (form) => {
    const result = await apiClient.login({
      tenantSlug: formValue(form, 'tenantSlug'),
      email: formValue(form, 'email'),
      password: formValue(form, 'password'),
    });
    localStorage.setItem('cc_tenant_slug', formValue(form, 'tenantSlug'));
    sessionStore.set(result);
    navigate('/dashboard');
  });
}

function renderRegister(panel, navigate) {
  panel.innerHTML = `
    <p class="eyebrow">Join your campus</p><h2>Create your account</h2>
    <p class="muted">After creating your account, use Send verification email from your dashboard.</p>
    <form class="stack" novalidate>
      ${tenantField()}
      <div class="field-row"><label>First name<input name="firstName" autocomplete="given-name" required /></label><label>Last name<input name="lastName" autocomplete="family-name" required /></label></div>
      <label>Institution email<input name="email" type="email" autocomplete="email" required /></label>
      <label>Password<input name="password" type="password" autocomplete="new-password" minlength="12" required aria-describedby="password-help" /></label>
      <p id="password-help" class="input-help">At least 12 characters, with upper- and lowercase letters and a number.</p>
      <button class="button button--primary" type="submit">Create account</button>
      <p class="form-message" hidden></p>
    </form>
    <p class="auth-link">Already registered? <a href="/login" data-link>Sign in</a></p>`;

  setTenantDefault(panel);

  bindAuthenticationForm(panel.querySelector('form'), async (form) => {
    validateRegistrationPassword(formValue(form, 'password'));
    const result = await apiClient.register({
      tenantSlug: formValue(form, 'tenantSlug'),
      firstName: formValue(form, 'firstName'),
      lastName: formValue(form, 'lastName'),
      email: formValue(form, 'email'),
      password: formValue(form, 'password'),
    });
    localStorage.setItem('cc_tenant_slug', formValue(form, 'tenantSlug'));
    sessionStore.set(result);
    navigate('/dashboard');
  });
}

function renderForgotPassword(panel, navigate) {
  panel.innerHTML = `
    <p class="eyebrow">Account recovery</p><h2>Reset your password</h2>
    <p class="muted">If the account exists, we’ll email a secure reset link.</p>
    <form class="stack" novalidate>
      ${tenantField()}
      <label>Institution email<input name="email" type="email" autocomplete="email" required /></label>
      <button class="button button--primary" type="submit">Send reset link</button>
      <p class="form-message" hidden></p>
    </form>
    <p class="auth-link"><a href="/login" data-link>Back to sign in</a></p>`;

  setTenantDefault(panel);

  bindAuthenticationForm(panel.querySelector('form'), async (form, message) => {
    await apiClient.requestPasswordReset({ tenantSlug: formValue(form, 'tenantSlug'), email: formValue(form, 'email') });
    setFormMessage(message, 'If the account exists, a reset link is on its way.', 'success');
    form.reset();
  });
}

function tenantField() {
  return '<label>Campus code<input name="tenantSlug" autocomplete="organization" required /></label>';
}

function setTenantDefault(panel) {
  panel.querySelector('[name="tenantSlug"]').value = DEFAULT_TENANT_SLUG;
}

function validateRegistrationPassword(password) {
  const hasRequiredCharacters = password.length >= 12 && password.length <= 128;
  const hasUppercaseLetter = /[A-Z]/.test(password);
  const hasLowercaseLetter = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  if (!hasRequiredCharacters || !hasUppercaseLetter || !hasLowercaseLetter || !hasNumber) {
    throw new Error('Use a password with at least 12 characters, one uppercase letter, one lowercase letter, and one number.');
  }
}

function bindAuthenticationForm(form, submitAction) {
  const submitButton = form.querySelector('button[type="submit"]');
  const message = form.querySelector('.form-message');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submitButton.disabled = true;
    setFormMessage(message, '');
    try {
      await submitAction(form, message);
    } catch (error) {
      setFormMessage(message, error.message || 'Something went wrong. Please try again.');
    } finally {
      submitButton.disabled = false;
    }
  });
}
