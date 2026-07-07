param(
  [ValidateSet("Read", "Write", "Delete", "List")]
  [string]$Action = "Write",

  [string]$TargetName = "",

  [string]$UserName = "",

  [string]$Filter = ""
)

$source = @"
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class WinCred {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags;
    public UInt32 Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredRead(string target, UInt32 type, UInt32 reservedFlag, out IntPtr credentialPtr);

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredWrite(ref CREDENTIAL userCredential, UInt32 flags);

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredDelete(string target, UInt32 type, UInt32 flags);

  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredEnumerate(string filter, UInt32 flags, out UInt32 count, out IntPtr credentials);

  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern void CredFree(IntPtr buffer);

  public static string Read(string targetName) {
    IntPtr credentialPtr;
    if (!CredRead(targetName, 1, 0, out credentialPtr)) {
      int error = Marshal.GetLastWin32Error();
      if (error == 1168) return null;
      throw new Win32Exception(error);
    }
    try {
      CREDENTIAL credential = (CREDENTIAL)Marshal.PtrToStructure(credentialPtr, typeof(CREDENTIAL));
      if (credential.CredentialBlobSize == 0) return "";
      byte[] secret = new byte[credential.CredentialBlobSize];
      Marshal.Copy(credential.CredentialBlob, secret, 0, secret.Length);
      return Convert.ToBase64String(secret);
    } finally {
      CredFree(credentialPtr);
    }
  }

  public static void Write(string targetName, string userName, byte[] secret) {
    IntPtr blob = Marshal.AllocHGlobal(secret.Length);
    try {
      Marshal.Copy(secret, 0, blob, secret.Length);
      CREDENTIAL credential = new CREDENTIAL();
      credential.Flags = 0;
      credential.Type = 1;
      credential.TargetName = targetName;
      credential.CredentialBlobSize = (UInt32)secret.Length;
      credential.CredentialBlob = blob;
      credential.Persist = 2;
      credential.UserName = userName;
      if (!CredWrite(ref credential, 0)) {
        throw new Win32Exception(Marshal.GetLastWin32Error());
      }
    } finally {
      Marshal.FreeHGlobal(blob);
    }
  }

  public static bool Delete(string targetName) {
    if (CredDelete(targetName, 1, 0)) return true;
    int error = Marshal.GetLastWin32Error();
    if (error == 1168) return false;
    throw new Win32Exception(error);
  }

  public static string[] List(string filter) {
    UInt32 count;
    IntPtr credentialsPtr;
    if (!CredEnumerate(filter, 0, out count, out credentialsPtr)) {
      int error = Marshal.GetLastWin32Error();
      if (error == 1168) return new string[0];
      throw new Win32Exception(error);
    }
    try {
      List<string> rows = new List<string>();
      for (int i = 0; i < count; i++) {
        IntPtr credentialPtr = Marshal.ReadIntPtr(credentialsPtr, i * IntPtr.Size);
        CREDENTIAL credential = (CREDENTIAL)Marshal.PtrToStructure(credentialPtr, typeof(CREDENTIAL));
        rows.Add(credential.TargetName + "\t" + credential.UserName);
      }
      return rows.ToArray();
    } finally {
      CredFree(credentialsPtr);
    }
  }
}
"@

Add-Type -TypeDefinition $source

if ($Action -eq "Read") {
  if (-not $TargetName) { throw "TargetName is required." }
  $encoded = [WinCred]::Read($TargetName)
  if ($null -eq $encoded) { exit 2 }
  Write-Output $encoded
  exit 0
}

if ($Action -eq "Write") {
  if (-not $TargetName) { throw "TargetName is required." }
  if (-not $UserName) { throw "UserName is required." }
  $encoded = [Console]::In.ReadToEnd().Trim()
  if (-not $encoded) { throw "Credential payload is empty." }
  $bytes = [Convert]::FromBase64String($encoded)
  [WinCred]::Write($TargetName, $UserName, $bytes)
  exit 0
}

if ($Action -eq "Delete") {
  if (-not $TargetName) { throw "TargetName is required." }
  if ([WinCred]::Delete($TargetName)) { exit 0 }
  exit 2
}

if ($Action -eq "List") {
  if (-not $Filter) { throw "Filter is required." }
  $items = @()
  foreach ($row in [WinCred]::List($Filter)) {
    $parts = $row -split "`t", 2
    $items += [PSCustomObject]@{
      targetName = $parts[0]
      userName = if ($parts.Length -gt 1) { $parts[1] } else { "" }
    }
  }
  $items | ConvertTo-Json -Compress
  exit 0
}
