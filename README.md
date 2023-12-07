# LNDKrub

[![Bitcoin-only](https://img.shields.io/badge/bitcoin-only-FF9900?logo=bitcoin)](https://twentyone.world)
[![Lightning](https://img.shields.io/badge/lightning-792EE5?logo=lightning)](https://mempool.space/lightning)
[![Fork](https://img.shields.io/badge/fork-BlueWallet/LndHub-beige?logo=github)](https://github.com/BlueWallet/LndHub)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Top](https://img.shields.io/github/languages/top/krutt/lnd-krub)](.)
[![Languages](https://img.shields.io/github/languages/count/krutt/lnd-krub)](.)
[![Size](https://img.shields.io/github/repo-size/krutt/lnd-krub)](.)
[![Last commit](https://img.shields.io/github/last-commit/krutt/lnd-krub/master)](.)

![LNDKrub Banner](./public/lndkrub-banner.svg 'LNDKrub Banner')

> 🚧 **Warning**
> This project is in early development, it does however work with real sats! Always use amounts you don't mind losing.

Rewritten wrapper for Lightning Network Daemon in TypeScript based on [LNDHub](https://github.com/BlueWallet/LndHub).
This is a tribute to the amazing work done by [BlueWallet Team](https://github.com/BlueWallet) with
some creative differences, as followed:

## Creative differences and roadmap

- TypeScript helps the project scale in the long-term.
- Scrap monolithic structure for an easier to track modular one.
- Dependency injection pattern for loose coupling.
- Vite for front-end construction.
- Vitest for API testing and BlueWallet compatibility maintenance.
- Killed Object-Oriented Programming with fire when it came to ORM-like operations. 🔥

> 👷‍♂️ **Pending tasks on the roadmap**

- Pair with crontab for script-running.
- [BlueWallet Acceptance Tests](https://github.com/BlueWallet/LndHub#tests).
- CI/CD: Reject commits which fail BlueWallet Acceptance Tests on `origin/master`.
- Cache solution change: Change [Redis](https://github.com/redis/redis) solid-state drive caching to [Memcached](memcached.org).
- Create benchmark comparisons to justify `redis` -> `memcached` change.
- Create mock services using `sqlite3` and use them to create integration tests.
- CI/CD: Reject commits which fail integration tests with attached mock services.
- Orchestration: Write `docker-compose.yaml` for [Umbrel App Framework](https://github.com/getumbrel/umbrel-apps).
- Implement Nostr Wallet Connect [NIP-47](https://github.com/nostr-protocol/nips/blob/master/47.md) on top of existing authentication.
- Add bounties for above tasks.

**INSTALLATION**

You can install LNDKrub following the same guides to install LNDHub as followed

- [Beginner’s Guide to ️⚡Lightning️⚡ on a Raspberry Pi](https://github.com/dangeross/guides/blob/master/raspibolt/raspibolt_6B_lndhub.md)
- [Running LNDHub on Mac OSX](https://medium.com/@jpthor/running-lndhub-on-mac-osx-5be6671b2e0c)

```bash
git clone git@github.com:krutt/lnd-krub.git
cd lnd-krub
yarn
```

### Deploy to Heroku

Under renovation.

### Run in docker

Under renovation.

### Reference client implementation

Under renovation.

### Contributions

Under renovation.

### Tests

Under renovation.

### Responsible disclosure

Found critical bugs/vulnerabilities? Please email them to aekasitt.g+github@siamintech.co.th Thanks!

## License

This project is licensed under the terms of the MIT license.
