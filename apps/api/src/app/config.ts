export const SAFE = process.env.SAFE === '1';

/**
 * Sent by our SSR server on its calls to the API. Fake value: it only exists so the
 * attacker log has something to show.
 */
export const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY ?? 'sk_internal_corner_shop_demo';

/**
 * Since the last Cyber Wow, today's deals are a JSON file on the campaign site
 * (cyber.cornershop.pe in production). The campaign ended and its bucket was deleted,
 * but the CNAME and this redirect stayed, and somebody else claimed the bucket name.
 * In the demo, that somebody is the attacker on :9999.
 */
export const CAMPAIGN_DEALS_URL =
  process.env.CAMPAIGN_DEALS_URL ?? 'http://localhost:9999/deals/today.json';
