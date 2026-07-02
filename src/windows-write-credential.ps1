param(
  [Parameter(Mandatory=$true)]
  [string]$TargetName,

  [Parameter(Mandatory=$true)]
  [string]$UserName
)

$encoded = [Console]::In.ReadToEnd().Trim()
if (-not $encoded) {
  throw "Credential payload is empty."
}

$source = @"
using System;
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
  public static extern bool CredWrite(ref CREDENTIAL userCredential, UInt32 flags);

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
}
"@

Add-Type -TypeDefinition $source
$bytes = [Convert]::FromBase64String($encoded)
[WinCred]::Write($TargetName, $UserName, $bytes)
