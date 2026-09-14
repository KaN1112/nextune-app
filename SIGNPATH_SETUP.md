# SignPath setup for NexTune

These files prepare `KaN1112/nextune-app` for a SignPath Foundation OSS code-signing application.

## Files to add to the repository

Copy these files to the repository root while preserving paths:

- `LICENSE`
- `SECURITY.md`
- `CODE_SIGNING_POLICY.md`
- `.github/workflows/release.yml`

Also copy the contents of `README_SIGNPATH_SECTION.md` into the public `README.md`.
SignPath Foundation requires the term **Code signing policy** to appear on the
project home page and download/release page.

## GitHub settings to configure

Enable multi-factor authentication for the GitHub account that maintains the
repository.

For vulnerability reports, enable GitHub private vulnerability reporting if
available:

`Settings → Security → Code security and analysis → Private vulnerability reporting`

## Before SignPath approval

The included workflow works without SignPath credentials. It will:

- run JavaScript tests
- run Rust tests
- build the Tauri Windows app
- build the NSIS installer
- upload `nextune-windows-unsigned`

The SignPath steps are skipped until the required SignPath settings exist.

## After SignPath creates the project

Install/authorize the SignPath GitHub App for this repository as instructed by
SignPath.

Create this GitHub Actions secret:

- `SIGNPATH_API_TOKEN`

Create these GitHub Actions repository variables:

- `SIGNPATH_ORGANIZATION_ID`
- `SIGNPATH_PROJECT_SLUG`
- `SIGNPATH_SIGNING_POLICY_SLUG`

Location:

`Settings → Secrets and variables → Actions`

Do not commit the API token to the repository.

## SignPath artifact configuration

Configure the SignPath artifact so that the GitHub Actions ZIP artifact can
contain and sign the two Windows executables at its root:

- `NexTune.exe`
- `NexTune_<version>_x64-setup.exe`

Both files should use NexTune product metadata and the same release version.

SignPath's GitHub integration verifies that the signing input was first stored
as a GitHub Actions artifact and, for OSS projects, that the jobs leading to
the signing request ran on GitHub-hosted runners.

## Download site

When signed releases begin, add a visible **Code signing policy** link or
section to the NexTune download site as well. Publish the signed binaries, not
the unsigned workflow artifact.

Regenerate SHA-256 checksums after signing because the signature changes the
binary bytes.
