const COMMUNITY_MARK_SOURCE = '/brand/campus-connect-community-mark.png';

export function campusBrandMarkup({ dashboardHome = false, dark = false } = {}) {
  const href = dashboardHome ? '/dashboard' : '/';
  const className = dark ? 'brand brand--dark' : 'brand';

  return `<a class="${className}" href="${href}" data-link><span class="brand__logo"><img src="${COMMUNITY_MARK_SOURCE}" alt="" /></span><span>CampusConnect</span></a>`;
}
