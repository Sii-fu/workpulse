import { spawn } from 'child_process';

// Opens the Windows folder dialog for "Add project from folder". Nothing from the request is put in
// the script: it is a fixed text, handed to PowerShell as an encoded command. The chosen path is
// returned as chosen; the server never lists or reads the folder.

export const PICK_TIMEOUT_MS = 5 * 60_000;
export const PICK_UNAVAILABLE = 'Type the folder path instead.';

// The dialog gets a hidden, top-most owner window, so it opens in front of the browser instead of behind it.
export const PICK_FOLDER_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  'Add-Type -AssemblyName System.Windows.Forms',
  '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false',
  '$owner = New-Object System.Windows.Forms.Form',
  '$owner.TopMost = $true',
  '$owner.ShowInTaskbar = $false',
  '$owner.Opacity = 0',
  '$owner.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None',
  '$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen',
  '$owner.Show()',
  '$owner.Activate()',
  '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
  "$dialog.Description = 'Choose the project folder'",
  '$dialog.ShowNewFolderButton = $true',
  'if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }',
  '$owner.Close()',
].join('\n');

export const pickFolderArgs = (): string[] => [
  '-NoProfile',
  '-NonInteractive',
  '-STA',
  '-EncodedCommand',
  Buffer.from(PICK_FOLDER_SCRIPT, 'utf16le').toString('base64'),
];

/** Origin is absent for non-browser callers; when present it must be exactly this server's local address. */
export function isAllowedPickOrigin(origin: string | undefined, port: number): boolean {
  if (!origin) return true;
  return origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
}

export interface PickResult {
  status: number;
  body: { path: string } | { cancelled: true } | { error: string };
}

export interface FolderPickCall {
  result: Promise<PickResult>;
  /** Stops the dialog (the browser went away). Does nothing once the call has finished. */
  cancel(): void;
}

export interface FolderPicker {
  pick(): FolderPickCall;
}

export function createFolderPicker(opts: {
  platform?: NodeJS.Platform;
  spawnFn?: typeof spawn;
  timeoutMs?: number;
} = {}): FolderPicker {
  const platform = opts.platform ?? process.platform;
  const spawnFn = opts.spawnFn ?? spawn;
  const timeoutMs = opts.timeoutMs ?? PICK_TIMEOUT_MS;
  let busy = false;

  const instant = (r: PickResult): FolderPickCall => ({ result: Promise.resolve(r), cancel: () => {} });

  return {
    pick(): FolderPickCall {
      if (platform !== 'win32') return instant({ status: 501, body: { error: PICK_UNAVAILABLE } });
      if (busy) {
        return instant({ status: 409, body: { error: 'A folder window is already open. Choose the folder there.' } });
      }
      busy = true;

      let child: ReturnType<typeof spawn> | undefined;
      let settle: (r: PickResult) => void = () => {};
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = new Promise<PickResult>((resolve) => {
        settle = (r) => {
          if (settled) return;
          settled = true;
          busy = false;
          if (timer) clearTimeout(timer);
          resolve(r);
        };
      });
      const kill = () => {
        try {
          child?.kill();
        } catch {
          // already gone
        }
      };
      const failed = (): PickResult => ({ status: 500, body: { error: `Could not open the folder window. ${PICK_UNAVAILABLE}` } });

      try {
        child = spawnFn('powershell.exe', pickFolderArgs(), {
          shell: false,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'ignore'],
        });
      } catch {
        settle(failed());
        return { result, cancel: () => {} };
      }

      let out = '';
      // Decode as UTF-8 across chunks so a Bangla or CJK path is never split in the middle of a character.
      child.stdout?.setEncoding?.('utf8');
      child.stdout?.on('data', (chunk: Buffer | string) => {
        out += chunk.toString();
      });
      child.on('error', () => settle(failed()));
      child.on('close', (code: number | null) => {
        if (code !== 0 && code !== null) return settle(failed());
        const path = out.replace(/^﻿/, '').trim();
        settle(path ? { status: 200, body: { path } } : { status: 200, body: { cancelled: true } });
      });
      timer = setTimeout(() => {
        settle({ status: 504, body: { error: `The folder window took too long. ${PICK_UNAVAILABLE}` } });
        kill();
      }, timeoutMs);

      return {
        result,
        cancel: () => {
          if (settled) return;
          settle({ status: 499, body: { cancelled: true } });
          kill();
        },
      };
    },
  };
}
