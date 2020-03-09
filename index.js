'use strict';

const mysql = require('mysql');

function MySQL_Pool() {
	this.dead = false;
}

function MySQL_Connection(conn) {
	this.dead = false;
	this.conn = function() {
		if (this.dead) {
			throw new Error('Connection dead');
		}
		return conn;
	}.bind(this);
}

MySQL_Connection.prototype.release = function() {
	if (this.dead) {
		throw new Error('Connection dead');
	}
	var conn = this.conn();
	this.dead = true;
	conn.release();
	return true;
};

MySQL_Connection.prototype.destroy = function() {
	if (this.dead) {
		throw new Error('Connection dead');
	}
	var conn = this.conn();
	this.dead = true;
	conn.destroy();
	return true;
};

async function mysqlPoolFactory(poolOptions) {
	var r = new MySQL_Pool();
	try {
		r.pool = mysql.createPool(poolOptions);
	} catch (e) {
		throw e;
	};
	return new Promise(function(resolve, reject) {
		r.pool.query('SELECT UNIX_TIMESTAMP() AS t, VERSION() AS v', function (e, result, fields) {
			if (e) {
				try {
					r.pool.end(function() {});
					delete r.pool;
				} catch(e) {
					//NOTHING;
				}
				return reject(e);
			}
			r.dbTimeDifference = result[0].t - Math.floor(Date.now() / 1000);
			r.dbVersion = result[0].v;
			return resolve(r);
		});
	});
};

MySQL_Pool.prototype.q = async function(...av) {
	var conn, query, params;
	if (this.dead) {
		throw new Error('Connection pool dead');
	}
	if (av.length && (av[0] instanceof MySQL_Connection)) {
		conn = av.shift();
	}
	if (av.length && (typeof(av[0]) === 'string')) {
		query = av.shift();
	}
	if (av.length) {
		if (typeof(av[0]) === 'string') {
			params = [ av.shift() ];
		} else if (Array.isArray(av[0])) {
			params = av.shift();
		}
	}
	if (av.length || (! query)) {
		return Promise.reject(new Error('Invalid arguments to MySQL.q([conn], query, [params])'));
	}
	if (conn) {
		if (conn.masterConn !== this) {
			return Promise.reject(new Error('Connection object is not part of pool.'));
		}
		conn = conn.conn();
	} else {
		conn = this.pool;
	}
	return new Promise(function(resolve, reject) {
		conn.query(query, params, function (e, result, fields) {
			if (e) {
				return reject(e);
			}
			return resolve({ result: result, fields: fields });
		}.bind(this));
	}.bind(this));
};

MySQL_Pool.prototype.c = async function() {
	if (this.dead) {
		throw new Error('Connection pool dead');
	}
	return new Promise(function(resolve, reject) {
		var r = this.pool.getConnection(function(e, conn) {
			if (e) {
				return reject(e);
			}
			var c = new MySQL_Connection(conn);
			c.masterConn = this;
			return resolve(c);
		}.bind(this));
	}.bind(this));
};

MySQL_Pool.prototype.close = async function() {
	if (this.dead) {
		throw new Error('Connection pool dead');
	}
	this.dead = true;
	return new Promise(function(resolve, reject) {
		var r = this.pool.end(function(e) {
			if (e) {
				return reject(e);
			}
			return resolve(true);
		}.bind(this));
	}.bind(this));
};

module.exports = mysqlPoolFactory;
