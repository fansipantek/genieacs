/**
 * Copyright 2013-2020  GenieACS Inc.
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
export function and(a, b) {
    return a & b;
}
export function or(a, b) {
    return a | b;
}
export function xor(a, b) {
    return a ^ b;
}
export function not(a) {
    return ~a;
}
export function lshift(a, b) {
    return a << b;
}
export function rshift(a, b) {
    return a >> b;
}
export function add(a, b) {
    return a + b;
}
export function sub(a, b) {
    return a - b;
}
export function mul(a, b) {
    return a * b;
}
export function div(a, b) {
    return a / b;
}
export function exp(a, b) {
    return a ** b;
}
export function rem(a, b) {
    return a % b;
}
export function toNumber(a) {
    return Number(a);
}
export function eq(a, b) {
    return a === b;
}
export function ne(a, b) {
    return a !== b;
}
export function lt(a, b) {
    return a < b;
}
export function lte(a, b) {
    return a <= b;
}
export function gt(a, b) {
    return a > b;
}
export function gte(a, b) {
    return a >= b;
}
export function asUintN(a, b) {
    return BigInt.asUintN(a, b);
}
export function asIntN(a, b) {
    return BigInt.asIntN(a, b);
}
const _BigInt = BigInt;
export { _BigInt as BigInt };
