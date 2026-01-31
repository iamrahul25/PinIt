/**
 * Reverse geocode: get full address (street, city, country) from lat/lng.
 * Uses OpenStreetMap Nominatim (no API key required).
 * Returns a string like "Street, City, State, Country" or empty string on error.
 */
export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en',
        'User-Agent': 'PinIt-CivicReports/1.0'
      }
    });
    if (!response.ok) return '';
    const data = await response.json();
    if (!data) return '';
    const a = data.address || {};
    const parts = [
      a.road,
      a.suburb || a.neighbourhood || a.village,
      a.city || a.town || a.municipality || a.county,
      a.state,
      a.country
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : (data.display_name || '');
  } catch (e) {
    console.warn('Reverse geocode failed:', e);
    return '';
  }
}
