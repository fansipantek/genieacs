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
import * as BI from "./bigint";
import { espresso, complement, tautology } from "espresso-iisojs";
import { map } from "./expression-parser";
import { and, evaluateCallback } from "./expression";
const ZERO = BI.BigInt(0);
const ONE = BI.BigInt(1);
const TWO = BI.BigInt(2);
const NEGATIVE_ONE = BI.BigInt(-1);
class Indeterminates {
    constructor(str) {
        this.map = new Map();
        if (str) {
            this.map.set(str, 1);
            this.sortedKeys = [str];
        }
        else {
            this.sortedKeys = [];
        }
    }
    reciprocal() {
        const res = new Indeterminates();
        res.sortedKeys = this.sortedKeys;
        res.map = new Map();
        for (const [k, v] of this.map)
            res.map.set(k, 0 - v);
        return res;
    }
    static multiply(indeterminates1, indeterminates2) {
        const res = new Indeterminates();
        res.sortedKeys = indeterminates1.sortedKeys.slice();
        res.map = new Map(indeterminates1.map);
        for (const [key, val] of indeterminates2.map) {
            const v = res.map.get(key);
            if (!v) {
                res.map.set(key, val);
                res.sortedKeys.push(key);
            }
            else {
                const v2 = val + v;
                if (!v2) {
                    res.map.delete(key);
                    res.sortedKeys = res.sortedKeys.filter((s) => s !== key);
                }
                else {
                    res.map.set(key, v2);
                }
            }
        }
        res.sortedKeys.sort((a, b) => {
            if (a.length !== b.length)
                return b.length - a.length;
            else if (a > b)
                return 1;
            else if (a < b)
                return -1;
            return 0;
        });
        return res;
    }
    static compare(a, b) {
        if (a.sortedKeys.length !== b.sortedKeys.length)
            return b.sortedKeys.length - a.sortedKeys.length;
        for (let i = 0; i < a.sortedKeys.length; ++i) {
            const k1 = a.sortedKeys[i];
            const w1 = a.map.get(k1);
            const k2 = b.sortedKeys[i];
            const w2 = b.map.get(k2);
            if (w1 !== w2)
                return w2 - w1;
            if (k1.length > k2.length)
                return -1;
            else if (k1.length < k2.length)
                return 1;
            else if (k1 > k2)
                return 1;
            else if (k1 < k2)
                return -1;
        }
        return 0;
    }
}
function findGcd(a, b) {
    while (BI.ne(b, ZERO)) {
        const t = b;
        b = BI.rem(a, b);
        a = t;
    }
    return a;
}
class Polynomial {
    constructor(terms) {
        this.terms = terms;
    }
    static simplifyTerms(terms) {
        const ts = terms
            .slice()
            .sort((a, b) => Indeterminates.compare(a.indeterminates, b.indeterminates));
        for (let i = 1; i < ts.length; ++i) {
            const t1 = ts[i - 1];
            const t2 = ts[i];
            if (Indeterminates.compare(t1.indeterminates, t2.indeterminates) === 0) {
                const numerator = BI.add(BI.mul(t1.coefficientNumerator, t2.coefficientDenominator), BI.mul(t2.coefficientNumerator, t1.coefficientDenominator));
                const denominator = BI.mul(t1.coefficientDenominator, t2.coefficientDenominator);
                const gcd = findGcd(numerator, denominator);
                ts[i] = {
                    indeterminates: t2.indeterminates,
                    coefficientNumerator: BI.div(numerator, gcd),
                    coefficientDenominator: BI.div(denominator, gcd),
                };
                ts[i - 1] = {
                    indeterminates: t1.indeterminates,
                    coefficientNumerator: ZERO,
                    coefficientDenominator: t1.coefficientDenominator,
                };
            }
        }
        return ts.filter((v) => BI.ne(v.coefficientNumerator, ZERO));
    }
    static fromIndeterminate(indeterminate) {
        const indeterminates = new Indeterminates(JSON.stringify(indeterminate));
        const terms = [
            {
                indeterminates: indeterminates,
                coefficientNumerator: ONE,
                coefficientDenominator: ONE,
            },
        ];
        return new Polynomial(terms);
    }
    static fromConstant(constant) {
        const [int, frac] = Math.abs(constant).toString(2).split(".", 2);
        let numerator = BI.BigInt("0b" + int);
        if (constant < 0)
            numerator = BI.mul(numerator, NEGATIVE_ONE);
        let denominator = ONE;
        if (frac) {
            denominator = BI.exp(TWO, BI.BigInt(frac.length));
            numerator = BI.add(BI.mul(numerator, denominator), BI.BigInt("0b" + frac));
        }
        const terms = [
            {
                indeterminates: new Indeterminates(),
                coefficientNumerator: numerator,
                coefficientDenominator: denominator,
            },
        ];
        return new Polynomial(terms);
    }
    negation() {
        const terms = this.terms.map((t) => ({
            indeterminates: t.indeterminates,
            coefficientNumerator: BI.mul(t.coefficientNumerator, NEGATIVE_ONE),
            coefficientDenominator: t.coefficientDenominator,
        }));
        return new Polynomial(terms);
    }
    reciprocal() {
        const terms = this.terms.map((t) => ({
            indeterminates: t.indeterminates.reciprocal(),
            coefficientNumerator: t.coefficientDenominator,
            coefficientDenominator: t.coefficientNumerator,
        }));
        return new Polynomial(terms);
    }
    constant() {
        const terms = this.terms.filter((t) => !t.indeterminates.sortedKeys.length);
        return new Polynomial(terms);
    }
    add(rhs) {
        return new Polynomial(Polynomial.simplifyTerms(this.terms.concat(rhs.terms)));
    }
    subtract(rhs) {
        return this.add(rhs.negation());
    }
    multiply(rhs) {
        const terms = [];
        for (const t1 of this.terms) {
            for (const t2 of rhs.terms) {
                const numerator = BI.mul(t1.coefficientNumerator, t2.coefficientNumerator);
                const denominator = BI.mul(t1.coefficientDenominator, t2.coefficientDenominator);
                const gcd = findGcd(numerator, denominator);
                terms.push({
                    indeterminates: Indeterminates.multiply(t1.indeterminates, t2.indeterminates),
                    coefficientNumerator: BI.div(numerator, gcd),
                    coefficientDenominator: BI.div(denominator, gcd),
                });
            }
        }
        return new Polynomial(Polynomial.simplifyTerms(terms));
    }
    divide(rhs) {
        return this.multiply(rhs.reciprocal());
    }
    toString() {
        const add = [];
        for (const t of this.terms) {
            const coefficient = BI.toNumber(t.coefficientNumerator) /
                BI.toNumber(t.coefficientDenominator);
            const mul = [];
            if (t.indeterminates.sortedKeys.length) {
                for (const k of t.indeterminates.sortedKeys) {
                    const w = t.indeterminates.map.get(k);
                    for (let i = Math.abs(w); i > 0; --i) {
                        if (w > 0)
                            mul.push(k);
                        else
                            mul.push(`["/",1,${k}]`);
                    }
                }
                if (coefficient !== 1)
                    mul.push(coefficient.toString());
                if (mul.length > 1)
                    add.push(`["*",${mul.join(",")}]`);
                else
                    add.push(mul["0"]);
            }
            else {
                add.push(coefficient.toString());
            }
        }
        if (!add.length)
            return "0";
        else if (add.length === 1)
            return add[0];
        else
            return `["+",${add.join(",")}]`;
    }
}
class BoolExprSynth {
}
class TrueSynth extends BoolExprSynth {
    true() {
        return [[]];
    }
    false() {
        return [];
    }
    null() {
        return [];
    }
}
class FalseSynth extends BoolExprSynth {
    true() {
        return [];
    }
    false() {
        return [[]];
    }
    null() {
        return [];
    }
}
class NullSynth extends BoolExprSynth {
    true() {
        return [];
    }
    false() {
        return [];
    }
    null() {
        return [[]];
    }
}
class VarSynth extends BoolExprSynth {
    constructor(exp) {
        super();
        this.negate = false;
        if (Array.isArray(exp)) {
            const op = exp[0];
            if (op === "<>") {
                exp = exp.slice();
                exp[0] = "=";
                this.negate = true;
            }
            else if (op === ">=") {
                exp = exp.slice();
                exp[0] = "<";
                this.negate = true;
            }
            else if (op === "<=") {
                exp = exp.slice();
                exp[0] = ">";
                this.negate = true;
            }
            else if (op === "NOT LIKE") {
                exp = exp.slice();
                exp[0] = "LIKE";
                this.negate = true;
            }
        }
        this.exp = exp;
    }
    true(context) {
        const v = context.getVariable(this.exp);
        return [[(v << 2) ^ (this.negate ? 1 : 3)]];
    }
    false(context) {
        const v = context.getVariable(this.exp);
        return [[(v << 2) ^ (this.negate ? 3 : 1)]];
    }
    null(context) {
        const v = context.getVariable(this.exp);
        return [[v << 2, (v << 2) ^ 2]];
    }
}
class NotSynth extends BoolExprSynth {
    constructor(e) {
        super();
        this.exprSynth = e;
    }
    true(context) {
        return this.exprSynth.false(context);
    }
    false(context) {
        return this.exprSynth.true(context);
    }
    null(context) {
        return this.exprSynth.null(context);
    }
}
class IsNullSynth extends BoolExprSynth {
    constructor(e) {
        super();
        this.exprSynth = e;
    }
    true(context) {
        return this.exprSynth.null(context);
    }
    false(context) {
        return [...this.exprSynth.true(context), ...this.exprSynth.false(context)];
    }
    null() {
        return [];
    }
}
class OrSynth extends BoolExprSynth {
    constructor(...e) {
        super();
        this.exprSynths = e.filter((ee) => !(ee instanceof FalseSynth));
        const unpacked = [];
        this.exprSynths = this.exprSynths.filter((ee) => {
            if (ee instanceof OrSynth) {
                unpacked.push(...ee.exprSynths);
                return false;
            }
            return true;
        });
        this.exprSynths.push(...unpacked);
    }
    true(context) {
        if (this.exprSynths.length === 0)
            return [];
        if (this.exprSynths.length === 1)
            return this.exprSynths[0].true(context);
        if (this.exprSynths.some((e) => e instanceof TrueSynth))
            return [[]];
        return this.exprSynths.map((e) => e.true(context)).flat();
    }
    false(context) {
        if (this.exprSynths.length === 0)
            return [[]];
        if (this.exprSynths.length === 1)
            return this.exprSynths[0].false(context);
        if (this.exprSynths.some((e) => e instanceof TrueSynth || e instanceof NullSynth))
            return [];
        return complement(this.exprSynths.map((e) => complement(e.false(context))).flat());
    }
    null(context) {
        if (this.exprSynths.length === 0)
            return [];
        if (this.exprSynths.length === 1)
            return this.exprSynths[0].null(context);
        const n = this.exprSynths.map((e) => e.null(context)).flat();
        const t = this.exprSynths.map((e) => e.true(context)).flat();
        return complement([...complement(n), ...t]);
    }
}
class AndSynth extends BoolExprSynth {
    constructor(...e) {
        super();
        this.exprSynths = e.filter((ee) => !(ee instanceof TrueSynth));
        const unpacked = [];
        this.exprSynths = this.exprSynths.filter((ee) => {
            if (ee instanceof AndSynth) {
                unpacked.push(...ee.exprSynths);
                return false;
            }
            return true;
        });
        this.exprSynths.push(...unpacked);
    }
    true(context) {
        if (this.exprSynths.length === 0)
            return [[]];
        if (this.exprSynths.length === 1)
            return this.exprSynths[0].true(context);
        if (this.exprSynths.some((e) => e instanceof FalseSynth || e instanceof NullSynth))
            return [];
        return complement(this.exprSynths.map((e) => complement(e.true(context))).flat());
    }
    false(context) {
        if (this.exprSynths.length === 0)
            return [];
        if (this.exprSynths.length === 1)
            return this.exprSynths[0].false(context);
        if (this.exprSynths.some((e) => e instanceof FalseSynth))
            return [[]];
        return this.exprSynths.map((e) => e.false(context)).flat();
    }
    null(context) {
        if (this.exprSynths.length === 0)
            return [];
        if (this.exprSynths.length === 1)
            return this.exprSynths[0].null(context);
        const n = this.exprSynths.map((e) => e.null(context)).flat();
        const f = this.exprSynths.map((e) => e.false(context)).flat();
        return complement([...complement(n), ...f]);
    }
}
class CaseSynth extends BoolExprSynth {
    constructor(e) {
        super();
        this.exprSynths = e;
    }
    true(context) {
        const minterms = [];
        const cumulative = [];
        for (let i = 0; i < this.exprSynths.length; i += 2) {
            const w = this.exprSynths[i].true(context);
            const t = this.exprSynths[i + 1].true(context);
            minterms.push(...complement([...cumulative, ...complement(w), ...complement(t)]));
            if (i < this.exprSynths.length - 2) {
                cumulative.push(...complement([
                    ...this.exprSynths[i].false(context),
                    ...this.exprSynths[i].null(context),
                ]));
            }
        }
        return minterms;
    }
    false(context) {
        const minterms = [];
        const cumulative = [];
        for (let i = 0; i < this.exprSynths.length; i += 2) {
            const w = this.exprSynths[i].true(context);
            const t = this.exprSynths[i + 1].false(context);
            minterms.push(...complement([...cumulative, ...complement(w), ...complement(t)]));
            if (i < this.exprSynths.length - 2) {
                cumulative.push(...complement([
                    ...this.exprSynths[i].false(context),
                    ...this.exprSynths[i].null(context),
                ]));
            }
        }
        return minterms;
    }
    null(context) {
        const minterms = [];
        const cumulative = [];
        for (let i = 0; i < this.exprSynths.length; i += 2) {
            const w = this.exprSynths[i].true(context);
            const t = this.exprSynths[i + 1].null(context);
            minterms.push(...complement([...cumulative, ...complement(w), ...complement(t)]));
            cumulative.push(...complement([
                ...this.exprSynths[i].false(context),
                ...this.exprSynths[i].null(context),
            ]));
        }
        minterms.push(...complement([...cumulative]));
        return minterms;
    }
}
const ADDITIVE_IDENTITY = Polynomial.fromConstant(0);
const MULTIPLICATIVE_IDENTITY = Polynomial.fromConstant(1);
const SWAPPED_OPS = {
    "=": "=",
    "<>": "<>",
    ">": "<",
    ">=": "<=",
    "<": ">",
    "<=": ">=",
};
function normalizeCallback(exp) {
    if (!Array.isArray(exp))
        return exp;
    const op = exp[0];
    if (op === "FUNC" && exp[1] === "COALESCE") {
        const res = ["CASE"];
        for (let i = 2; i < exp.length; ++i)
            res.push(normalizeCallback(["IS NOT NULL", exp[i]]), exp[i]);
        return normalizeCallback(res);
    }
    if (op === "CASE") {
        const res = [];
        for (let i = 1; i < exp.length; i += 2) {
            let w = exp[i];
            if (w instanceof Polynomial)
                w = JSON.parse(w.toString());
            if (!Array.isArray(w) && !w)
                continue;
            const t = exp[i + 1];
            if (!Array.isArray(t) || t[0] !== "CASE") {
                res.push([w, t]);
                continue;
            }
            for (let j = 1; j < t.length; j += 2)
                res.push([and(w, t[j]), t[j + 1]]);
            res.push([w, null]);
            if (!Array.isArray(w) && w)
                break;
        }
        while (res[res.length - 1][1] == null)
            res.pop();
        return ["CASE", ...res.flat()];
    }
    const permutations = new Map();
    for (const [i, e] of exp.entries()) {
        if (!Array.isArray(e))
            continue;
        if (e[0] !== "CASE")
            continue;
        const perms = [];
        for (let j = 1; j < e.length; j += 2)
            perms.push([e[j], e[j + 1]]);
        permutations.set(i, perms);
    }
    if (permutations.size) {
        let res = [[true, exp]];
        for (const [i, perms] of permutations) {
            const res2 = [];
            for (const [w, t] of perms) {
                res2.push(...res.map((r) => {
                    const e = r[1].slice();
                    e[i] = t;
                    return [and(w, r[0]), e];
                }));
            }
            res = res2;
        }
        for (const r of res)
            r[1] = normalizeCallback(r[1]);
        if (res[0][0] === true)
            return res[0][1];
        while (res[res.length - 1][1] == null)
            res.pop();
        return ["CASE", ...res.flat()];
    }
    function toPolynomial(e) {
        if (e == null)
            return null;
        if (e instanceof Polynomial)
            return e;
        if (typeof e === "number")
            return Polynomial.fromConstant(e);
        if (typeof e === "string")
            return Polynomial.fromConstant(parseFloat(e) || 0);
        if (typeof e === "boolean")
            return Polynomial.fromConstant(+e);
        return Polynomial.fromIndeterminate(e);
    }
    if (op === "+") {
        const args = [];
        for (let i = 1; i < exp.length; ++i) {
            const p = toPolynomial(exp[i]);
            if (p == null)
                return null;
            args.push(p);
        }
        return args.reduce((previousValue, currentValue) => previousValue.add(currentValue), ADDITIVE_IDENTITY);
    }
    else if (op === "*") {
        const args = [];
        for (let i = 1; i < exp.length; ++i) {
            const p = toPolynomial(exp[i]);
            if (p == null)
                return null;
            args.push(p);
        }
        return args.reduce((previousValue, currentValue) => previousValue.multiply(currentValue), MULTIPLICATIVE_IDENTITY);
    }
    else if (op === "-") {
        const args = [];
        for (let i = 1; i < exp.length; ++i) {
            const p = toPolynomial(exp[i]);
            if (p == null)
                return null;
            args.push(p);
        }
        return args.reduce((previousValue, currentValue) => previousValue.subtract(currentValue));
    }
    else if (op === "/") {
        const args = [];
        for (let i = 1; i < exp.length; ++i) {
            const p = toPolynomial(exp[i]);
            if (p == null)
                return null;
            args.push(p);
        }
        return args.reduce((previousValue, currentValue) => previousValue.divide(currentValue));
    }
    else if (["=", "<>", ">", ">=", "<", "<="].includes(op)) {
        if (exp[1] == null || exp[2] == null)
            return null;
        let lhs, rhs;
        if (exp[1] instanceof Polynomial)
            lhs = exp[1];
        else if (typeof exp[1] === "number")
            lhs = Polynomial.fromConstant(exp[1]);
        if (exp[2] instanceof Polynomial)
            rhs = exp[2];
        else if (typeof exp[2] === "number")
            rhs = Polynomial.fromConstant(exp[2]);
        if (lhs || rhs) {
            if (!lhs)
                lhs = Polynomial.fromIndeterminate(exp[1]);
            if (!rhs)
                rhs = Polynomial.fromIndeterminate(exp[2]);
            lhs = lhs.subtract(rhs);
            rhs = lhs.constant().negation();
            lhs = lhs.add(rhs);
            if (!lhs.terms.length) {
                exp = [op, JSON.parse(lhs.toString()), JSON.parse(rhs.toString())];
                if (op === "=")
                    return exp[1] === exp[2];
                else if (op === "<>")
                    return exp[1] !== exp[2];
                else if (op === ">")
                    return exp[1] > exp[2];
                else if (op === ">=")
                    return exp[1] >= exp[2];
                else if (op === "<")
                    return exp[1] < exp[2];
                else if (op === "<=")
                    return exp[1] <= exp[2];
            }
            else {
                let flipOp = 1;
                const n = lhs.terms[0].coefficientNumerator;
                const d = lhs.terms[0].coefficientDenominator;
                if (BI.lt(n, ZERO) || BI.lt(d, ZERO))
                    flipOp *= -1;
                const reciprocal = new Polynomial([
                    {
                        indeterminates: new Indeterminates(),
                        coefficientNumerator: d,
                        coefficientDenominator: n,
                    },
                ]);
                lhs = lhs.multiply(reciprocal);
                rhs = rhs.multiply(reciprocal);
                const keys = lhs.terms[0].indeterminates.sortedKeys;
                let invert = lhs.terms[0].indeterminates.map.get(keys[0]) < 0 ? -1 : 0;
                for (const t of lhs.terms)
                    for (const v of t.indeterminates.map.values())
                        invert += v;
                if (invert < 0) {
                    flipOp *= -1;
                    lhs = lhs.reciprocal();
                    rhs = rhs.reciprocal();
                }
                if (flipOp < 0)
                    exp = [SWAPPED_OPS[op], lhs, rhs];
                else
                    exp = [op, lhs, rhs];
            }
        }
    }
    // Restore polynomial expressions
    exp = exp.map((e) => e instanceof Polynomial ? JSON.parse(e.toString()) : e);
    exp = evaluateCallback(exp);
    return exp;
}
export function normalize(expr) {
    expr = map(expr, normalizeCallback);
    if (expr instanceof Polynomial) {
        expr = JSON.parse(expr.toString());
    }
    else if (Array.isArray(expr) && expr[0] === "CASE") {
        expr = expr.map((e) => e instanceof Polynomial ? JSON.parse(e.toString()) : e);
    }
    return expr;
}
function toBoolExprSynth(e) {
    if (e instanceof BoolExprSynth)
        return e;
    if (Array.isArray(e)) {
        if (e[0] === "CASE")
            return new CaseSynth(e.slice(1).map((ee) => toBoolExprSynth(ee)));
        return new VarSynth(e);
    }
    if (e == null)
        return new NullSynth();
    if (e)
        return new TrueSynth();
    return new FalseSynth();
}
function sopToExpression(sop, context) {
    if (!sop.length)
        return false;
    const res = [];
    for (const s of sop) {
        if (!s.length)
            return true;
        const conjs = [];
        for (const i of s) {
            let expr = context.getExpression(i >>> 2);
            if (!(i & 1) !== !(i & 2))
                expr = ["NOT", expr];
            if (Array.isArray(expr) && expr[0] === "NOT" && Array.isArray(expr[1])) {
                const e = expr[1];
                if (e[0] === "IS NULL")
                    expr = ["IS NOT NULL", ...e.slice(1)];
                else if (e[0] === "LIKE")
                    expr = ["NOT LIKE", ...e.slice(1)];
                else if (e[0] === "=")
                    expr = ["<>", ...e.slice(1)];
                else if (e[0] === "<>")
                    expr = ["=", ...e.slice(1)];
                else if (e[0] === ">")
                    expr = ["<=", ...e.slice(1)];
                else if (e[0] === ">=")
                    expr = ["<", ...e.slice(1)];
                else if (e[0] === "<")
                    expr = [">=", ...e.slice(1)];
                else if (e[0] === "<=")
                    expr = [">", ...e.slice(1)];
                else if (e[0] === "NOT")
                    expr = e[1];
                else
                    expr = ["NOT", e];
            }
            conjs.push(expr);
        }
        if (conjs.length > 1)
            res.push(["AND"].concat(conjs));
        else
            res.push(conjs[0]);
    }
    if (res.length > 1)
        return ["OR"].concat(res);
    return res[0];
}
function findIsNullDeps(exp) {
    if (!Array.isArray(exp))
        return [];
    const op = exp[0];
    if (op === "IS NULL" || op === "IS NOT NULL")
        return [];
    if (op === "FUNC") {
        if (exp[1] === "NOW") {
            return [];
        }
        else if (exp[1] === "LOWER" || exp[1] === "UPPER") {
            return findIsNullDeps(exp[2]);
        }
        else if (exp[1] === "ROUND") {
            return exp
                .slice(2, 4)
                .map((e) => findIsNullDeps(e))
                .flat();
        }
    }
    else if (op !== "PARAM") {
        return exp
            .slice(1)
            .map((e) => findIsNullDeps(e))
            .flat();
    }
    return [exp];
}
class SynthContext {
    constructor() {
        this._dcSet = [];
        this._variables = new Map();
        this._expressions = new Map();
        this._isNullRelations = new Map();
        this._isNullVars = new Set();
        this._comparisons = new Map();
    }
    getVariable(exp) {
        const expStr = JSON.stringify(exp);
        if (this._variables.has(expStr))
            return this._variables.get(expStr);
        const v = this._variables.size;
        this._variables.set(expStr, v);
        this._expressions.set(v, exp);
        this.generateIsNullDc(v);
        this.generateComparisionDc(v);
        if (expStr === '["IS NULL",["PARAM","DeviceID.ID"]]' ||
            expStr === '["IS NULL",["PARAM","_id"]]')
            this._dcSet.push([(v << 2) ^ 3]);
        return v;
    }
    generateIsNullDc(v) {
        this._isNullRelations.set(v, []);
        const exp = this._expressions.get(v);
        const isNull = new Set(findIsNullDeps(exp).map((e) => this.getVariable(["IS NULL", e])));
        if (!isNull.size)
            return;
        for (const n of isNull) {
            this._isNullVars.add(n);
            this._isNullRelations.get(n).push(v);
            this._isNullRelations.get(v).push(n);
            this._dcSet.push([(n << 2) ^ 3, (v << 2) ^ 1]);
            this._dcSet.push([(n << 2) ^ 3, (v << 2) ^ 3]);
        }
        this._dcSet.push([...isNull].map((n) => (n << 2) ^ 2).concat([(v << 2) ^ 0, (v << 2) ^ 2]));
    }
    generateComparisionDc(v) {
        const exp = this._expressions.get(v);
        if (!Array.isArray(exp))
            return;
        const op = exp[0];
        if (![">", "<", "="].includes(op))
            return;
        const rhs = exp[2];
        const rhsStr = JSON.stringify(rhs);
        const lhsStr = JSON.stringify(exp[1]);
        let allComps = this._comparisons.get(lhsStr);
        if (!allComps)
            this._comparisons.set(lhsStr, (allComps = new Map()));
        if (allComps.has(rhsStr))
            return;
        const comp = {
            eq: -1,
            gt: -1,
            lt: -1,
        };
        allComps.set(rhsStr, comp);
        comp.eq = this.getVariable(["=", exp[1], exp[2]]);
        comp.gt = this.getVariable([">", exp[1], exp[2]]);
        comp.lt = this.getVariable(["<", exp[1], exp[2]]);
        this._dcSet.push([
            (comp.eq << 2) ^ 1,
            (comp.gt << 2) ^ 1,
            (comp.lt << 2) ^ 1,
        ]);
        this._dcSet.push([(comp.eq << 2) ^ 3, (comp.gt << 2) ^ 3]);
        this._dcSet.push([(comp.eq << 2) ^ 3, (comp.lt << 2) ^ 3]);
        this._dcSet.push([(comp.gt << 2) ^ 3, (comp.lt << 2) ^ 3]);
        const type1 = typeof exp[2];
        if (!["boolean", "number", "string"].includes(type1))
            return;
        for (const [rhs2Str, comp2] of allComps) {
            if (comp2 === comp)
                continue;
            const rhs2 = JSON.parse(rhs2Str);
            const type2 = typeof rhs2;
            if (!["boolean", "number", "string"].includes(type2))
                continue;
            let cmp = 0;
            if (type1 === type2)
                cmp = rhs > rhs2 ? 1 : -1;
            else if (type1 === "string")
                cmp = 1;
            else if (type2 === "string")
                cmp = -1;
            else
                cmp = +rhs - +rhs2;
            const c1 = cmp > 0 ? comp : comp2;
            const c2 = cmp > 0 ? comp2 : comp;
            // This is the minimum clauses required if all relavent vars
            // were included in the DC set.
            // this._dcSet.push([(c1.eq << 2) ^ 3, (c2.eq << 2) ^ 3]);
            // this._dcSet.push([(c1.lt << 2) ^ 1, (c2.gt << 2) ^ 1]);
            // But we use non-minimal set because intermediate vars
            // between any two may not be present in the DC set.
            this._dcSet.push([(c1.lt << 2) ^ 1, (c2.gt << 2) ^ 1]);
            this._dcSet.push([(c1.lt << 2) ^ 1, (c2.eq << 2) ^ 3]);
            this._dcSet.push([(c1.lt << 2) ^ 1, (c2.lt << 2) ^ 3]);
            this._dcSet.push([(c1.eq << 2) ^ 3, (c2.gt << 2) ^ 1]);
            this._dcSet.push([(c1.eq << 2) ^ 3, (c2.eq << 2) ^ 3]);
            this._dcSet.push([(c1.eq << 2) ^ 3, (c2.lt << 2) ^ 3]);
            this._dcSet.push([(c1.gt << 2) ^ 3, (c2.gt << 2) ^ 1]);
            this._dcSet.push([(c1.gt << 2) ^ 3, (c2.eq << 2) ^ 3]);
            this._dcSet.push([(c1.gt << 2) ^ 3, (c2.lt << 2) ^ 3]);
        }
    }
    getExpression(v) {
        return this._expressions.get(v);
    }
    getIsNullRelations(v) {
        return this._isNullRelations.get(v);
    }
    isIsNull(v) {
        return this._isNullVars.has(v);
    }
    getDcSet(minterms) {
        if (!minterms)
            return this._dcSet;
        const vars = new Set(minterms.flat().map((v) => v >> 2));
        for (const comps of this._comparisons.values()) {
            for (const comp of comps.values()) {
                const c = Object.values(comp).filter((v) => !vars.has(v));
                if (c.length === 1)
                    vars.add(c[0]);
            }
        }
        for (const n of this._isNullVars)
            if (this._isNullRelations.get(n).some((v) => vars.has(v)))
                vars.add(n);
        const dcSet = this._dcSet.filter((m) => m.every((v) => vars.has(v >> 2)));
        return dcSet;
    }
}
function sanitizeMinterms(minterms, context) {
    const res = [];
    loop: for (const m of minterms) {
        const merged = new Map();
        for (const i of m)
            merged.set(i >> 2, (merged.get(i >> 2) || 0) | (1 << (i & 3)));
        const minterm = [];
        const perms = [];
        for (const [k, v] of merged) {
            if (v === 0b1010)
                continue loop;
            const isNullVars = context.getIsNullRelations(k);
            const t = k << 2;
            if (v === 0b0101) {
                if (isNullVars.length === 1)
                    minterm.push((isNullVars[0] << 2) ^ 3);
                else
                    perms.push(isNullVars.map((n) => (n << 2) ^ 3));
            }
            else if (v === 0b0001) {
                perms.push([...isNullVars.map((n) => (n << 2) ^ 3), t ^ 3]);
            }
            else if (v === 0b0100) {
                perms.push([...isNullVars.map((n) => (n << 2) ^ 3), t ^ 1]);
            }
            else if (v & 0b1000) {
                minterm.push(t ^ 3);
            }
            else if (v & 0b0010) {
                minterm.push(t ^ 1);
            }
        }
        let ms = [minterm];
        while (perms.length) {
            const newMs = [];
            const perm = perms.pop();
            for (const p of perm)
                newMs.push(...ms.map((mm) => [...mm, p]));
            ms = newMs;
        }
        res.push(...ms);
    }
    return res;
}
function boolExprSynthToExpression(boolExpr) {
    const context = new SynthContext();
    let minterms = boolExpr.true(context);
    minterms = sanitizeMinterms(minterms, context);
    const canRaise = getCanRaiseCallback(context);
    const dcSet = context.getDcSet(minterms);
    minterms = espresso(minterms, dcSet, { canRaise });
    return sopToExpression(minterms, context);
}
function mapCallback(exp) {
    if (!Array.isArray(exp))
        return exp;
    if (exp[0] === "CASE") {
        exp = exp.slice();
        for (let i = 1; i < exp.length; i += 2)
            exp[i] = toBoolExprSynth(exp[i]);
        return exp;
    }
    const op = exp[0];
    if (op === "IS NULL")
        return new IsNullSynth(toBoolExprSynth(exp[1]));
    if (op === "IS NOT NULL") {
        return new NotSynth(new IsNullSynth(toBoolExprSynth(exp[1])));
    }
    else if (op === "NOT") {
        return new NotSynth(toBoolExprSynth(exp[1]));
    }
    else if (op === "OR") {
        return new OrSynth(...exp.slice(1).map((a) => toBoolExprSynth(a)));
    }
    else if (op === "AND") {
        return new AndSynth(...exp.slice(1).map((a) => toBoolExprSynth(a)));
    }
    for (let i = 1; i < exp.length; ++i) {
        if (exp[i] instanceof BoolExprSynth) {
            exp[i] = boolExprSynthToExpression(exp[i]);
        }
        else if (Array.isArray(exp[i]) && exp[i][0] === "CASE") {
            for (let j = 2; j < exp[i].length; j += 2) {
                if (exp[i][j] instanceof BoolExprSynth)
                    exp[i][j] = boolExprSynthToExpression(exp[i][j]);
            }
        }
    }
    return exp;
}
function getCanRaiseCallback(context) {
    return (idx, set) => {
        const i = idx >> 2;
        const vars = context.getIsNullRelations(i);
        if (!context.isIsNull(i))
            return !(idx & 1) || !set.has(idx ^ 3);
        for (const k of vars) {
            if (set.has((k << 2) ^ 1))
                continue;
            if (set.has((k << 2) ^ 3))
                continue;
            if (set.has((k << 2) ^ 0))
                return false;
            if (set.has((k << 2) ^ 2))
                return false;
        }
        return true;
    };
}
export function minimize(expr, boolean = false) {
    expr = normalize(expr);
    expr = map(expr, mapCallback);
    if (Array.isArray(expr) && expr[0] === "CASE") {
        if (!boolean) {
            const context = new SynthContext();
            const whens = expr.filter((e, i) => i % 2).map((e) => e.true(context));
            const caseDcSet = [];
            const canRaise = getCanRaiseCallback(context);
            const res = ["CASE"];
            for (let i = 1; i < expr.length; i += 2) {
                let minterms = sanitizeMinterms(whens[(i - 1) / 2], context);
                const dcSet = context.getDcSet(minterms.concat(caseDcSet));
                minterms = espresso(minterms, dcSet, { canRaise });
                if (!minterms.length)
                    continue;
                const w = sopToExpression(minterms, context);
                let t = expr[i + 1];
                if (t instanceof BoolExprSynth)
                    t = boolExprSynthToExpression(t);
                res.push(w, t);
                if (w === true)
                    break;
                caseDcSet.push(...minterms);
            }
            while (res[res.length - 1] == null)
                res.splice(-2);
            if (res.length < 3)
                return null;
            return res;
        }
        expr = toBoolExprSynth(expr);
    }
    if (boolean)
        expr = toBoolExprSynth(expr);
    if (expr instanceof BoolExprSynth)
        expr = boolExprSynthToExpression(expr);
    return expr;
}
export function unionDiff(expr1, expr2) {
    expr2 = normalize(expr2);
    if (!expr2)
        return [expr1, false];
    expr2 = map(expr2, mapCallback);
    if (!expr1) {
        if (Array.isArray(expr2) && expr2[0] === "CASE")
            expr2 = toBoolExprSynth(expr2);
        if (expr2 instanceof BoolExprSynth)
            expr2 = boolExprSynthToExpression(expr2);
        return [expr2, expr2];
    }
    const b2 = toBoolExprSynth(expr2);
    expr1 = normalize(expr1);
    expr1 = map(expr1, mapCallback);
    const b1 = toBoolExprSynth(expr1);
    const context = new SynthContext();
    const expr2Minterms = b2.true(context);
    const expr1Minterms = b1.true(context);
    const expr1NullMinterms = b1.null(context);
    const expr1FalseMinterms = b1.false(context);
    const unionMinterms = sanitizeMinterms([...expr1Minterms, ...expr2Minterms], context);
    const diffMinterms = sanitizeMinterms(complement([
        ...complement([...expr1NullMinterms, ...expr1FalseMinterms]),
        ...complement(expr2Minterms),
    ]), context);
    const canRaise = getCanRaiseCallback(context);
    const union = espresso(unionMinterms, context.getDcSet(unionMinterms), {
        canRaise,
    });
    const diff = espresso(diffMinterms, context.getDcSet(diffMinterms), {
        canRaise,
    });
    return [sopToExpression(union, context), sopToExpression(diff, context)];
}
export function covers(expr1, expr2) {
    expr2 = normalize(expr2);
    if (!expr2)
        return true;
    expr1 = normalize(expr1);
    if (!Array.isArray(expr1))
        return !!expr1;
    expr1 = map(expr1, mapCallback);
    const b1 = toBoolExprSynth(expr1);
    expr2 = map(expr2, mapCallback);
    const b2 = toBoolExprSynth(expr2);
    const context = new SynthContext();
    const expr1Minterms = b1.true(context);
    const expr2Minterms = b2.true(context);
    return tautology([
        ...complement(expr2Minterms),
        ...context.getDcSet(),
        ...expr1Minterms,
    ]);
}
