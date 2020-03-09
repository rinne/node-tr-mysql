TR MySQL
========

This is a simple yet powerful asynchronous wrapper on top of mysql
package. This package always creates a connection pool and operations
can either be performed directly against the pool or by retrieving a
connection against which multiple consecutive operations can be
executed, typically as a transaction.

```
const mysqlPoolFactory = require('tr-mysql');

var db;

async function init() {
    db = await mysqlPoolFactory({ debug: true,
                                  connectionLimit: 10,
                                  host: '127.0.0.1',
                                  user: 'dbuser',
                                  password: 'passwordfordbuser',
                                  database: 'sdhs' });
}

async function do_something_simple() {
    var r = await db.q('SELECT * FROM test WHERE a=?', [42]);
    return r;
}

async function do_something_complex() {
    var c, r = [];
    try {
        c = await db.c();
        await db.q(c, 'BEGIN');
        r.push(await db.q('SELECT x FROM test WHERE a=?', [42]));
        if (r[0].result.length < 1) {
            throw new Error('Did not find what I was looking for');     
        }
        r.push(await db.q('SELECT y FROM test2 WHERE b=?', [r[0].result[0].x]));
        if (r[1].result.length != 1) {
            throw new Error('Did not find exactly what I was looking for');
        }
        r.push(await db.q('UPDATE test3 SET c=? WHERE x=?', [r[0].result[0].x, r[1].result[0].y]));
        r.push(await db.q('UPDATE test4 SET b=? WHERE x=?', [r[0].result[0].x 0 r[1].result[0].y], 99));
        if (r[3].result.affectedRows < 1) {
            throw new Error('Really expected something to have been updated');
        }
        await db.q(c, 'COMMIT');
        c.release();
        c = undefined;
    } catch (e) {
        if (c) {
            c.destroy();
            c = undefined;
        }
        throw e;
    }
    return r; // Let's return everything.
}
```

Author
======

Timo J. Rinne <tri@iki.fi>


License
=======

MIT License
