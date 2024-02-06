/**
 * Copyright 2013-2019  GenieACS Inc.
 *
 * This file is part of GenieACS.
 *
 * GenieACS is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * GenieACS is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with GenieACS.  If not, see <http://www.gnu.org/licenses/>.
 */
import { onConnect } from "./db";
import * as config from "./config";
const CLOCK_SKEW_TOLERANCE = 30000;
const MAX_CACHE_TTL = +config.get("MAX_CACHE_TTL");
let cacheCollection;
onConnect(async (db) => {
    cacheCollection = db.collection("cache");
    await cacheCollection.createIndex({ expire: 1 }, { expireAfterSeconds: 0 });
});
export async function get(key) {
    const res = await cacheCollection.findOne({ _id: key });
    return res === null || res === void 0 ? void 0 : res.value;
}
export async function del(key) {
    await cacheCollection.deleteOne({ _id: key });
}
export async function set(key, value, ttl = MAX_CACHE_TTL) {
    const timestamp = new Date();
    const expire = new Date(timestamp.getTime() + CLOCK_SKEW_TOLERANCE + ttl * 1000);
    await cacheCollection.replaceOne({ _id: key }, { value, expire, timestamp }, { upsert: true });
}
export async function pop(key) {
    var _a;
    const res = await cacheCollection.findOneAndDelete({ _id: key });
    return (_a = res.value) === null || _a === void 0 ? void 0 : _a.value;
}
export async function acquireLock(lockName, ttl, timeout = 0, token = Math.random().toString(36).slice(2)) {
    try {
        const now = Date.now();
        const r = await cacheCollection.findOneAndUpdate({ _id: lockName, value: token }, {
            $set: {
                expire: new Date(now + ttl + CLOCK_SKEW_TOLERANCE),
            },
            $currentDate: { timestamp: true },
        }, { upsert: true, returnDocument: "after" });
        if (Math.abs(r.value.timestamp.getTime() - now) > CLOCK_SKEW_TOLERANCE)
            throw new Error("Database clock skew too great");
    }
    catch (err) {
        if (err.code !== 11000)
            throw err;
        if (!(timeout > 0))
            return null;
        const w = 50 + Math.random() * 50;
        await new Promise((resolve) => setTimeout(resolve, w));
        return acquireLock(lockName, ttl, timeout - w, token);
    }
    return token;
}
export async function releaseLock(lockName, token) {
    const res = await cacheCollection.deleteOne({
        _id: lockName,
        value: token,
    });
    if (res.deletedCount !== 1)
        throw new Error("Lock expired");
}
