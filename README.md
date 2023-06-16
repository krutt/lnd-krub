> **Warning**
> This project is in early development, it does however work with real sats! Always use amounts you don't mind losing.

# LNDKrub

Rewritten wrapper for Lightning Network Daemon in TypeScript based on [LNDHub](github.com/BlueWallet/LndHub).
This is a tribute to the amazing work done by [BlueWallet Team](github.com/BlueWallet) with
some creative differences, as followed:

## Creative differences and roadmap

* TypeScript helps the project scale in the long-term.
* Scrap monolithic structure for an easier to track modular one.
* Dependency injection pattern for loose coupling.
* Vite for front-end construction.
* Vitest for API testing and BlueWallet compatibility maintenance.
* Paired with crontab for script-running.

Pending tasks on the roadmap

* [BlueWallet Acceptance Tests](github.com/BlueWallet/LndHub#tests).
* CI/CD: Reject commits which fail BlueWallet Acceptance Tests on `origin/master`.
* Cache solution change: Change [Redis](github.com/redis/redis) solid-state drive caching to [Memcached](memcached.org).
* Create benchmark comparisons to justify `redis` -> `memcached` change.
* Create mock services using `sqlite3` and use them to create integration tests.
* CI/CD: Reject commits which fail integration tests with attached mock services.
* Orchestration: Write `docker-compose.yaml` for [Umbrel App Framework](github.com/getumbrel/umbrel-apps).
* Implement Nostr Wallet Connect [NIP-47](github.com/nostr-protocol/nips/blob/master/47.md) on top of existing authentication.
* Add bounties for above tasks.

**INSTALLATION**

You can install LNDKrub following the same guides to install LNDHub as followed

- [Beginner’s Guide to ️⚡Lightning️⚡ on a Raspberry Pi](github.com/dangeross/guides/blob/master/raspibolt/raspibolt_6B_lndhub.md)
- [Running LNDHub on Mac OSX](medium.com/@jpthor/running-lndhub-on-mac-osx-5be6671b2e0c)

```bash
git clone git@github.com:aekasitt/lnd-krub.git
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
