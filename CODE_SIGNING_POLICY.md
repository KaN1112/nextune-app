# Code signing policy

Free code signing provided by [SignPath.io](https://signpath.io/), certificate
by [SignPath Foundation](https://signpath.org/).

This policy applies to official Windows release artifacts of **NexTune** built
from the public source repository:

- Source: https://github.com/KaN1112/nextune-app
- Download site: https://github.com/KaN1112/nextune

## Project roles

NexTune is currently maintained by a single project maintainer.

- **Authors / Committers:** [KaN1112](https://github.com/KaN1112)
- **Reviewers:** [KaN1112](https://github.com/KaN1112)
- **Approvers:** [KaN1112](https://github.com/KaN1112)

Changes submitted by contributors who are not committers must be reviewed by a
maintainer before merge. Every production signing request must be manually
approved by an Approver.

## Privacy policy

**This program will not transfer any information to other networked systems
unless specifically requested by the user or the person installing or
operating it.**

NexTune does not include telemetry, advertising, user accounts, external
fonts, or CDN-hosted runtime resources.

Network diagnostics are started explicitly by the user. When requested,
NexTune may send ping requests to Cloudflare, Google, or an IP address entered
by the user in order to measure latency, jitter, and packet loss.

NexTune stores its settings and history locally on the user's PC.

## System changes

NexTune must clearly present system-changing actions before they are executed.

Examples include:

- changing to an already-existing Windows high-performance power plan
- requesting normal closure of a user-selected application
- deleting files from the documented conservative cleaner categories
- restoring a previously recorded power-plan change

NexTune does not silently disable or modify Microsoft Defender, Windows
Update, Windows security services, BCD settings, HPET, timer resolution, TCP
settings, DNS settings, drivers, anti-cheat software, or other Windows security
controls.

## Build provenance

Official signed artifacts must be produced from this repository by an
automated GitHub Actions workflow running on GitHub-hosted Windows runners.

The release workflow:

1. checks out the repository source;
2. installs the declared Node.js and Rust build dependencies;
3. runs the JavaScript and Rust tests;
4. builds the Tauri Windows application and NSIS installer;
5. uploads the unsigned binaries as a GitHub Actions artifact;
6. submits that GitHub-hosted artifact to SignPath;
7. requires the configured SignPath approval policy before release signing;
8. stores the resulting signed binaries as a separate workflow artifact.

Locally built binaries are not eligible to be presented as official
SignPath-signed NexTune releases.

## Signed artifacts

The intended official Windows artifacts are:

- `NexTune.exe`
- `NexTune_<version>_x64-setup.exe`

The product name must be **NexTune** and the product version must match the
release version declared by the project for that build.

## Release procedure

A release intended for signing should be created from reviewed source in the
public repository. The version must be updated consistently before the build.

The signing request is created only from the GitHub Actions artifact produced
by the release workflow. The Approver reviews the source revision, build
status, version, and intended artifacts before approving the request.

After signing, the signed files may be published through the NexTune download
site or GitHub Releases. Checksums should be regenerated from the final signed
artifacts.

## Key handling

The code-signing private key is not stored in the NexTune repository or GitHub
Actions secrets. It is managed by SignPath / SignPath Foundation according to
their signing infrastructure and policy.

The GitHub secret used to authenticate SignPath requests must only grant the
permissions required for the signing integration and must never be committed
to the repository.

## Compromise or policy violation

If a release artifact, build workflow, maintainer account, or signing
integration is suspected to be compromised:

1. stop publishing affected artifacts;
2. disable or rotate affected credentials;
3. investigate the source revision and build provenance;
4. contact SignPath when signed artifacts or signing credentials may be
   affected;
5. publish corrected artifacts and security information when appropriate.

Signed binaries must never be used to distribute software that is not built
from the NexTune source repository covered by this policy.
