# PairSync

Sync files automatically between two or more git repositories.
One acts as the server and multiple clients can connect.
If a file is modified on any machine the changes are broadcasted to the others.

Enjoy pair programming!

DONE

- [X] NPM
- [x] initial syncing does not update untracked files and modified files
- [x] validate that every client is starting from the same hash, otherwise drop connection
- [x] currently works only on localhost, use localtunnel
- [x] use argv parsing library
- [x] Untracked files are not handled

TODO

- [] NPM i -g not working on Windows
- [] track file deletion or validate that it is working
- [] add commit support?

