/**
 * Expense Extraction Service — Item 4c
 *
 * Given a Drive file ID for a receipt photo (or PDF / docx / xlsx invoice),
 * spawns a `claude -p` subprocess to read the file via the read_attachment
 * MCP tool and return a structured JSON object the caller can pre-fill an
 * Expense draft form with.
 *
 * Synchronous flow (not a background job): receipts are small, single-image
 * vision calls; ~10-30s typical. Caller waits and renders the result. Heavier
 * background jobs would use the researchRunner pattern.
 *
 * Reuses the same MCP server config as the chat subprocess so read_attachment
 * is available.
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const logger = require('../utils/logger');

const MCP_SERVER_PATH = path.join(__dirname, '..', 'mcp', 'erpToolServer.js');
const MCP_CONFIG_PATH = path.join(os.tmpdir(), 'sovern-erp-extract-mcp-config.json');
try {
  fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify({
    mcpServers: {
      'sovern-erp': {
        command: 'node',
        args: [MCP_SERVER_PATH],
      },
    },
  }));
} catch (err) {
  logger.error('[extract] Failed to write MCP config:', err.message);
}

const TIMEOUT_MS = 60_000; // 60s hard cap — receipts shouldn't need longer

function buildSystemPrompt() {
  return `You are an expense extraction assistant. Given a single attachment (a receipt photo, PDF invoice, or similar), return a strict JSON object describing the expense.

## Hard rules

1. Call \`read_attachment(file_id)\` exactly once with the file_id given in the user prompt. View the image / read the text.
2. Extract the fields below. Use NULL where you cannot read a value with confidence — never guess.
3. Return ONLY the JSON object. No markdown fences, no commentary, no preamble.

## Output schema

\`\`\`
{
  "entryDate":          "YYYY-MM-DD or null (the date on the receipt; not today)",
  "originalCurrency":   "3-letter ISO 4217 (USD, TWD, CNY, THB, VND, etc.) — read from the receipt",
  "originalAmount":     12.34,
  "vendor":             "merchant name as printed on the receipt, or null",
  "suggestedCategory":  "one of: Travel, Hotel, Meal allowance, Flight, Taxi, Visa, Office, Bonus, Salary, Rent, Ticket, Labour cost, Other",
  "suggestedDescription": "a short 1-line description suitable for the Expense.description field",
  "country":            "country where the expense happened, or null (e.g. for currency disambiguation)",
  "confidence":         0.85,
  "notes":              "anything useful that doesn't fit elsewhere — VAT line, tip, service charge, etc., or null"
}
\`\`\`

## Currency disambiguation

If the receipt shows only an amount with no currency symbol, infer from country/language:
- Receipt in Mandarin Traditional or with NT$ → TWD
- Receipt in Simplified Chinese or with ¥ → CNY (assume mainland)
- Receipt in Vietnamese or with ₫ → VND
- Receipt in Thai or with ฿ → THB
- Receipt in English with no symbol → ask: probably USD if North America, otherwise null

## Confidence

- 0.9+ — receipt is clear and all key fields are unambiguous
- 0.7-0.9 — minor uncertainty (slightly blurry, currency inferred from context)
- 0.4-0.7 — significant gaps or ambiguity; reviewer should double-check
- below 0.4 — return what little you have but expect rework

Begin. Return only the JSON object.`;
}

/**
 * Run the extraction subprocess and return parsed fields.
 * @param {string} driveFileId — Drive file ID of the receipt
 * @returns {Promise<{ ok: boolean, fields?: object, error?: string, rawOutput?: string }>}
 */
function extractFromReceipt(driveFileId) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let killedByTimeout = false;

    const systemPrompt = buildSystemPrompt();
    const userPrompt = `Receipt to extract — file_id: "${driveFileId}"\n\nCall read_attachment("${driveFileId}") and return the JSON.`;

    const args = [
      '-p',
      '--system-prompt', systemPrompt,
      '--strict-mcp-config',
      '--mcp-config', MCP_CONFIG_PATH,
      '--permission-mode', 'bypassPermissions',
      '--output-format', 'json',
      '--disallowed-tools', 'Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch',
    ];

    const child = spawn('claude', args, {
      env: { ...process.env, ERP_USER_ID: '' },
    });

    child.stdin.write(userPrompt);
    child.stdin.end();

    const killTimer = setTimeout(() => {
      if (!settled) {
        killedByTimeout = true;
        logger.warn(`[extract] Receipt extraction timed out at ${TIMEOUT_MS}ms — killing`);
        child.kill('SIGTERM');
        setTimeout(() => { try { child.kill('SIGKILL'); } catch (_) {} }, 3000);
      }
    }, TIMEOUT_MS);

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', code => {
      settled = true;
      clearTimeout(killTimer);

      if (code !== 0 && !stdout.trim()) {
        return resolve({
          ok: false,
          error: killedByTimeout ? `Extraction timed out at ${TIMEOUT_MS / 1000}s` : (stderr.slice(0, 500) || 'Subprocess failed'),
        });
      }

      // Pull the result text out of claude's wrapped JSON output.
      let resultText = stdout.trim();
      try {
        const wrapped = JSON.parse(stdout);
        if (wrapped && typeof wrapped.result === 'string') resultText = wrapped.result;
      } catch (_) { /* not the wrapped form, use raw */ }

      // Strip optional markdown fence around the inner JSON.
      const fence = resultText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fence) resultText = fence[1].trim();

      let fields;
      try {
        fields = JSON.parse(resultText);
      } catch (e) {
        return resolve({
          ok: false,
          error: `Could not parse JSON: ${e.message}`,
          rawOutput: resultText.slice(0, 500),
        });
      }

      // Mild validation + normalisation.
      if (typeof fields !== 'object' || fields === null) {
        return resolve({ ok: false, error: 'Parsed value is not an object', rawOutput: resultText.slice(0, 500) });
      }
      if (typeof fields.originalCurrency === 'string') {
        fields.originalCurrency = fields.originalCurrency.toUpperCase().slice(0, 3);
      }
      if (fields.originalAmount != null) {
        const n = Number(fields.originalAmount);
        fields.originalAmount = Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
      }
      if (fields.confidence != null) {
        const c = Number(fields.confidence);
        fields.confidence = Number.isFinite(c) ? Math.max(0, Math.min(1, c)) : null;
      }

      resolve({ ok: true, fields });
    });

    child.on('error', err => {
      settled = true;
      clearTimeout(killTimer);
      logger.error(`[extract] Subprocess error: ${err.message}`);
      resolve({ ok: false, error: err.message });
    });
  });
}

module.exports = { extractFromReceipt };
