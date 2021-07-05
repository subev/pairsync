# PairSync

Sync files automatically between two or more git repositories.
One acts as the server and multiple clients can connect.
If a file is modified on any machine the changes are broadcasted to the others.

# Installation

`npm install -g pairsync`

# Usage

On one of the machines:
`pairsync-server`
You will get an address to share with the other(s)

On the other machine(s):
`pairsync-client https://random-animal-42.loca.lt`

## Notes

The server should have an active branch published to the remote.
If there are any changes in the working directory of the server they will be synced when a client connects.
Clients will be asked to stash their unpublished changes before trying to connect.
In racing conditions - the last one wins.

### Enjoy pair programming!

TODO

- [] add commit support?
