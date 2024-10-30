; FreeWallet-Classic.iss
;
; Config file for creating a windows installer file for tbe
;


[Setup]
AppName=FreeWallet Classic
AppVersion=0.9.38
DefaultDirName={pf}\FreeWallet Classic
DefaultGroupName=FreeWallet
UninstallDisplayIcon={app}\FreeWallet-Classic.exe
Compression=lzma2
SolidCompression=yes
OutputDir=C:\Users\J-Dog\Desktop\
OutputBaseFilename=FreeWallet Classic

; "ArchitecturesInstallIn64BitMode=x64" requests that the install be
; done in "64-bit mode" on x64, meaning it should use the native
; 64-bit Program Files directory and the 64-bit view of the registry.
; On all other architectures it will install in "32-bit mode".
ArchitecturesInstallIn64BitMode=x64

[Registry]
; Add support for bitcoin: urls
Root: HKCR; Subkey: "bitcoin"; ValueType: "string"; ValueData: "URL:bitcoin Protocol"; Flags: uninsdeletekey
Root: HKCR; Subkey: "bitcoin"; ValueType: "string"; ValueName: "URL Protocol"; ValueData: ""
Root: HKCR; Subkey: "bitcoin\DefaultIcon"; ValueType: "string"; ValueData: "{app}\FreeWallet.exe,0"
Root: HKCR; Subkey: "bitcoin\shell\open\command"; ValueType: "string"; ValueData: """{app}\FreeWallet.exe"" ""%1"""
; Add support for counterparty: urls
Root: HKCR; Subkey: "counterparty"; ValueType: "string"; ValueData: "URL:counterparty Protocol"; Flags: uninsdeletekey
Root: HKCR; Subkey: "counterparty"; ValueType: "string"; ValueName: "URL Protocol"; ValueData: ""
Root: HKCR; Subkey: "counterparty\DefaultIcon"; ValueType: "string"; ValueData: "{app}\FreeWallet.exe,0"
Root: HKCR; Subkey: "counterparty\shell\open\command"; ValueType: "string"; ValueData: """{app}\FreeWallet.exe"" ""%1"""
; Add support for freewallet: urls
Root: HKCR; Subkey: "freewallet"; ValueType: "string"; ValueData: "URL:freewallet Protocol"; Flags: uninsdeletekey
Root: HKCR; Subkey: "freewallet"; ValueType: "string"; ValueName: "URL Protocol"; ValueData: ""
Root: HKCR; Subkey: "freewallet\DefaultIcon"; ValueType: "string"; ValueData: "{app}\FreeWallet.exe,0"
Root: HKCR; Subkey: "freewallet\shell\open\command"; ValueType: "string"; ValueData: """{app}\FreeWallet.exe"" ""%1"""

; Override some default messages
[Messages]
WelcomeLabel1=Welcome to [name] Setup Wizard
WelcomeLabel2=This will install [name] on your computer.%n%nIt is recommended that you close all other applications before continuing.

; Include all the files necessary for the tbe build
[Files]
Source: "C:\Users\J-Dog\Desktop\FreeWallet\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs

; Setup icon group and icon on desktop
[Icons]
Name: "{group}\FreeWallet Classic";          Filename: "{app}\FreeWallet-Classic.exe"
Name: "{commondesktop}\FreeWallet Classic";  Filename: "{app}\FreeWallet-Classic.exe"