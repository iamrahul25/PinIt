/**
 * Strip contributor_id and contributor_name from a pin when the requester
 * is not the pin's contributor (privacy: don't expose who reported).
 * When the requester is the contributor, return the pin unchanged so the
 * frontend can show "you reported this", edit/delete, and "My pins" filter.
 * @param {object} pin - Pin document (mongoose doc or plain object from .lean())
 * @param {string|null|undefined} requestingUserId - Authenticated user ID
 * @returns {object} Plain object with contributor fields removed if not owner
 */
function sanitizePinForResponse(pin, requestingUserId) {
  if (!pin) return pin;
  const out = pin.toObject ? pin.toObject() : { ...pin };
  if (requestingUserId && String(out.contributor_id) === String(requestingUserId)) {
    return out;
  }
  delete out.contributor_id;
  delete out.contributor_name;
  return out;
}

module.exports = { sanitizePinForResponse };
