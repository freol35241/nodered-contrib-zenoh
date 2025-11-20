# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2025-11-20

### Added
- GitHub Actions release workflow for automated npm publishing
- Example flows demonstrating usage
- Docker Compose example for Zenoh connectivity

## [0.1.0] - 2025-11-20

### Added
- Initial release
- Zenoh Session configuration node
- Zenoh Subscribe node for receiving data
- Zenoh Put node for publishing data
- Zenoh Query node for requesting data
- Zenoh Queryable node for responding to queries
- Support for wildcard key expressions
- Raw Buffer-based payload handling
- Comprehensive unit and integration tests

### Requirements
- Node.js 16.x or higher
- WebAssembly module support (--experimental-wasm-modules)
- Zenoh router with remote-api WebSocket plugin

[Unreleased]: https://github.com/freol35241/nodered-contrib-zenoh/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/freol35241/nodered-contrib-zenoh/releases/tag/v0.1.0
