/**
 * Small map icons for each problem type (Trash, Pothole, Broken Pipe, Fuse Light, Other).
 * Used on the map as markers with a colored squircle background and white icon.
 */

export const PROBLEM_TYPE_COLORS = {
  'Trash Pile': '#7e340a',
  'Pothole': '#f53a2c',
  'Broken Pipe': '#3489ff',
  'Fuse Street Light': '#fdcb6e',
  'Other': '#95a5a6',
};

const iconColor = '#ffffff';
const size = 26;
const borderRadius = 6;

/** SVG icons as strings (white fill, 20x20 viewBox centered in size box) */
// Trash can
const TRASH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${iconColor}" width="16" height="16"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
// Pothole / road hazard (warning triangle)
const POTHOLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${iconColor}" width="16" height="16"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>`;
// Broken pipe / water leak (droplet)
const PIPE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${iconColor}" width="16" height="16"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
// Fuse / street light (lightbulb)
const LIGHT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${iconColor}" width="16" height="16"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>`;
// Other (map pin)
const OTHER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${iconColor}" width="16" height="16"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;

export const PROBLEM_TYPE_ICONS = {
  'Trash Pile': TRASH_SVG,
  'Pothole': POTHOLE_SVG,
  'Broken Pipe': PIPE_SVG,
  'Fuse Street Light': LIGHT_SVG,
  'Other': OTHER_SVG,
};

/**
 * Returns inline HTML for a small map marker icon: squircle with background color + icon.
 * @param {string} problemType - One of Trash Pile, Pothole, Broken Pipe, Fuse Street Light, Other
 * @param {number} [iconSize=26] - Size in px (used for map; use 32+ for panels)
 * @returns {string} HTML string for the marker element
 */
export function getProblemTypeMarkerHtml(problemType, iconSize = size) {
  const color = PROBLEM_TYPE_COLORS[problemType] || PROBLEM_TYPE_COLORS['Other'];
  const icon = PROBLEM_TYPE_ICONS[problemType] || PROBLEM_TYPE_ICONS['Other'];
  const r = borderRadius * (iconSize / size);
  const iconW = Math.round(16 * (iconSize / size));
  const iconSvg = icon.replace(/width="16" height="16"/, `width="${iconW}" height="${iconW}"`);
  return `<div style="
    width: ${iconSize}px;
    height: ${iconSize}px;
    border-radius: ${r}px;
    background-color: ${color};
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  ">${iconSvg}</div>`;
}

export default { PROBLEM_TYPE_COLORS, PROBLEM_TYPE_ICONS, getProblemTypeMarkerHtml };
