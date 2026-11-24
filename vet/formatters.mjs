const FINDING_RE = /^\[([A-Z0-9_]+)\]\s+([^:\s]+)(?::(\d+))?:\s*(.*)$/;

export function parseFinding(raw, severity) {
  const match = FINDING_RE.exec(raw);
  if (!match) {
    return { ruleId: 'UNKNOWN', file: '', line: null, severity, message: raw, raw };
  }
  return {
    ruleId: match[1],
    file: match[2],
    line: match[3] ? Number(match[3]) : null,
    severity,
    message: match[4],
    raw,
  };
}

export function formatOutput({ format, checkedCount, modeLabel, errors, warnings, strictMode }) {
  const failures = strictMode ? [...errors, ...warnings] : errors;
  const remainingWarnings = strictMode ? [] : warnings;
  const ok = failures.length === 0;

  if (format === 'json') {
    const payload = {
      ok,
      checkedFiles: checkedCount,
      errors: failures.map((e) => parseFinding(e, 'error')),
      warnings: remainingWarnings.map((w) => parseFinding(w, 'warning')),
    };
    return { ok, stdout: `${JSON.stringify(payload, null, 2)}\n`, stderr: '' };
  }

  if (format === 'github') {
    const lines = [];
    for (const w of remainingWarnings) {
      const f = parseFinding(w, 'warning');
      const loc = f.file ? ` file=${f.file}${f.line ? `,line=${f.line}` : ''}` : '';
      lines.push(`::warning${loc}::[${f.ruleId}] ${f.message}`);
    }
    for (const e of failures) {
      const f = parseFinding(e, 'error');
      const loc = f.file ? ` file=${f.file}${f.line ? `,line=${f.line}` : ''}` : '';
      lines.push(`::error${loc}::[${f.ruleId}] ${f.message}`);
    }
    const summary = ok
      ? `vet compliance check passed (${checkedCount} ${modeLabel}files checked).`
      : `vet compliance check failed (${failures.length} error(s)).`;
    return { ok, stdout: `${[...lines, summary].join('\n')}\n`, stderr: '' };
  }

  const outLines = [];
  const errLines = [];
  if (remainingWarnings.length > 0) {
    errLines.push(`vet warnings (${remainingWarnings.length}):\n${remainingWarnings.join('\n')}`);
  }
  if (!ok) {
    errLines.push(`vet compliance check failed (${failures.length}):\n${failures.join('\n')}`);
  } else {
    outLines.push(`vet compliance check passed (${checkedCount} ${modeLabel}files checked).`);
  }
  return {
    ok,
    stdout: outLines.length ? `${outLines.join('\n')}\n` : '',
    stderr: errLines.length ? `${errLines.join('\n')}\n` : '',
  };
}
