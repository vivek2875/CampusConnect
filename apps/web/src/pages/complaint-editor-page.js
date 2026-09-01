import { apiClient } from '../lib/api-client.js';
import { complaintDepartments } from '../lib/complaint-departments.js';
import { setFormMessage } from '../lib/dom.js';
import { createCampusLayout } from './campus-layout.js';

export function renderComplaintEditorPage(navigate) {
  const { page, content } = createCampusLayout({ active: 'complaints', navigate });
  content.innerHTML = `<section class="editor-header"><div><p class="eyebrow">Maintenance support</p><h1>Report an issue</h1><p class="muted">Include the location and impact so the right team can respond quickly.</p></div><a class="button button--quiet" href="/complaints" data-link>Cancel</a></section><form class="listing-editor stack" data-form novalidate><label>Short title<input name="title" maxlength="140" placeholder="e.g. Corridor light not working" required /></label><label>Department<select name="department" required></select></label><label>Describe the issue<textarea name="description" rows="6" maxlength="4000" placeholder="Location, when it started, and how it affects students…" required></textarea></label><label>Photos (optional)<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple /><span class="input-help">Up to 6 JPG, PNG, or WebP images, 10 MB each.</span></label><button class="button button--primary" type="submit">Submit complaint</button><p class="form-message" data-message hidden></p></form>`;
  const form = content.querySelector('[data-form]');
  const select = form.querySelector('[name="department"]');
  const message = form.querySelector('[data-message]');
  const submit = form.querySelector('[type="submit"]');
  complaintDepartments.forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const files = [...form.elements.images.files];
    if (files.length > 6 || files.some((file) => file.size > 10 * 1024 * 1024))
      return setFormMessage(message, 'Choose at most six images, each no larger than 10 MB.');
    submit.disabled = true;
    try {
      setFormMessage(message, files.length ? 'Uploading photos securely…' : 'Analyzing and submitting your report…', 'success');
      const images = await Promise.all(files.map((file) => apiClient.uploadComplaintImage(file)));
      await apiClient.createComplaint({
        title: form.elements.title.value.trim(),
        description: form.elements.description.value.trim(),
        department: form.elements.department.value,
        images: images.map((publicId) => ({ publicId })),
      });
      navigate('/complaints');
    } catch (error) {
      setFormMessage(message, error.message || 'Unable to submit this complaint.');
    } finally {
      submit.disabled = false;
    }
  });
  return page;
}
