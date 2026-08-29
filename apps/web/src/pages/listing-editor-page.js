import { apiClient } from '../lib/api-client.js';
import { createElement, setFormMessage } from '../lib/dom.js';
import { createCampusLayout } from './campus-layout.js';

const categoryOptions = [
  ['electronics', 'Electronics'],
  ['books', 'Books'],
  ['furniture', 'Furniture'],
  ['cycles', 'Cycles'],
  ['hostel_essentials', 'Hostel essentials'],
  ['sports', 'Sports'],
  ['fashion', 'Fashion'],
];
const conditionOptions = [
  ['new', 'New'],
  ['like_new', 'Like new'],
  ['good', 'Good'],
  ['fair', 'Fair'],
];

export function renderListingEditorPage(navigate, listingId = null) {
  const { page, content } = createCampusLayout({ active: 'marketplace', navigate });
  content.innerHTML = `
    <section class="editor-header"><div><p class="eyebrow">Campus Marketplace</p><h1>${listingId ? 'Edit listing' : 'Sell an item'}</h1><p class="muted">Clear details help campus buyers decide quickly.</p></div><a class="button button--quiet" href="/marketplace${listingId ? '/mine' : ''}" data-link>Cancel</a></section>
    <form class="listing-editor stack" data-listing-form novalidate>
      <div class="field-row"><label>Title<input name="title" maxlength="120" required /></label><label>Category<select name="category" required></select></label></div>
      <label>Description<textarea name="description" rows="6" maxlength="2000" required></textarea></label>
      <div class="field-row"><label>Condition<select name="condition" required></select></label><label>Price (₹)<input name="price" type="number" min="0" max="1000000" step="1" required /></label></div>
      <div class="price-assistant"><button class="button button--secondary" type="button" data-estimate-price>Estimate a fair price</button><p class="input-help" data-price-estimate>Uses stated item details and condition. You remain in control of the final price.</p></div>
      <label>Photos (optional)<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple /><span class="input-help">Up to 8 JPG, PNG, or WebP images. Each image must be 10 MB or less.</span></label>
      <p class="input-help" data-existing-images hidden></p>
      <button class="button button--primary" type="submit">${listingId ? 'Save changes' : 'Publish listing'}</button>
      <p class="form-message" data-editor-message hidden></p>
    </form>`;

  const form = content.querySelector('[data-listing-form]');
  const category = form.querySelector('[name="category"]');
  const condition = form.querySelector('[name="condition"]');
  const message = form.querySelector('[data-editor-message]');
  const submit = form.querySelector('[type="submit"]');
  const estimate = form.querySelector('[data-estimate-price]');
  const estimateMessage = form.querySelector('[data-price-estimate]');
  let existingImages = [];
  populateOptions(category, categoryOptions);
  populateOptions(condition, conditionOptions);

  if (listingId) {
    void apiClient
      .getMarketplaceListing(listingId)
      .then((listing) => {
        form.elements.title.value = listing.title;
        form.elements.description.value = listing.description;
        form.elements.category.value = listing.category;
        form.elements.condition.value = listing.condition;
        form.elements.price.value = String(listing.price.amountMinor / 100);
        existingImages = listing.images.map((image) => image.publicId);
        if (existingImages.length) {
          const existing = form.querySelector('[data-existing-images]');
          existing.textContent = `${existingImages.length} existing image${existingImages.length === 1 ? '' : 's'} will be kept unless you select new photos.`;
          existing.hidden = false;
        }
      })
      .catch((error) => setFormMessage(message, error.message || 'Unable to load this listing.'));
  }

  estimate.addEventListener('click', async () => {
    if (!form.elements.title.value.trim() || !form.elements.description.value.trim()) {
      setFormMessage(message, 'Add a title and description before requesting an estimate.');
      return;
    }
    estimate.disabled = true;
    try {
      const result = await apiClient.estimateMarketplacePrice({
        title: form.elements.title.value.trim(),
        description: form.elements.description.value.trim(),
        category: form.elements.category.value,
        condition: form.elements.condition.value,
      });
      form.elements.price.value = String(Math.round(result.suggestedAmountMinor / 100));
      estimateMessage.textContent = `Suggested range: ₹${Math.round(result.lowAmountMinor / 100)}–₹${Math.round(result.highAmountMinor / 100)}. ${result.rationale}`;
    } catch (error) {
      setFormMessage(message, error.message || 'Unable to estimate a price right now.');
    } finally {
      estimate.disabled = false;
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const files = [...form.elements.images.files];
    if (files.length > 8 || files.some((file) => file.size > 10 * 1024 * 1024)) {
      setFormMessage(message, 'Choose at most eight images, each no larger than 10 MB.');
      return;
    }
    submit.disabled = true;
    try {
      setFormMessage(message, files.length ? 'Uploading photos securely…' : 'Saving your listing…', 'success');
      const uploadedImages = files.length ? await Promise.all(files.map((file) => apiClient.uploadMarketplaceImage(file))) : null;
      const data = {
        title: form.elements.title.value.trim(),
        description: form.elements.description.value.trim(),
        category: form.elements.category.value,
        condition: form.elements.condition.value,
        price: { amountMinor: Math.round(Number(form.elements.price.value) * 100), currency: 'INR' },
        ...(uploadedImages ? { images: uploadedImages.map((publicId) => ({ publicId })) } : {}),
      };
      if (listingId) {
        await apiClient.updateMarketplaceListing(listingId, data);
        navigate('/marketplace/mine');
      } else {
        await apiClient.createMarketplaceListing({ ...data, images: data.images || existingImages.map((publicId) => ({ publicId })) });
        navigate('/marketplace/mine');
      }
    } catch (error) {
      setFormMessage(message, error.message || 'Unable to save this listing.');
    } finally {
      submit.disabled = false;
    }
  });
  return page;
}

function populateOptions(select, values) {
  values.forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
}
