const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

class ApiClient {
  #accessToken = null;
  #csrfToken = null;

  setAccessToken(token) {
    this.#accessToken = token;
  }

  clearAccessToken() {
    this.#accessToken = null;
  }

  async initializeCsrf() {
    const payload = await this.#send('/auth/csrf', { method: 'GET', cache: 'no-store' });
    this.#csrfToken = payload.csrfToken;
  }

  async register(data) {
    this.#requireCsrfToken();
    return this.#send('/auth/register', { method: 'POST', data, csrf: true });
  }

  async login(data) {
    this.#requireCsrfToken();
    return this.#send('/auth/login', { method: 'POST', data, csrf: true });
  }

  async refresh() {
    this.#requireCsrfToken();
    return this.#send('/auth/refresh', { method: 'POST', csrf: true });
  }

  async logout() {
    this.#requireCsrfToken();
    return this.#send('/auth/logout', { method: 'POST', csrf: true });
  }

  async getProfile() {
    return this.#send('/auth/me', { method: 'GET', authenticated: true });
  }

  async resendVerification() {
    this.#requireCsrfToken();
    return this.#send('/auth/resend-verification', { method: 'POST', authenticated: true, csrf: true });
  }

  async verifyEmail(token) {
    return this.#send('/auth/verify-email', { method: 'POST', data: { token } });
  }

  async requestPasswordReset(data) {
    return this.#send('/auth/forgot-password', { method: 'POST', data });
  }

  async resetPassword(data) {
    return this.#send('/auth/reset-password', { method: 'POST', data });
  }

  async getMarketplaceListings(filters = {}) {
    const result = await this.#request(`/marketplace/listings${toQueryString(filters)}`, { method: 'GET', authenticated: true });
    return { listings: result.data, nextCursor: result.meta?.nextCursor || null };
  }

  async getMyListings(filters = {}) {
    const result = await this.#request(`/marketplace/listings/mine${toQueryString(filters)}`, { method: 'GET', authenticated: true });
    return { listings: result.data, nextCursor: result.meta?.nextCursor || null };
  }

  async getMarketplaceListing(listingId) {
    return this.#send(`/marketplace/listings/${listingId}`, { method: 'GET', authenticated: true });
  }

  async createMarketplaceListing(data) {
    this.#requireCsrfToken();
    return this.#send('/marketplace/listings', { method: 'POST', data, authenticated: true, csrf: true });
  }

  async updateMarketplaceListing(listingId, data) {
    this.#requireCsrfToken();
    return this.#send(`/marketplace/listings/${listingId}`, { method: 'PATCH', data, authenticated: true, csrf: true });
  }

  async archiveMarketplaceListing(listingId) {
    this.#requireCsrfToken();
    return this.#send(`/marketplace/listings/${listingId}`, { method: 'DELETE', authenticated: true, csrf: true });
  }

  async restoreMarketplaceListing(listingId) {
    this.#requireCsrfToken();
    return this.#send(`/marketplace/listings/${listingId}/restore`, { method: 'POST', authenticated: true, csrf: true });
  }

