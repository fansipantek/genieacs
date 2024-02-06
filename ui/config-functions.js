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
export function flattenConfig(config) {
    const flatten = {};
    const recuresive = (obj, root) => {
        for (const [k, v] of Object.entries(obj)) {
            const key = root ? `${root}.${k}` : k;
            if (v === undefined)
                continue;
            if (v === null || typeof v !== "object")
                flatten[key] = v;
            else
                recuresive(v, key);
        }
    };
    if (config !== null && typeof config === "object")
        recuresive(config, "");
    return flatten;
}
// Order keys such that nested objects come last
function orderKeys(config) {
    let res = 1;
    if (config == null || typeof config !== "object")
        return res;
    if (Array.isArray(config)) {
        for (const c of config)
            res += orderKeys(c);
        return res;
    }
    const weights = Object.entries(config).map(([k, v]) => [
        k,
        orderKeys(v),
    ]);
    weights.sort((a, b) => {
        if (a[1] !== b[1])
            return a[1] - b[1];
        if (b[0] > a[0])
            return -1;
        else
            return 1;
    });
    for (const [k, w] of weights) {
        res += w;
        const v = config[k];
        delete config[k];
        config[k] = v;
    }
    return res;
}
export function structureConfig(config) {
    config.sort((a, b) => (a._id > b._id ? 1 : a._id < b._id ? -1 : 0));
    const _config = {};
    for (const c of config) {
        const keys = c._id.split(".");
        let ref = _config;
        while (keys.length > 1) {
            const k = keys.shift();
            if (ref[k] == null || typeof ref[k] !== "object")
                ref[k] = {};
            ref = ref[k];
        }
        ref[keys[0]] = c.value;
    }
    const toArray = function (object) {
        const MAX_BITS = 30;
        const MAX_ARRAY_SIZE = MAX_BITS * 10;
        if (object == null || typeof object !== "object")
            return object;
        if (Object.keys(object).length <= MAX_ARRAY_SIZE) {
            let indexes = [];
            for (const key of Object.keys(object)) {
                const idx = Math.floor(+key);
                if (idx >= 0 && idx < MAX_ARRAY_SIZE && String(idx) === key) {
                    const pos = Math.floor(idx / MAX_BITS);
                    if (!indexes[pos])
                        indexes[pos] = 0;
                    indexes[pos] |= 1 << idx % MAX_BITS;
                }
                else {
                    indexes = [];
                    break;
                }
            }
            let index = 0;
            while (indexes.length && (index = indexes.shift()) === 1073741823)
                ;
            if (index && (~index & (index + 1)) === index + 1) {
                // its an array
                const array = [];
                for (let i = 0; i < Object.keys(object).length; i++)
                    array[i] = object[i];
                object = array;
            }
        }
        for (const [k, v] of Object.entries(object))
            object[k] = toArray(v);
        return object;
    };
    const res = toArray(_config);
    orderKeys(res);
    return res;
}
export function diffConfig(current, target) {
    const diff = {
        add: [],
        remove: [],
    };
    for (const [k, v] of Object.entries(target))
        if (v && current[k] !== v)
            diff.add.push({ _id: k, value: v });
    for (const k of Object.keys(current))
        if (!target[k])
            diff.remove.push(k);
    return diff;
}
