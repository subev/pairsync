# PairSync

sync files automatically when saving by creating and applying git diffs over websockets

TODO

- [] initial syncing does not update untracked files and modified files
- [] add support for the server to commit and all clients should fast forward with
  it
- [] NPX support
- [] track file deletion

DONE

- [x] validate that every client is starting from the same hash, otherwise drop connection
- [x] currently works only on localhost, use localtunnel
- [x] use argv parsing library
- [x] Untracked files are not handled
