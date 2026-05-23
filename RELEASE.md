# Release Guide

This document explains how to create releases for Career Compass.

## Automated Releases

The GitHub workflow automatically builds and releases Career Compass for Windows, macOS, and Linux when you create a version tag.

### Creating a Release

From a clean, up-to-date `main`, one command does the whole version dance:

```bash
npm run release
```

This runs `npm run typecheck` and `npm test` first (and stops if either fails —
`release.yml` builds but does not test), then `npm version patch` bumps
`package.json`, commits it, and creates a `vX.Y.Z` tag, and finally
`git push --follow-tags` pushes the commit and the tag. The tag is what
triggers the build below.

For a minor or major bump, run the underlying command directly:

```bash
npm version minor && git push --follow-tags   # 0.4.2 -> 0.5.0
npm version major && git push --follow-tags   # 0.4.2 -> 1.0.0
```

> Under the hood this is the old manual flow — edit `version` in
> `package.json`, commit, `git tag vX.Y.Z`, `git push origin vX.Y.Z` — collapsed
> into one atomic step so the tag and `package.json` version can never drift.

After pushing the tag:

1. **Monitor the workflow**:
   - Go to the [Actions tab](https://github.com/michael-borck/career-compass/actions)
   - Watch the "Build and Release" workflow progress
   - The workflow builds for all three platforms in parallel

5. **Check the release**:
   - Go to [Releases](https://github.com/michael-borck/career-compass/releases)
   - The new release will be created automatically with downloadable binaries

## Release Artifacts

The workflow creates these files:

### Windows
- `Career-Compass-Setup-{version}.exe` - NSIS installer for Windows x64

### macOS
- `Career-Compass-{version}-x64.dmg` - Intel Mac installer
- `Career-Compass-{version}-arm64.dmg` - Apple Silicon installer

### Linux
- `Career-Compass-{version}-x64.AppImage` - Portable Linux application

## Testing a Release

To test the release workflow without creating a public release:

1. Create a test tag:
   ```bash
   git tag v0.1.1-test
   git push origin v0.1.1-test
   ```

2. Monitor the workflow in GitHub Actions

3. Delete the test release and tag when done:
   ```bash
   # Delete remote tag
   git push --delete origin v0.1.1-test
   # Delete local tag
   git tag -d v0.1.1-test
   ```

## Code Signing (Optional)

For production releases, you can add code signing certificates:

### Windows
Add these secrets to your GitHub repository:
- `CSC_LINK` - Base64 encoded .p12 certificate
- `CSC_KEY_PASSWORD` - Certificate password

### macOS
Add these secrets for Apple code signing and notarization:
- `CSC_LINK` - Base64 encoded .p12 certificate
- `CSC_KEY_PASSWORD` - Certificate password
- `APPLE_ID` - Apple ID email
- `APPLE_ID_PASS` - App-specific password

Then uncomment the relevant environment variables in `.github/workflows/release.yml`.

## Troubleshooting

- **Build fails**: Check the Actions logs for specific error messages
- **Assets not uploaded**: Verify the artifact paths match the electron-builder output
- **Missing dependencies**: Ensure all dependencies are in `package.json`, not just `devDependencies`

## Manual Local Testing

Test builds locally before creating releases:

```bash
# Test the build process
npm run build
npm run electron:pack

# Test specific platform builds
npm run electron:dist
```