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
import * as store from "./store";
import * as notifications from "./notifications";
import { getIcon } from "./icons";
import { clear, commit, deleteTask, getQueue, getStaging, queueTask, } from "./task-queue";
const invalid = new WeakSet();
function mparam(param) {
    return m("span.parameter", { title: param }, `${param}`);
}
function mval(val) {
    return m("span.value", { title: val }, `${val}`);
}
function renderStagingSpv(task, queueFunc, cancelFunc) {
    function keydown(e) {
        if (e.key === "Enter")
            queueFunc();
        else if (e.key === "Escape")
            cancelFunc();
        else
            e["redraw"] = false;
    }
    let input;
    if (task.parameterValues[0][2] === "xsd:boolean") {
        input = m("select", {
            value: task.parameterValues[0][1].toString(),
            onchange: (e) => {
                e.redraw = false;
                task.parameterValues[0][1] = input.dom.value;
            },
            onkeydown: keydown,
            oncreate: (vnode) => {
                vnode.dom.focus();
            },
        }, [
            m("option", { value: "true" }, "true"),
            m("option", { value: "false" }, "false"),
        ]);
    }
    else {
        const type = task.parameterValues[0][2];
        let value = task.parameterValues[0][1];
        if (type === "xsd:dateTime" && typeof value === "number")
            value = new Date(value).toJSON() || value;
        input = m("input", {
            type: ["xsd:int", "xsd:unsignedInt"].includes(type) ? "number" : "text",
            value: value,
            oninput: (e) => {
                e.redraw = false;
                task.parameterValues[0][1] = input.dom.value;
            },
            onkeydown: keydown,
            oncreate: (vnode) => {
                vnode.dom.focus();
                vnode.dom.select();
                // Need to prevent scrolling on focus because
                // we're animating height and using overflow: hidden
                vnode.dom.parentNode.parentNode.scrollTop = 0;
            },
        });
    }
    return [m("span", "Editing ", mparam(task.parameterValues[0][0])), input];
}
function renderStagingDownload(task) {
    if (!task.fileName || !task.fileType)
        invalid.add(task);
    else
        invalid.delete(task);
    const files = store.fetch("files", true);
    let oui = "";
    let productClass = "";
    for (const d of task.devices) {
        const parts = d.split("-");
        if (oui === "")
            oui = parts[0];
        else if (oui !== parts[0])
            oui = null;
        if (parts.length === 3) {
            if (productClass === "")
                productClass = parts[1];
            else if (productClass !== parts[1])
                productClass = null;
        }
    }
    if (oui)
        oui = decodeURIComponent(oui);
    if (productClass)
        productClass = decodeURIComponent(productClass);
    const typesList = [
        ...new Set([
            "",
            "1 Firmware Upgrade Image",
            "2 Web Content",
            "3 Vendor Configuration File",
            "4 Tone File",
            "5 Ringer File",
            ...files.value.map((f) => f["metadata.fileType"]).filter((f) => f),
        ]),
    ].map((t) => m("option", { disabled: !t, value: t, selected: (task.fileType || "") === t }, t));
    const filesList = [""]
        .concat(files.value
        .filter((f) => (!f["metadata.oui"] || f["metadata.oui"] === oui) &&
        (!f["metadata.productClass"] ||
            f["metadata.productClass"] === productClass))
        .map((f) => f._id))
        .map((f) => m("option", { disabled: !f, value: f, selected: (task.fileName || "") === f }, f));
    return [
        "Push ",
        m("select", {
            onchange: (e) => {
                const f = e.target.value;
                task.fileName = f;
                task.fileType = "";
                for (const file of files.value)
                    if (file._id === f)
                        task.fileType = file["metadata.fileType"];
            },
            disabled: files.fulfilling,
            style: "width: 350px",
        }, filesList),
        " as ",
        m("select", {
            onchange: (e) => {
                task.fileType = e.target.value;
            },
        }, typesList),
    ];
}
function renderStaging(staging) {
    const elements = [];
    for (const s of staging) {
        const queueFunc = () => {
            staging.delete(s);
            for (const d of s.devices) {
                const t = Object.assign({ device: d }, s);
                delete t.devices;
                queueTask(t);
            }
        };
        const cancelFunc = () => {
            staging.delete(s);
        };
        let elms;
        if (s.name === "setParameterValues")
            elms = renderStagingSpv(s, queueFunc, cancelFunc);
        else if (s.name === "download")
            elms = renderStagingDownload(s);
        const queue = m("button.primary", { title: "Queue task", onclick: queueFunc, disabled: invalid.has(s) }, "Queue");
        const cancel = m("button", { title: "Cancel edit", onclick: cancelFunc }, "Cancel");
        elements.push(m(".staging", elms, m("div.actions", queue, cancel)));
    }
    return elements;
}
function renderQueue(queue) {
    const details = [];
    const devices = {};
    for (const t of queue) {
        devices[t.device] = devices[t.device] || [];
        devices[t.device].push(t);
    }
    for (const [k, v] of Object.entries(devices)) {
        details.push(m("strong", k));
        for (const t of v) {
            const actions = [];
            if (t.status === "fault" || t.status === "stale") {
                actions.push(m("button", {
                    title: "Retry this task",
                    onclick: () => {
                        queueTask(t);
                    },
                }, getIcon("retry")));
            }
            actions.push(m("button", {
                title: "Remove this task",
                onclick: () => {
                    deleteTask(t);
                },
            }, getIcon("remove")));
            if (t.name === "setParameterValues") {
                details.push(m(`div.${t.status}`, m("span", "Set ", mparam(t.parameterValues[0][0]), " to '", mval(t.parameterValues[0][1]), "'"), m(".actions", actions)));
            }
            else if (t.name === "refreshObject") {
                details.push(m(`div.${t.status}`, m("span", "Refresh ", mparam(t.parameterName)), m(".actions", actions)));
            }
            else if (t.name === "reboot") {
                details.push(m(`div.${t.status}`, "Reboot", m(".actions", actions)));
            }
            else if (t.name === "factoryReset") {
                details.push(m(`div.${t.status}`, "Factory reset", m(".actions", actions)));
            }
            else if (t.name === "addObject") {
                details.push(m(`div.${t.status}`, m("span", "Add ", mparam(t.objectName)), m(".actions", actions)));
            }
            else if (t.name === "deleteObject") {
                details.push(m(`div.${t.status}`, m("span", "Delete ", mparam(t.objectName)), m(".actions", actions)));
            }
            else if (t.name === "getParameterValues") {
                details.push(m(`div.${t.status}`, `Refresh ${t.parameterNames.length} parameters`, m(".actions", actions)));
            }
            else if (t.name === "download") {
                details.push(m(`div.${t.status}`, `Push file: ${t.fileName} (${t.fileType})`, m(".actions", actions)));
            }
            else {
                details.push(m(`div.${t.status}`, t.name, m(".actions", actions)));
            }
        }
    }
    return details;
}
function renderNotifications(notifs) {
    const notificationElements = [];
    for (const n of notifs) {
        let buttons;
        if (n.actions) {
            const btns = Object.entries(n.actions).map(([label, onclick]) => m("button.primary", { onclick: onclick }, label));
            if (btns.length)
                buttons = m("div", { style: "float: right" }, btns);
        }
        notificationElements.push(m("div.notification", {
            class: n.type,
            style: "position: absolute;opacity: 0",
            oncreate: (vnode) => {
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
            key: n.timestamp,
        }, m("div", buttons, n.message)));
    }
    return notificationElements;
}
const component = () => {
    return {
        view: (vnode) => {
            const queue = getQueue();
            const staging = getStaging();
            const notifs = notifications.getNotifications();
            let drawerElement, statusElement;
            const notificationElements = renderNotifications(notifs);
            const stagingElements = renderStaging(staging);
            const queueElements = renderQueue(queue);
            function repositionNotifications() {
                let top = 10;
                for (const c of notificationElements) {
                    c.dom.style.top = `${top}px`;
                    top += c.dom.offsetHeight + 10;
                }
            }
            function resizeDrawer() {
                let height = statusElement.dom.offsetTop + statusElement.dom.offsetHeight;
                if (stagingElements.length) {
                    for (const s of stagingElements) {
                        height = Math.max(height, s.dom.offsetTop +
                            s.dom.offsetHeight);
                    }
                }
                else if (vnode.state["mouseIn"]) {
                    for (const c of drawerElement.children)
                        height = Math.max(height, c.dom.offsetTop + c.dom.offsetHeight);
                }
                drawerElement.dom.style.height = height + "px";
            }
            if (stagingElements.length + queueElements.length) {
                const statusCount = { queued: 0, pending: 0, fault: 0, stale: 0 };
                for (const t of queue)
                    statusCount[t["status"]] += 1;
                const actions = m(".actions", m("button.primary", {
                    title: "Commit queued tasks",
                    disabled: !statusCount.queued,
                    onclick: () => {
                        const tasks = Array.from(getQueue()).filter((t) => t["status"] === "queued");
                        commit(tasks, (deviceId, err, connectionRequestStatus, tasks2) => {
                            if (err) {
                                notifications.push("error", `${deviceId}: ${err.message}`);
                                return;
                            }
                            if (connectionRequestStatus !== "OK") {
                                notifications.push("error", `${deviceId}: ${connectionRequestStatus}`);
                                return;
                            }
                            for (const t of tasks2) {
                                if (t.status === "stale") {
                                    notifications.push("error", `${deviceId}: No contact from device`);
                                    return;
                                }
                                else if (t.status === "fault") {
                                    notifications.push("error", `${deviceId}: Task(s) faulted`);
                                    return;
                                }
                            }
                            notifications.push("success", `${deviceId}: Task(s) committed`);
                        })
                            .then(() => {
                            store.setTimestamp(Date.now());
                        })
                            .catch((err) => {
                            notifications.push("error", err.message);
                        });
                    },
                }, "Commit"), m("button", {
                    title: "Clear tasks",
                    onclick: clear,
                    disabled: !queueElements.length,
                }, "Clear"));
                statusElement = m(".status", m("span.queued", { class: statusCount.queued ? "active" : "" }, `Queued: ${statusCount.queued}`), m("span.pending", { class: statusCount.pending ? "active" : "" }, `Pending: ${statusCount.pending}`), m("span.fault", { class: statusCount.fault ? "active" : "" }, `Fault: ${statusCount.fault}`), m("span.stale", { class: statusCount.stale ? "active" : "" }, `Stale: ${statusCount.stale}`), actions);
                drawerElement = m(".drawer", {
                    key: "drawer",
                    style: "opacity: 0;height: 0;",
                    oncreate: (vnode2) => {
                        vnode.state["mouseIn"] = false;
                        vnode2.dom.style.opacity = "1";
                        resizeDrawer();
                    },
                    onmouseover: (e) => {
                        vnode.state["mouseIn"] = true;
                        resizeDrawer();
                        e.redraw = false;
                    },
                    onmouseleave: (e) => {
                        vnode.state["mouseIn"] = false;
                        resizeDrawer();
                        e.redraw = false;
                    },
                    onupdate: resizeDrawer,
                    onbeforeremove: (vnode2) => {
                        vnode2.dom.onmouseover = null;
                        vnode2.dom.onmouseleave = null;
                        vnode2.dom.style.opacity = "0";
                        vnode2.dom.style.height = "0";
                        return new Promise((resolve) => {
                            setTimeout(resolve, 500);
                        });
                    },
                }, statusElement, stagingElements.length ? stagingElements : m(".queue", queueElements));
            }
            return m("div.drawer-wrapper", drawerElement, m("div.notifications-wrapper", {
                key: "notifications",
                style: "position: relative;",
                onupdate: repositionNotifications,
                oncreate: repositionNotifications,
            }, notificationElements));
        },
    };
};
export default component;
