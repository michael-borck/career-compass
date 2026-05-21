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
    // .deb dropped — electron-builder hits a race condition downloading
    // the AppImage runtime when both targets are in the same job. AppImage
    // is more universally compatible anyway.
    target: [
      { target: 'AppImage', arch: ['x64'] },
    ],
    icon: 'assets/icon.png',
    category: 'Office',
    artifactName: 'Career-Compass-${version}-${arch}.${ext}',
  },
};
