import chai from 'chai';
const {
  assert
} = chai;
import WebSQLDb from "../src/WebSQLDb";
import db_queries from "./db_queries";
import db_caching from "./db_caching";
import _ from 'lodash';
import async from 'async';
import OldWebSQLDb from './v2/WebSQLDb';

const error = function(err) {
  console.log(err);
  return assert.fail(JSON.stringify(err));
};

describe('WebSQLDb', function() {
  this.timeout(5000);

  before(function(done) {
    this.reset = done => {
      return new WebSQLDb({ namespace: "db.scratch" }, db => {
        this.db = db;
        return this.db.removeCollection('scratch', () => {
          return this.db.addCollection('scratch', () => {
            this.col = this.db.scratch;
            return done();
          });
        });
      });
    };
    return this.reset(done);
  });

  describe("passes queries", function() {
    return db_queries.call(this);
  });

  return describe("passes caching", function() {
    return db_caching.call(this);
  });
});

describe('WebSQLDb storage', function() {
  beforeEach(function(done) {
    return new WebSQLDb({ namespace: "db.scratch" }, db => {
      this.db = db;
      return this.db.removeCollection('scratch', () => {
        return this.db.addCollection('scratch', () => done());
      });
    });
  });

  it("retains items", function(done) {
    return this.db.scratch.upsert({ _id:"1", a:"Alice" }, () => new WebSQLDb({ namespace: "db.scratch" }, db2 => db2.addCollection('scratch', () => db2.scratch.find({}).fetch(function(results) {
      assert.equal(results[0].a, "Alice");
      return done();
    }))));
  });

  it("retains upserts", function(done) {
    return this.db.scratch.cacheOne({ _id:"1", a:"Alice" }, () => {
      return this.db.scratch.upsert({ _id:"1", a:"Bob" }, () => new WebSQLDb({ namespace: "db.scratch" }, db2 => db2.addCollection('scratch', () => db2.scratch.find({}).fetch(function(results) {
        assert.deepEqual(results, [{ _id:"1", a:"Bob" }]);
        return db2.scratch.pendingUpserts(function(upserts) {
          assert.equal(upserts.length, 1);
          assert.deepEqual(upserts[0].doc, { _id:"1", a:"Bob" });
          assert.deepEqual(upserts[0].base, { _id:"1", a:"Alice" });
          return done();
        });
      }))));
    });
  });

  it("retains removes", function(done) {
    return this.db.scratch.seed({ _id:"1", a:"Alice" }, () => {
      return this.db.scratch.remove("1", () => new WebSQLDb({ namespace: "db.scratch" }, db2 => db2.addCollection('scratch', () => db2.scratch.pendingRemoves(function(removes) {
        assert.deepEqual(removes, ["1"]);
        return done();
      }))));
    });
  });

  return it("inserts 1000 documents at once", function(done) {
    this.timeout(30000);
    const docs = [];
    for (let i = 0; i < 1000; i++) {
      docs.push({ lat: i, lng: i+1, timestamp: new Date().toISOString() });
    }

    return this.db.scratch.upsert(docs, () => {
      return this.db.scratch.find({}).fetch(function(results) {
        assert.equal(results.length, 1000);
        return done();
      }
      , error);
    }
    , error);
  });
});

// describe 'WebSQLDb upgrade', ->
//   it "retains items", (done) ->
//     new OldWebSQLDb { namespace: "db.scratch" }, (olddb) =>
//       olddb.addCollection 'scratch', =>
//         olddb.scratch.upsert { _id:"1", a:"Alice" }, =>
//           new WebSQLDb { namespace: "db.scratch" }, (newdb) =>
//             newdb.addCollection 'scratch', =>
//               newdb.scratch.find({}).fetch (results) ->
//                 assert.equal results[0].a, "Alice"
//                 done()