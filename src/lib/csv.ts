/**
 * CSV utilities for SphereShare — parse wallet lists and export payment reports.
 */

export interface CSVRow {
  wallet: string;
  amount?: string;
}

/**
 * Parse CSV input. Supports two formats:
 * - Equal mode: one wallet per line (or "wallet" column)
 * - Custom mode: "wallet,amount" per line
 */
export function parseCSV(input: string, hasAmounts: boolean): CSVRow[] {
  const lines = input
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.toLowerCase().startsWith('wallet'));

  const rows: CSVRow[] = [];

  for (const line of lines) {
    const parts = line.split(',').map((p) => p.trim());
    if (!parts[0]) continue;

    if (hasAmounts && parts.length >= 2) {
      rows.push({ wallet: parts[0], amount: parts[1] });
    } else {
      rows.push({ wallet: parts[0], amount: parts[1] });
    }
  }

  return rows;
}

export interface ExportRow {
  wallet: string;
  amount: string;
  token: string;
  txn_hash: string;
  status: string;
  timestamp: string;
}

/**
 * Generate a CSV string from payment export data.
 */
export function generateExportCSV(rows: ExportRow[], _splitTitle?: string): string {
  const header = 'wallet,amount,token,txn_hash,status,timestamp';
  const lines = rows.map(
    (r) =>
      `"${r.wallet}","${r.amount}","${r.token}","${r.txn_hash}","${r.status}","${r.timestamp}"`
  );
  return [header, ...lines].join('\n');
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
