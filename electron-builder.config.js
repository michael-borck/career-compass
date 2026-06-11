// electron-builder config in JS form so we can read environment variables
// and use a custom afterSign hook for macOS notarization.
//
// IMPORTANT: electron-builder does NOT auto-detect a file named
// `electron-builder.config.js`. The package.json scripts pass it via
// `--config electron-builder.config.js`. Without the flag, this file is
// ignored and electron-builder falls back to whatever is in package.json
// (now empty) plus defaults.

module.exports = {
  appId: 'com.michaelborck.career-compass',
  productName: 'Career Compass',
  directories: {
    output: 'release',
  },
  compression: 'maximum',
  files: [
    'dist/**/*',
    'src/main/**/*',
    'src/shared/**/*',
    'assets/**/*',
    'node_modules/**/*',
    '!node_modules/.cache/**/*',
  ],

  // electron-builder's own notarize wrapper has been buggy across 24.x.
  // We disable it here and run @electron/notarize directly from the
  // afterSign hook (see scripts/notarize.js).
  afterSign: './scripts/notarize.js',

  // Explicit publish target so electron-updater knows where to look for
  // updates at runtime. CI publishes here via --publish=always.
  publish: {
    provider: 'github',
    owner: 'michael-borck',
    repo: 'career-compass',
  },

  mac: {
    category: 'public.app-category.productivity',
    icon: 'assets/icon.png',
    hardenedRuntime: true,
    // Must be `false` (string would also work). True triggers the broken
    // electron-builder wrapper instead of our afterSign hook.
    notarize: false,
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
    ],
    artifactName: 'Career-Compass-${version}-${arch}.${ext}',
  },
  win: {
    target: 'nsis',
    icon: 'assets/icon.png',
    artifactName: 'Career-Compass-Setup-${version}.${ext}',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  linux: {
    // Both targets are declared here, but CI builds them in two separate
    // electron-builder invocations (see release.yml) — building both in one
    // job hits a race downloading the AppImage runtime. The .deb exists so
    // apt installs libsecret-1-0, letting safeStorage use the Secret Service
    // (GNOME Keyring / KWallet) instead of weak basic_text storage.
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] },
    ],
    icon: 'assets/icon.png',
    category: 'Office',
    artifactName: 'Career-Compass-${version}-${arch}.${ext}',
  },
  deb: {
    // electron-builder's default dependency list, restated so adding to it is
    // explicit. libsecret-1-0 is the one that matters for key encryption.
    depends: [
      'libgtk-3-0',
      'libnotify4',
      'libnss3',
      'libxss1',
      'libxtst6',
      'xdg-utils',
      'libatspi2.0-0',
      'libuuid1',
      'libsecret-1-0',
    ],
  },
};
