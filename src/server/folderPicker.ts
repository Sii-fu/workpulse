import { spawn } from 'child_process';

// Opens the Windows folder dialog for "Add project from folder". Nothing from the request is put in
// the script: it is a fixed text, handed to PowerShell as an encoded command. The chosen path is
// returned as chosen; the server never lists or reads the folder.

export const PICK_TIMEOUT_MS = 5 * 60_000;
export const PICK_UNAVAILABLE = 'Type the folder path instead.';

// The modern Explorer-style folder dialog (address bar, search, Quick access; you can paste a path), reached through
// the Windows common item dialog (FOS_PICKFOLDERS). Kept as plain C# 5 so Windows PowerShell 5.1 can compile it.
export const FOLDER_DIALOG_CS = `
using System;
using System.Runtime.InteropServices;
public static class WpFolderPicker {
  [ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")] class FileOpenDialogCom {}
  [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItem {
    void BindToHandler(IntPtr pbc, ref Guid bhid, ref Guid riid, out IntPtr ppv);
    void GetParent(out IShellItem ppsi);
    void GetDisplayName(uint sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string name);
    void GetAttributes(uint mask, out uint attrs);
    void Compare(IShellItem psi, uint hint, out int order);
  }
  [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IFileDialog {
    [PreserveSig] int Show(IntPtr parent);
    void SetFileTypes(uint c, IntPtr t);
    void SetFileTypeIndex(uint i);
    void GetFileTypeIndex(out uint i);
    void Advise(IntPtr p, out uint cookie);
    void Unadvise(uint cookie);
    void SetOptions(uint o);
    void GetOptions(out uint o);
    void SetDefaultFolder(IShellItem s);
    void SetFolder(IShellItem s);
    void GetFolder(out IShellItem s);
    void GetCurrentSelection(out IShellItem s);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string n);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string n);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string t);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string t);
    void GetResult(out IShellItem s);
    void AddPlace(IShellItem s, int f);
    void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string e);
    void Close(int hr);
    void SetClientGuid(ref Guid g);
    void ClearClientData();
    void SetFilter(IntPtr f);
  }
  public static IntPtr Prepare(out object dialog) {
    IFileDialog d = (IFileDialog)new FileOpenDialogCom();
    uint o; d.GetOptions(out o);
    d.SetOptions(o | 0x20u | 0x40u | 0x800u);
    d.SetTitle("Choose the project folder");
    d.SetOkButtonLabel("Select folder");
    dialog = d;
    return IntPtr.Zero;
  }
  public static string Pick(IntPtr owner) {
    object o; Prepare(out o);
    IFileDialog d = (IFileDialog)o;
    int hr = d.Show(owner);
    if (hr == unchecked((int)0x800704C7)) return null;
    if (hr != 0) Marshal.ThrowExceptionForHR(hr);
    IShellItem item; d.GetResult(out item);
    string path; item.GetDisplayName(0x80058000u, out path);
    return path;
  }
}
`;

// The dialog gets a hidden, top-most owner window, so it opens in front of the browser instead of behind it.
// If the modern dialog cannot be created, the old tree dialog is used instead.
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
  '$picked = $null',
  '$modern = $false',
  'try {',
  "  Add-Type -TypeDefinition @'",
  FOLDER_DIALOG_CS.trim(),
  "'@",
  '  $modern = $true',
  '} catch { }',
  'if ($modern) {',
  '  $picked = [WpFolderPicker]::Pick($owner.Handle)',
  '} else {',
  '  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
  "  $dialog.Description = 'Choose the project folder'",
  '  $dialog.ShowNewFolderButton = $true',
  '  if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { $picked = $dialog.SelectedPath }',
  '}',
  'if ($picked) { [Console]::Out.Write($picked) }',
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
