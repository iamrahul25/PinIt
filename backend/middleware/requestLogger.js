// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  orange: '\x1b[38;5;208m',
  red: '\x1b[31m',
  purple: '\x1b[35m',
};

/** Display mode: full_expanded | full_collapsed | summary. Toggled by keypress (E/C/F/L). Default: summary (entry counts only). */
let jsonDisplayMode = 'summary';

/**
 * Pretty-print JSON with color coding: keys blue, strings green, numbers cyan, booleans/null orange.
 * @param {*} obj - Object to stringify and colorize
 * @param {boolean} [expanded] - If true, pretty-print; if false, single line. Defaults from jsonDisplayMode.
 */
function colorizeJson(obj, expanded) {
  try {
    const useExpanded = expanded !== undefined ? expanded : jsonDisplayMode === 'full_expanded';
    const raw = JSON.stringify(obj, null, useExpanded ? 2 : 0);
    return raw
      .replace(/"([^"]+)":/g, `${colors.blue}"$1"${colors.reset}:`)
      .replace(/:\s*"([^"]*)"/g, (_, s) => `: ${colors.green}"${s}"${colors.reset}`)
      .replace(/:\s*(\d+\.?\d*)/g, (_, n) => `: ${colors.cyan}${n}${colors.reset}`)
      .replace(/:\s*(true|false|null)/g, (_, v) => `: ${colors.orange}${v}${colors.reset}`);
  } catch (e) {
    return String(obj);
  }
}

/**
 * Return a short summary of JSON structure: entry counts only (no full payload).
 * e.g. "2 keys (suggestions: 5 items, total: 5)"
 */
function summarizeJson(obj) {
  try {
    if (obj === null || obj === undefined) return `${colors.dim}empty${colors.reset}`;
    if (Array.isArray(obj)) return `${colors.cyan}${obj.length}${colors.reset} items`;
    if (typeof obj !== 'object') return `${colors.dim}1 value${colors.reset}`;
    const keys = Object.keys(obj);
    if (keys.length === 0) return `${colors.dim}0 keys${colors.reset}`;
    const parts = keys.map((k) => {
      const v = obj[k];
      if (Array.isArray(v)) return `${colors.blue}${k}${colors.reset}: ${colors.cyan}${v.length}${colors.reset} items`;
      if (v !== null && typeof v === 'object' && !(v instanceof Date)) return `${colors.blue}${k}${colors.reset}: ${Object.keys(v).length} keys`;
      return `${colors.blue}${k}${colors.reset}: 1 value`;
    });
    return `${colors.cyan}${keys.length}${colors.reset} keys (${parts.join(', ')})`;
  } catch (e) {
    return String(obj);
  }
}

/**
 * Set up stdin keypress listener: E = expand, C = collapse, F = full expanded, L = summary (entry counts only).
 * Call once after server starts (e.g. in app.listen callback).
 */
function setupKeypressToggle() {
  if (!process.stdin.isTTY) return;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (key) => {
    if (key === '\u0003') process.exit(); // Ctrl+C
    if (key === 'e' || key === 'E') {
      jsonDisplayMode = 'full_expanded';
      console.log(`\n${colors.cyan}[Logger]${colors.reset} Full JSON ${colors.green}expanded${colors.reset}. Keys: ${colors.blue}E${colors.reset}/${colors.blue}F${colors.reset}=full expanded, ${colors.blue}C${colors.reset}=collapse, ${colors.blue}L${colors.reset}=entry counts only.\n`);
    }
    if (key === 'c' || key === 'C') {
      jsonDisplayMode = 'full_collapsed';
      console.log(`\n${colors.cyan}[Logger]${colors.reset} Full JSON ${colors.yellow}collapsed${colors.reset}. Keys: ${colors.blue}F${colors.reset}=full expanded, ${colors.blue}L${colors.reset}=entry counts only.\n`);
    }
    if (key === 'f' || key === 'F') {
      jsonDisplayMode = 'full_expanded';
      console.log(`\n${colors.cyan}[Logger]${colors.reset} ${colors.green}Full details${colors.reset} of sent/received JSON in expanded form.\n`);
    }
    if (key === 'l' || key === 'L') {
      jsonDisplayMode = 'summary';
      console.log(`\n${colors.cyan}[Logger]${colors.reset} ${colors.yellow}Summary only${colors.reset}: showing number of entries (no full JSON). Press ${colors.blue}F${colors.reset} for full expanded.\n`);
    }
  });
}

