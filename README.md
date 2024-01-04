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

### Reference client implementation

Under renovation.

## Contributions

### Aesir

[Aesir](https://github.com/krutt/aesir) is the preferred option for setting up local Lightning
environment used in tests and experiments for this project. You must have [Docker Daemon](https://docs.docker.com/get-docker/)
as well as [Python 3.8+](https://www.python.org/downloads/) installed in your local enviroment to
make use of `aesir` command. The following command helps you deploy a local cluster where you can
interact with one `bitcoind` node active as well as two Lightning Node Daemons (LNDs) named `ping`
and `pong` with inbound and outbound liquidity channels to one another.

```sh
$ aesir deploy --with-postgres --with-redis
> Deploy duo cluster:                        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% 0:00:01
> Generate addresses:                        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% 0:00:00
> Mine initial capital for parties:          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% 0:00:00
$ aesir ping-pong
> Fetch LND nodekeys:                        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% 0:00:00
> Open channels:                             ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 100% 0:00:00
> <Channel 'aesir-ping --> aesir-pong' : txid='aa8d740e604746d946200fda22665a8d6a0766641895f9599da5264dceb0ea64'>
> <Channel 'aesir-pong --> aesir-ping' : txid='a36b213f47fdfe851bf06a5b1cfd34afb43c18330f26bc9a064810f512bb6876'>
```

### Tests

After having local test environment setup using [Aesir](https://github.com/krutt/aesir), please copy
certificate files and macaroon files from local containers to your root folder with the following
commands.

```sh
$ docker cp aesir-ping:/home/lnd/.lnd/tls.cert tls.cert
> Successfully copied 2.56kB to /Users/mackasitt/workspaces/lnd-krub/tls.cert
$ docker cp aesir-ping:/home/lnd/.lnd/data/chain/bitcoin/regtest/admin.macaroon admin.macaroon
> Successfully copied 2.05kB to /Users/mackasitt/workspaces/lnd-krub/admin.macaroon
$ docker cp aesir-pong:/home/lnd/.lnd/tls.cert target-tls.cert
> Successfully copied 2.56kB to /Users/mackasitt/workspaces/lnd-krub/target-tls.cert
$ docker cp aesir-pong:/home/lnd/.lnd/data/chain/bitcoin/regtest/admin.macaroon target-admin.macaroon
> Successfully copied 2.05kB to /Users/mackasitt/workspaces/lnd-krub/target-admin.macaroon
```

Now you will have all the necessary authentications on your file system ready to run tests, but
wait ! The database deployed by `aesir` command still does not have the required database `krubdb`
to keep track of accounts. You must create our very own `PrismaClient` first and migrate the latest
database schema to the `postgres` container with the following commands.

````sh
$ yarn prisma:generate # OR pnpm run prisma:generate
> ✔ Generated Prisma Client (5.0.0 | library) to ./node_modules/@prisma/client in 101ms
> You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
> ```
> import { PrismaClient } from '@prisma/client'
> const prisma = new PrismaClient()
> ```
> ✨  Done in 0.89s.
$ yarn prisma:migrate # OR pnpm run prisma:migrate
> Environment variables loaded from .env
> Prisma schema loaded from prisma/schema.prisma
> Datasource "db": PostgreSQL database "krubdb", schema "public" at "localhost:5432"
>
> PostgreSQL database krubdb created at localhost:5432
>
> Applying migration `20230714202934_init`
>
> The following migration(s) have been applied:
>
> migrations/
>   └─ 20230714202934_init/
>     └─ migration.sql
>
> Your database is now in sync with your schema.
````

With `aesir mine` running in the background, you will be able to run all tests successfully with
the following commands.

```sh
$ yarn test
# OR
$ pnpm run test
...
```

Test files are located under `tests/` directory found under root folder of this project.

## Responsible disclosures

Found critical bugs/vulnerabilities? Please email them to aekasitt.g+github@siamintech.co.th Thanks!

## License

This project is licensed under the terms of the MIT license.
