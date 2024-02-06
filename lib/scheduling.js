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
import * as crypto from "crypto";
import * as later from "@breejs/later";
function md532(str) {
    const digest = crypto.createHash("md5").update(str).digest();
    return (digest.readUInt32LE(0) ^
        digest.readUInt32LE(4) ^
        digest.readUInt32LE(8) ^
        digest.readUInt32LE(12));
}
export function variance(deviceId, vrnc) {
    return (md532(deviceId) >>> 0) % vrnc;
}
export function interval(timestamp, intrvl, offset = 0) {
    return Math.trunc((timestamp + offset) / intrvl) * intrvl - offset;
}
export function parseCron(cronExp) {
    const parts = cronExp.trim().split(/\s+/);
    if (parts.length === 5)
        parts.unshift("*");
    return later.schedule(later.parse.cron(parts.join(" "), true));
}
export function cron(timestamp, schedule, offset = 0) {
    // TODO later.js doesn't throw erorr if expression is invalid!
    const ret = [0, 0];
    const prev = schedule.prev(1, new Date(timestamp + offset));
    if (prev)
        ret[0] = prev.setMilliseconds(0) - offset;
    const next = schedule.next(1, new Date(timestamp + offset + 1000));
    if (next)
        ret[1] = next.setMilliseconds(0) - offset;
    return ret;
}