  async setListingEngagement(listingId, kind, enabled) {
    this.#requireCsrfToken();
    const pluralKind = kind === 'like' ? 'likes' : 'wishlists';
    return this.#send(`/marketplace/listings/${listingId}/${pluralKind}`, {
      method: enabled ? 'POST' : 'DELETE',
      authenticated: true,
      csrf: true,
    });
  }

  async getWishlist(filters = {}) {
    const result = await this.#request(`/marketplace/wishlist${toQueryString(filters)}`, { method: 'GET', authenticated: true });
    return { listings: result.data, nextCursor: result.meta?.nextCursor || null };
  }

  async getMarketplaceRecommendations(limit = 8) {
    return this.#send(`/marketplace/recommendations${toQueryString({ limit })}`, { method: 'GET', authenticated: true });
  }

  async createMarketplaceOffer(listingId, data) {
    this.#requireCsrfToken();
    return this.#send(`/marketplace/listings/${listingId}/offers`, { method: 'POST', data, authenticated: true, csrf: true });
  }

  async getMarketplaceOffers(filters = {}) {
    const result = await this.#request(`/marketplace/offers${toQueryString(filters)}`, { method: 'GET', authenticated: true });
    return { offers: result.data, nextCursor: result.meta?.nextCursor || null };
  }

  async updateMarketplaceOffer(offerId, status) {
    this.#requireCsrfToken();
    return this.#send(`/marketplace/offers/${offerId}`, { method: 'PATCH', data: { status }, authenticated: true, csrf: true });
  }

  async uploadMarketplaceImage(file) {
    return this.#uploadSignedImage('/marketplace/uploads/signature', file);
  }

  async getComplaints(filters = {}) {
    const result = await this.#request(`/complaints${toQueryString(filters)}`, { method: 'GET', authenticated: true });
    return { complaints: result.data, nextCursor: result.meta?.nextCursor || null };
  }

  async createComplaint(data) {
    this.#requireCsrfToken();
    return this.#send('/complaints', { method: 'POST', data, authenticated: true, csrf: true });
  }

  async updateComplaintStatus(complaintId, status) {
    this.#requireCsrfToken();
    return this.#send(`/complaints/${complaintId}/status`, { method: 'PATCH', data: { status }, authenticated: true, csrf: true });
  }

  async uploadComplaintImage(file) {
    return this.#uploadSignedImage('/uploads/signature', file);
  }

  async getLostFoundItems(filters = {}) {
    const result = await this.#request(`/lost-found/items${toQueryString(filters)}`, { method: 'GET', authenticated: true });
    return { items: result.data, nextCursor: result.meta?.nextCursor || null };
  }

  async createLostFoundItem(data) {
    this.#requireCsrfToken();
    return this.#send('/lost-found/items', { method: 'POST', data, authenticated: true, csrf: true });
  }

  async uploadLostFoundImage(file) {
    return this.#uploadSignedImage('/lost-found/uploads/signature', file);
  }

  async claimLostFoundItem(itemId, verificationDetails) {
    this.#requireCsrfToken();
    return this.#send(`/lost-found/items/${itemId}/claims`, {
      method: 'POST',
      data: { verificationDetails },
      authenticated: true,
      csrf: true,
    });
  }

  async getLostFoundClaims(itemId) {
    return this.#send(`/lost-found/items/${itemId}/claims`, { method: 'GET', authenticated: true });
  }

  async reviewLostFoundClaim(claimId, status) {
    this.#requireCsrfToken();
    return this.#send(`/lost-found/claims/${claimId}`, { method: 'PATCH', data: { status }, authenticated: true, csrf: true });
  }

  async getEvents(filters = {}) {
    const result = await this.#request(`/events${toQueryString(filters)}`, { method: 'GET', authenticated: true });
    return { events: result.data, nextCursor: result.meta?.nextCursor || null };
  }

  async registerForEvent(eventId) {
    this.#requireCsrfToken();
    return this.#send(`/events/${eventId}/registrations`, { method: 'POST', authenticated: true, csrf: true });
  }

  async createEvent(data) {
    this.#requireCsrfToken();
    return this.#send('/events', { method: 'POST', data, authenticated: true, csrf: true });
  }

  async checkInEvent(eventId, ticket) {
    this.#requireCsrfToken();
    return this.#send(`/events/${eventId}/check-in`, { method: 'POST', data: { ticket }, authenticated: true, csrf: true });
  }

  async getNotices(filters = {}) {
    const result = await this.#request(`/notices${toQueryString(filters)}`, { method: 'GET', authenticated: true });
    return { notices: result.data, nextCursor: result.meta?.nextCursor || null };
  }

  async createNotice(data) {
    this.#requireCsrfToken();
    return this.#send('/notices', { method: 'POST', data, authenticated: true, csrf: true });
  }

  async getNotifications(filters = {}) {
    const result = await this.#request(`/notifications${toQueryString(filters)}`, { method: 'GET', authenticated: true });
    return { notifications: result.data, nextCursor: result.meta?.nextCursor || null };
  }

  async markNotificationRead(notificationId) {
    this.#requireCsrfToken();
    return this.#send(`/notifications/${notificationId}/read`, { method: 'PATCH', authenticated: true, csrf: true });
  }

  async getPushConfiguration() {
    return this.#send('/notifications/push/config', { method: 'GET', authenticated: true });
  }

  async subscribeToPush(subscription) {
    this.#requireCsrfToken();
    return this.#send('/notifications/push/subscriptions', { method: 'POST', data: subscription, authenticated: true, csrf: true });
  }

  async unsubscribeFromPush(endpoint) {
    this.#requireCsrfToken();
    return this.#send('/notifications/push/subscriptions', { method: 'DELETE', data: { endpoint }, authenticated: true, csrf: true });
  }

  async getConversations(filters = {}) {
    const result = await this.#request(`/conversations${toQueryString(filters)}`, { method: 'GET', authenticated: true });
    return { conversations: result.data, nextCursor: result.meta?.nextCursor || null };
  }

  async searchChatRecipients(query, limit = 10) {
    return this.#send(`/chat/recipients${toQueryString({ query, limit })}`, { method: 'GET', authenticated: true });
  }

  async createConversation(data) {
    this.#requireCsrfToken();
    return this.#send('/conversations', { method: 'POST', data, authenticated: true, csrf: true });
  }

  async getMessages(conversationId, filters = {}) {
    const result = await this.#request(`/conversations/${conversationId}/messages${toQueryString(filters)}`, {
      method: 'GET',
      authenticated: true,
    });
    return { messages: result.data, nextCursor: result.meta?.nextCursor || null };
  }

  async sendMessage(conversationId, data) {
    this.#requireCsrfToken();
    return this.#send(`/conversations/${conversationId}/messages`, { method: 'POST', data, authenticated: true, csrf: true });
  }

  async markConversationRead(conversationId) {
    this.#requireCsrfToken();
    return this.#send(`/conversations/${conversationId}/read`, { method: 'PATCH', authenticated: true, csrf: true });
  }

  async uploadChatImage(file) {
    return this.#uploadSignedImage('/chat/uploads/signature', file);
  }

  async askCampusAssistant(messages) {
    this.#requireCsrfToken();
    return this.#send('/ai/assistant', { method: 'POST', data: { messages }, authenticated: true, csrf: true });
  }

  async estimateMarketplacePrice(data) {
    this.#requireCsrfToken();
    return this.#send('/ai/marketplace/price-estimate', { method: 'POST', data, authenticated: true, csrf: true });
  }

  async getAdminDashboard() {
    return this.#send('/admin/dashboard', { method: 'GET', authenticated: true });
  }

  async getAdminUsers(filters = {}) {
    const result = await this.#request(`/admin/users${toQueryString(filters)}`, { method: 'GET', authenticated: true });
    return { users: result.data, nextCursor: result.meta?.nextCursor || null };
  }

  async #uploadSignedImage(signaturePath, file) {
    this.#requireCsrfToken();
    const signature = await this.#send(signaturePath, { method: 'POST', authenticated: true, csrf: true });
    const payload = new FormData();
    payload.append('file', file);
    payload.append('api_key', signature.apiKey);
    payload.append('timestamp', String(signature.timestamp));
    payload.append('signature', signature.signature);
    payload.append('folder', signature.folder);
    payload.append('overwrite', 'false');
    payload.append('unique_filename', 'true');
    payload.append('allowed_formats', signature.allowedFormats);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`, { method: 'POST', body: payload });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.public_id)
      throw new ApiError(result.error?.message || 'Image upload failed.', response.status, 'IMAGE_UPLOAD_FAILED');
    return result.public_id;
  }

  async #send(path, options) {
    return (await this.#request(path, options)).data;
  }

  async #request(path, options) {
    const headers = new Headers({ Accept: 'application/json' });
    if (options.data) headers.set('Content-Type', 'application/json');
    if (options.authenticated && this.#accessToken) headers.set('Authorization', `Bearer ${this.#accessToken}`);
    if (options.csrf) headers.set('X-CSRF-Token', this.#csrfToken);

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method,
      credentials: 'include',
      headers,
      ...(options.cache ? { cache: options.cache } : {}),
      ...(options.data ? { body: JSON.stringify(options.data) } : {}),
    });

    if (response.status === 204) return { data: null, meta: null };
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ApiError(payload.error?.message || 'Something went wrong. Please try again.', response.status, payload.error?.code);
    }

    return { data: payload.data, meta: payload.meta };
  }

  #requireCsrfToken() {
    if (!this.#csrfToken) throw new Error('Security token is not initialized. Reload the page and try again.');
  }
}

export const apiClient = new ApiClient();

function toQueryString(filters) {
  const parameters = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') parameters.set(key, String(value));
  });
  const query = parameters.toString();
  return query ? `?${query}` : '';
}
