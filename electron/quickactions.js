// Generates macOS Finder Quick Actions (Automator "Run Shell Script" Services)
// that convert selected files via the bundled headless CLI — no GUI launch.
const path = require('path');
const fs = require('fs');
const os = require('os');

function servicesDir() {
  return path.join(os.homedir(), 'Library', 'Services');
}

function infoPlist(name) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSServices</key>
  <array>
    <dict>
      <key>NSMenuItem</key>
      <dict><key>default</key><string>${name}</string></dict>
      <key>NSMessage</key><string>runWorkflowAsService</string>
      <key>NSRequiredContext</key>
      <dict><key>NSApplicationIdentifier</key><string>com.apple.finder</string></dict>
      <key>NSSendFileTypes</key>
      <array><string>public.image</string></array>
    </dict>
  </array>
</dict>
</plist>`;
}

function documentWflow(command) {
  // Minimal Automator Quick Action with a single Run Shell Script action,
  // input passed "as arguments" (inputMethod=1), zsh shell.
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>AMApplicationBuild</key><string>521</string>
  <key>AMApplicationVersion</key><string>2.10</string>
  <key>AMDocumentVersion</key><string>2</string>
  <key>actions</key>
  <array>
    <dict>
      <key>action</key>
      <dict>
        <key>AMAccepts</key>
        <dict>
          <key>Container</key><string>List</string>
          <key>Optional</key><false/>
          <key>Types</key><array><string>com.apple.cocoa.path</string></array>
        </dict>
        <key>AMActionVersion</key><string>2.0.3</string>
        <key>AMProvides</key>
        <dict>
          <key>Container</key><string>List</string>
          <key>Types</key><array><string>com.apple.cocoa.path</string></array>
        </dict>
        <key>ActionBundlePath</key><string>/System/Library/Automator/Run Shell Script.action</string>
        <key>ActionName</key><string>Run Shell Script</string>
        <key>ActionParameters</key>
        <dict>
          <key>COMMAND_STRING</key><string>${esc(command)}</string>
          <key>CheckedForUserDefaultShell</key><true/>
          <key>inputMethod</key><integer>1</integer>
          <key>shell</key><string>/bin/zsh</string>
          <key>source</key><string></string>
        </dict>
        <key>BundleIdentifier</key><string>com.apple.RunShellScript</string>
        <key>CFBundleVersion</key><string>2.0.3</string>
        <key>CanShowSelectedItemsWhenRun</key><false/>
        <key>CanShowWhenRun</key><true/>
        <key>Category</key><array><string>AMCategoryUtilities</string></array>
        <key>Class Name</key><string>RunShellScriptAction</string>
        <key>InputUUID</key><string>00000000-0000-0000-0000-000000000001</string>
        <key>Keywords</key><array><string>Shell</string></array>
        <key>OutputUUID</key><string>00000000-0000-0000-0000-000000000002</string>
        <key>UUID</key><string>00000000-0000-0000-0000-000000000003</string>
        <key>ShowWhenRun</key><false/>
      </dict>
      <key>isViewVisible</key><integer>1</integer>
    </dict>
  </array>
  <key>connectors</key><dict/>
  <key>workflowMetaData</key>
  <dict>
    <key>serviceInputTypeIdentifier</key><string>com.apple.Automator.fileSystemObject.image</string>
    <key>serviceOutputTypeIdentifier</key><string>com.apple.Automator.nothing</string>
    <key>serviceProcessesInput</key><integer>0</integer>
    <key>workflowTypeIdentifier</key><string>com.apple.Automator.servicesMenu</string>
  </dict>
</dict>
</plist>`;
}

// exePath: app's Electron binary; cliPath: path to cli-convert.js (inside asar)
function buildCommand(exePath, cliPath, fmt) {
  return [
    `EXE="${exePath}"`,
    `CLI="${cliPath}"`,
    `for f in "$@"; do`,
    `  ELECTRON_RUN_AS_NODE=1 "$EXE" "$CLI" ${fmt} "$f"`,
    `done`,
  ].join('\n');
}

const ACTIONS = [
  { name: 'Convert to JPG (Convert Everything)', fmt: 'jpg' },
  { name: 'Convert to PNG (Convert Everything)', fmt: 'png' },
  { name: 'Convert to WebP (Convert Everything)', fmt: 'webp' },
];

function install(exePath, cliPath) {
  const dir = servicesDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const installed = [];
  for (const a of ACTIONS) {
    const bundle = path.join(dir, `${a.name}.workflow`);
    const contents = path.join(bundle, 'Contents');
    fs.mkdirSync(contents, { recursive: true });
    fs.writeFileSync(path.join(contents, 'Info.plist'), infoPlist(a.name));
    fs.writeFileSync(path.join(contents, 'document.wflow'), documentWflow(buildCommand(exePath, cliPath, a.fmt)));
    installed.push(a.name);
  }
  return installed;
}

function uninstall() {
  const dir = servicesDir();
  const removed = [];
  for (const a of ACTIONS) {
    const bundle = path.join(dir, `${a.name}.workflow`);
    if (fs.existsSync(bundle)) { fs.rmSync(bundle, { recursive: true, force: true }); removed.push(a.name); }
  }
  return removed;
}

module.exports = { install, uninstall, ACTIONS };
