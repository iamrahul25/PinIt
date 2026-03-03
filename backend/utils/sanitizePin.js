/**
 * Pin contributor visibility:
 * 1. Author (contributor) requesting → always show contributor details.
 * 2. Other user requesting → show contributor only when pin is public (anonymous === false).
 *    If anonymous === true or field is not present, treat as anonymous and remove data.
 * @param {object} pin - Pin document (mongoose doc or plain object from .lean())
 * @param {string|null|undefined} requestingUserId - Authenticated user ID
 * @returns {object} Plain object with contributor fields removed when appropriate
 */
function sanitizePinForResponse(pin, requestingUserId) {
  if (!pin) return pin;
  const out = pin.toObject ? pin.toObject() : { ...pin };

  const reqId = requestingUserId != null ? String(requestingUserId).trim() : '';
  const contribId = (out.contributor_id != null && out.contributor_id !== '')
    ? String(out.contributor_id).trim()
    : '';
  const isOwner = reqId !== '' && contribId !== '' && reqId === contribId;

  const isAnonymous = out.anonymous !== false; // true if anonymous === true or field not present

  // 1. Author (contributor) requesting → always show contributor details
  if (isOwner) {
    if (isAnonymous) out.reportedByMe = true;
    return out;
  }

  // 2. Other user requesting → show contributor only when pin is public (anonymous === false)
  if (isAnonymous) {
    delete out.contributor_id;
    delete out.contributor_name;
  }
  return out;
}

module.exports = { sanitizePinForResponse };
