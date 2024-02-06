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
import m from "mithril";
let overlayCallback = null;
let closeCallback = null;
export function open(callback, closeCb = null) {
    overlayCallback = callback;
    closeCallback = closeCb;
}
export function close(callback, force = true) {
    if (callback === overlayCallback) {
        if (!force && closeCallback && !closeCallback())
            return false;
        overlayCallback = null;
        closeCallback = null;
        return true;
    }
    return false;
}
export function render() {
    if (overlayCallback) {
        return m(".overlay-wrapper", {
            tabindex: 0,
            onclick: () => {
                close(overlayCallback, false);
            },
            style: "opacity: 0",
            oncreate: (vnode) => {
                vnode.dom.focus();
                vnode.dom.style.opacity = "1";
            },
            onbeforeremove: (vnode) => {
                vnode.dom.style.opacity = "0";
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve();
                    }, 500);
                });
            },
        }, m(".overlay", {
            onclick: (e) => {
                e.stopPropagation();
            },
        }, overlayCallback()));
    }
    return null;
}
document.addEventListener("keydown", (e) => {
    if (overlayCallback && e.key === "Escape" && close(overlayCallback, false))
        m.redraw();
});
window.addEventListener("popstate", () => {
    if (close(overlayCallback, false))
        m.redraw();
});
