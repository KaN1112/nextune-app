# Security Policy

## Supported versions

NexTune is currently in early public release. Security fixes are provided for
the latest published version and the current `main` branch.

| Version | Supported |
| --- | --- |
| 1.0.x | Yes |
| Older versions | No |

## Reporting a vulnerability

Please do not publish exploitable security details in a public GitHub Issue.

If the repository shows **Security → Report a vulnerability**, use that form to
send the report privately. Project maintainers may also use a private GitHub
Security Advisory.

If private vulnerability reporting is not available, open a minimal GitHub
Issue asking for a private contact method. Do not include exploit steps,
credentials, personal data, or other sensitive details in that public issue.

When reporting a vulnerability, please include as much of the following as is
safe to share privately:

- affected NexTune version or commit
- affected Windows version and architecture
- a clear description of the issue
- minimal reproduction steps
- expected and actual behavior
- security impact
- relevant logs with secrets and personal information removed

## Response and disclosure

The maintainer will review reports, reproduce the issue when possible, and
prepare a fix before public disclosure when the report is valid. Release notes
will describe relevant security fixes without exposing users to unnecessary
risk.

## Scope

Security reports are especially useful for issues involving:

- unintended system configuration changes
- unsafe file deletion
- command execution outside NexTune's documented behavior
- privilege or permission boundary problems
- tampering with release artifacts or update/download paths
- unexpected network transmission
- dependency or build-pipeline compromise

NexTune intentionally does not disable Microsoft Defender, Windows Update,
Windows security services, anti-cheat software, or other security controls.