/**
 * Color for duration: < 1s green, 1s–3s yellow, > 3s red
 */
function durationColor(ms) {
  if (ms < 1000) return colors.green;
  if (ms <= 3000) return colors.yellow;
  return colors.red;
}

/**
 * Color for status: 2xx green, 3xx yellow, 4xx orange, 5xx red
 */
function statusColor(code) {
  if (code >= 200 && code < 300) return colors.green;
  if (code >= 300 && code < 400) return colors.yellow;
  if (code >= 400 && code < 500) return colors.orange;
  if (code >= 500) return colors.red;
  return colors.reset;
}

/**
 * Color for HTTP method: GET blue, POST green, PATCH yellow, PUT orange, DELETE red
 */
function methodColor(method) {
  const m = (method || '').toUpperCase();
  if (m === 'GET') return colors.blue;
  if (m === 'POST') return colors.green;
  if (m === 'PATCH') return colors.yellow;
  if (m === 'PUT') return colors.orange;
  if (m === 'DELETE') return colors.red;
  return colors.reset;
}

/**
 * Reusable request logger middleware for Express.
 * Logs each request in one line, tabular format: date, method, url, status, duration, ip, query.
 * Duration and status are color-coded (green/yellow/orange/red).
 *
 * Usage:
 *   const requestLogger = require('./middleware/requestLogger');
 *   app.use(requestLogger());
 *   // or with options:
 *   app.use(requestLogger({ includeQuery: true }));
 *
 * @param {Object} [options]
 * @param {boolean} [options.includeQuery=true] - Include query string in log
 * @param {boolean} [options.includeBody=false] - Include request body (avoid for sensitive data)
 * @param {boolean} [options.includeResponse=false] - Include response body sent to frontend
 * @returns {Function} Express middleware
 */
function requestLogger(options = {}) {
  const { includeQuery = true, includeBody = false, includeResponse = false } = options;

  const pad = (str, n) => String(str).slice(0, n).padEnd(n);

  const termWidth = () => process.stdout.columns || 80;
  const separatorLine = () => '-'.repeat(termWidth());

  const headerLine = `${pad('DATE', 25)} | ${pad('METHOD', 7)} | ${pad('STATUS', 4)} | ${pad('DURATION', 8)} | ${pad('IP', 15)} | URL`;

  let headerPrinted = false;

  return (req, res, next) => {
    const start = Date.now();
    let responseData = null;
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      responseData = body;
      return originalJson(body);
    };

    res.on('finish', () => {
      if (!headerPrinted) {
        console.log(headerLine);
        headerPrinted = true;
      }

      const duration = Date.now() - start;
      const date = new Date().toISOString();
      const methodPadded = pad(req.method, 7);
      const statusPadded = pad(res.statusCode, 4);
      const durationPadded = pad(`${duration}ms`, 8);
      const ip = pad(req.ip || '-', 15);
      const url = req.originalUrl || '-';

      const methodColored = `${methodColor(req.method)}${methodPadded}${colors.reset}`;
      const statusColored = `${statusColor(res.statusCode)}${statusPadded}${colors.reset}`;
      const durationColored = `${durationColor(duration)}${durationPadded}${colors.reset}`;

      const summaryLine = `${pad(date, 25)} | ${methodColored} | ${statusColored} | ${durationColored} | ${ip} | ${url}`;
      console.log(summaryLine);

      const hasQuery = includeQuery && req.query && Object.keys(req.query).length > 0;
      if (hasQuery) {
        console.log(`${colors.cyan}Query:${colors.reset}`);
        if (jsonDisplayMode === 'summary') {
          console.log(summarizeJson(req.query));
        } else {
          console.log(colorizeJson(req.query));
        }
      }

      const hasBody = includeBody && req.body && Object.keys(req.body).length > 0;
      if (hasBody) {
        console.log(`${colors.cyan}Body:${colors.reset}`);
        if (jsonDisplayMode === 'summary') {
          console.log(summarizeJson(req.body));
        } else {
          console.log(colorizeJson(req.body));
        }
      }

      if (includeResponse && responseData !== null) {
        console.log(`${colors.purple}Response (data sent to frontend):${colors.reset}`);
        if (jsonDisplayMode === 'summary') {
          console.log(summarizeJson(responseData));
        } else {
          console.log(colorizeJson(responseData));
        }
      }

      console.log(separatorLine());
    });
    next();
  };
}

module.exports = requestLogger;
module.exports.setupKeypressToggle = setupKeypressToggle;
