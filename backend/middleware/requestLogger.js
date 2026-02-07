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
};

/**
 * Pretty-print JSON with color coding: keys blue, strings green, numbers cyan, booleans/null orange
 */
function colorizeJson(obj) {
  try {
    const raw = JSON.stringify(obj, null, 2);
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
 * @returns {Function} Express middleware
 */
function requestLogger(options = {}) {
  const { includeQuery = true, includeBody = false } = options;

  const pad = (str, n) => String(str).slice(0, n).padEnd(n);

  const termWidth = () => process.stdout.columns || 80;
  const separatorLine = () => '-'.repeat(termWidth());

  const headerLine = `${pad('DATE', 25)} | ${pad('METHOD', 7)} | ${pad('STATUS', 4)} | ${pad('DURATION', 8)} | ${pad('IP', 15)} | URL`;

  let headerPrinted = false;

  return (req, res, next) => {
    const start = Date.now();
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
        console.log(colorizeJson(req.query));
      }

      const hasBody = includeBody && req.body && Object.keys(req.body).length > 0;
      if (hasBody) {
        console.log(`${colors.cyan}Body:${colors.reset}`);
        console.log(colorizeJson(req.body));
      }

      console.log(separatorLine());
    });
    next();
  };
}

module.exports = requestLogger;
