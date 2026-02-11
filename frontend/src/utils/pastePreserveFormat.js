/**
 * Paste handler that inserts clipboard plain text only, preserving newlines and spaces.
 * Use on description/summary textareas so pasted content (e.g. from Word) keeps format.
 * @param {ClipboardEvent} e - paste event
 * @param {string} currentValue - current field value
 * @param {(value: string) => void} onValueChange - callback with new value
 */
export function handlePastePreserveFormat(e, currentValue, onValueChange) {
  if (!e.clipboardData) return;
  e.preventDefault();
  const pasted = e.clipboardData.getData('text/plain') || '';
  const el = e.target;
  if (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT') return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const newValue =
    (currentValue ?? '').slice(0, start) + pasted + (currentValue ?? '').slice(end);
  onValueChange(newValue);
  const newCursor = start + pasted.length;
  setTimeout(() => {
    el.setSelectionRange(newCursor, newCursor);
    el.focus();
  }, 0);
}
