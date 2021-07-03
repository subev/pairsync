# PairSync

sync files automatically when saving by creating and applying git diffs over websockets

TODO

- [] Untracked files are not handled
- [] add support for the server to commit and all clients should fast forward with
  it
- [] NPX support

DONE

- [x] validate that every client is starting from the same hash, otherwise drop connection
- [x] currently works only on localhost, use localtunnel
- [x] use argv parsing library
