/* ---------------- Firebase 初始化 ---------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getDatabase,
    ref,
    get,
    set,
    update,
    remove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:xxxxxxxxxxxxxx"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ---------------- 数据路径（全新结构） ---------------- */
const PATH = {
    reagents: "reagents",
    discontinued: "discontinued",
    groups: "groups",
    history: "history"
};

/* ---------------- 通用读写封装 ---------------- */
async function readData(path) {
    const snapshot = await get(ref(db, path));
    return snapshot.exists() ? snapshot.val() : null;
}

async function writeData(path, obj) {
    await set(ref(db, path), obj);
}

async function updateData(path, obj) {
    await update(ref(db, path), obj);
}

async function deleteData(path) {
    await remove(ref(db, path));
}

/* ---------------- 模块配置（统一结构） ---------------- */
const modules = {
    reagents: {
        tableId: "table-reagents",
        path: PATH.reagents,
        uploadColIndex: 6,
        hasUploadCol: true
    },
    discontinued: {
        tableId: "table-discontinued",
        path: PATH.discontinued,
        uploadColIndex: 3,
        hasUploadCol: true
    },
    groups: {
        tableId: "table-groups",
        path: PATH.groups,
        hasUploadCol: false
    },
    history: {
        tableId: "table-history",
        path: PATH.history,
        hasUploadCol: false
    }
};

/* ---------------- 页面切换 ---------------- */
function switchPage(pageId) {
    document.querySelectorAll("#sidebar li").forEach(li => {
        li.classList.toggle("active", li.dataset.page === pageId);
    });
    document.querySelectorAll(".page").forEach(p => {
        p.classList.toggle("active", p.id === pageId);
    });
}

document.querySelectorAll("#sidebar li").forEach(li => {
    li.addEventListener("click", () => {
        switchPage(li.dataset.page);
    });
});
/* ---------------- 表格渲染（loadModule） ---------------- */

async function loadModule(name) {
    const cfg = modules[name];
    const table = document.getElementById(cfg.tableId);
    const tbody = table.querySelector("tbody");
    const theadRow = table.querySelector("thead tr");

    const data = await readData(cfg.path);
    tbody.innerHTML = "";

    if (!data) {
        enableColumnResize(table);
        enableRowResize(table);
        return;
    }

    const ids = Object.keys(data);
    ids.forEach((id, idx) => {
        const row = data[id];
        const tr = document.createElement("tr");
        tr.dataset.id = id;

        const ths = theadRow.children;
        for (let i = 0; i < ths.length; i++) {
            const td = document.createElement("td");

            /* 序号列 */
            if (i === 0) {
                td.contentEditable = false;
                td.textContent = idx + 1;

                const spanMenu = document.createElement("span");
                spanMenu.textContent = "▼";
                spanMenu.className = "row-menu-btn";
                spanMenu.addEventListener("click", (e) => {
                    e.stopPropagation();
                    openRowMenu(e, tr, name);
                });
                td.appendChild(spanMenu);
            }

            /* 上传列 */
            else if (cfg.hasUploadCol && i === cfg.uploadColIndex) {
                td.contentEditable = false;

                const uploadBtn = document.createElement("button");
                uploadBtn.textContent = "上传";
                uploadBtn.className = "upload-btn";
                uploadBtn.addEventListener("click", () => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "*/*";
                    input.onchange = (e) =>
                        handleUpload(name, id, i, e.target.files[0]);
                    input.click();
                });
                td.appendChild(uploadBtn);

                const val = row[`col${i}`];

                if (val) {
                    if (val.startsWith("data:image")) {
                        const img = document.createElement("img");
                        img.src = val;
                        img.onclick = () => window.open(val, "_blank");
                        td.appendChild(img);
                    } else {
                        const link = document.createElement("a");
                        link.href = val;
                        link.textContent = row.filename || "附件";
                        link.download = row.filename || "附件";
                        link.className = "file-link";
                        td.appendChild(link);
                    }

                    const delBtn = document.createElement("button");
                    delBtn.textContent = "删除";
                    delBtn.className = "delete-file-btn";
                    delBtn.addEventListener("click", () =>
                        deleteUpload(name, id, i)
                    );
                    td.appendChild(delBtn);
                }
            }

            /* 普通文本列 */
            else {
                td.contentEditable = true;
                td.textContent = row[`col${i}`] || "";
                td.addEventListener("input", () => saveRow(name, id, tr));
            }

            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    });

    enableColumnResize(table);
    enableRowResize(table);
}
/* ---------------- 保存行 ---------------- */
async function saveRow(name, id, tr) {
    const cfg = modules[name];
    const tds = tr.children;
    const rowData = {};

    for (let i = 1; i < tds.length; i++) {
        if (cfg.hasUploadCol && i === cfg.uploadColIndex) continue;
        rowData[`col${i}`] = tds[i].textContent.trim();
    }

    const old = await readData(cfg.path);
    const oldRow = old && old[id] ? old[id] : {};

    if (cfg.hasUploadCol && oldRow[`col${cfg.uploadColIndex}`]) {
        rowData[`col${cfg.uploadColIndex}`] = oldRow[`col${cfg.uploadColIndex}`];
        if (oldRow.filename) rowData.filename = oldRow.filename;
    }

    await updateData(`${cfg.path}/${id}`, rowData);
}

/* ---------------- 新增行 ---------------- */
async function addRow(name) {
    const cfg = modules[name];
    const table = document.getElementById(cfg.tableId);
    const theadRow = table.querySelector("thead tr");
    const colCount = theadRow.children.length;

    const id = "id" + Date.now();
    const rowData = {};

    for (let i = 1; i < colCount; i++) {
        rowData[`col${i}`] = "";
    }

    await set(ref(db, `${cfg.path}/${id}`), rowData);
    await loadModule(name);
}

/* ---------------- 删除行 ---------------- */
async function deleteRow(name, tr) {
    const cfg = modules[name];
    const id = tr.dataset.id;
    if (!id) return;

    await remove(ref(db, `${cfg.path}/${id}`));
    await loadModule(name);
}
/* ---------------- 新增列 ---------------- */
async function addColumn(name) {
    const cfg = modules[name];
    const table = document.getElementById(cfg.tableId);
    const theadRow = table.querySelector("thead tr");

    const colName = prompt("请输入新列名称：", "新列");
    if (!colName) return;

    const th = document.createElement("th");
    th.textContent = colName;

    const span = document.createElement("span");
    span.textContent = "▼";
    span.className = "col-menu-btn";
    span.addEventListener("click", (e) => {
        e.stopPropagation();
        openColMenu(e, th, name);
    });

    th.appendChild(span);
    theadRow.appendChild(th);

    const data = await readData(cfg.path);
    if (data) {
        const updates = {};
        const newIndex = theadRow.children.length - 1;

        Object.keys(data).forEach(id => {
            const row = data[id] || {};
            row[`col${newIndex}`] = "";
            updates[id] = row;
        });

        await updateData(cfg.path, updates);
    }

    await loadModule(name);
}

/* ---------------- 删除列 ---------------- */
async function deleteColumn(name, th) {
    const cfg = modules[name];
    const table = document.getElementById(cfg.tableId);
    const theadRow = table.querySelector("thead tr");

    const index = Array.from(theadRow.children).indexOf(th);
    if (index <= 0) return;

    if (cfg.hasUploadCol && index === cfg.uploadColIndex) {
        alert("上传列不允许删除");
        return;
    }

    theadRow.children[index].remove();

    table.querySelectorAll("tbody tr").forEach(tr => {
        if (tr.children[index]) tr.children[index].remove();
    });

    const data = await readData(cfg.path);
    if (data) {
        const updates = {};

        Object.keys(data).forEach(id => {
            const row = data[id] || {};
            delete row[`col${index}`];
            updates[id] = row;
        });

        await updateData(cfg.path, updates);
    }

    enableColumnResize(table);
    enableRowResize(table);
}
/* ---------------- 上传文件 ---------------- */
async function handleUpload(name, id, colIndex, file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result;

        const cfg = modules[name];
        const rowRef = ref(db, `${cfg.path}/${id}`);

        const rowData = {
            [`col${colIndex}`]: base64,
            filename: file.name
        };

        await update(rowRef, rowData);
        await loadModule(name);
    };

    reader.readAsDataURL(file);
}

/* ---------------- 删除上传文件 ---------------- */
async function deleteUpload(name, id, colIndex) {
    const cfg = modules[name];
    const rowRef = ref(db, `${cfg.path}/${id}`);

    const rowData = {
        [`col${colIndex}`]: "",
        filename: ""
    };

    await update(rowRef, rowData);
    await loadModule(name);
}
/* ---------------- 搜索功能 ---------------- */
function setupSearch(moduleName, inputId) {
    const input = document.getElementById(inputId);
    const cfg = modules[moduleName];
    const table = document.getElementById(cfg.tableId);

    input.addEventListener("input", () => {
        const keyword = input.value.trim().toLowerCase();
        const rows = table.querySelectorAll("tbody tr");

        rows.forEach(tr => {
            const text = tr.textContent.toLowerCase();
            tr.style.display = text.includes(keyword) ? "" : "none";
        });
    });
}

setupSearch("reagents", "search-reagents");
setupSearch("groups", "search-groups");
setupSearch("discontinued", "search-discontinued");
setupSearch("history", "search-history");

/* ---------------- 统计功能 ---------------- */
async function updateStats() {
    const data = await readData(PATH.reagents);

    let total = 0;
    let withImage = 0;
    let noImage = 0;

    if (data) {
        Object.values(data).forEach(row => {
            total++;
            if (row.col6) withImage++;
            else noImage++;
        });
    }

    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-with-image").textContent = withImage;
    document.getElementById("stat-no-image").textContent = noImage;
}
/* ---------------- 列宽拖拽 ---------------- */
function enableColumnResize(table) {
    const ths = table.querySelectorAll("thead th");

    ths.forEach(th => {
        let resizer = th.querySelector(".col-resizer");
        if (!resizer) {
            resizer = document.createElement("div");
            resizer.className = "col-resizer";
            th.appendChild(resizer);
        }

        let startX, startWidth;

        resizer.onmousedown = (e) => {
            e.preventDefault();
            startX = e.pageX;
            startWidth = th.offsetWidth;

            document.onmousemove = (ev) => {
                const diff = ev.pageX - startX;
                const newWidth = Math.max(40, startWidth + diff);
                th.style.width = newWidth + "px";
            };

            document.onmouseup = () => {
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
    });
}

/* ---------------- 行高拖拽 ---------------- */
function enableRowResize(table) {
    const trs = table.querySelectorAll("tbody tr");

    trs.forEach(tr => {
        let resizer = tr.querySelector(".row-resizer");
        if (!resizer) {
            resizer = document.createElement("div");
            resizer.className = "row-resizer";
            tr.appendChild(resizer);
        }

        let startY, startHeight;

        resizer.onmousedown = (e) => {
            e.preventDefault();
            startY = e.pageY;
            startHeight = tr.offsetHeight;

            document.onmousemove = (ev) => {
                const diff = ev.pageY - startY;
                const newHeight = Math.max(24, startHeight + diff);
                tr.style.height = newHeight + "px";
            };

            document.onmouseup = () => {
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
    });
}
/* ---------------- 行菜单 / 列菜单 ---------------- */
const colMenu = document.getElementById("colMenu");
const rowMenu = document.getElementById("rowMenu");

let currentColTarget = null;
let currentRowTarget = null;

function openColMenu(e, th, moduleName) {
    currentColTarget = { th, moduleName };
    colMenu.style.display = "block";
    colMenu.style.left = e.pageX + "px";
    colMenu.style.top = e.pageY + "px";
}

function openRowMenu(e, tr, moduleName) {
    currentRowTarget = { tr, moduleName };
    rowMenu.style.display = "block";
    rowMenu.style.left = e.pageX + "px";
    rowMenu.style.top = e.pageY + "px";
}

colMenu.addEventListener("click", async (e) => {
    const action = e.target.dataset.menu;

    if (action === "delete-col" && currentColTarget) {
        await deleteColumn(currentColTarget.moduleName, currentColTarget.th);
        colMenu.style.display = "none";
        currentColTarget = null;
    }
});

rowMenu.addEventListener("click", async (e) => {
    const action = e.target.dataset.menu;

    if (action === "delete-row" && currentRowTarget) {
        await deleteRow(currentRowTarget.moduleName, currentRowTarget.tr);
        rowMenu.style.display = "none";
        currentRowTarget = null;
    }
});

document.addEventListener("click", (e) => {
    if (colMenu.style.display === "block" &&
        !colMenu.contains(e.target) &&
        !e.target.classList.contains("col-menu-btn")) {
        colMenu.style.display = "none";
        currentColTarget = null;
    }

    if (rowMenu.style.display === "block" &&
        !rowMenu.contains(e.target) &&
        !e.target.classList.contains("row-menu-btn")) {
        rowMenu.style.display = "none";
        currentRowTarget = null;
    }
});
/* ---------------- 初始化 ---------------- */
async function init() {
    await loadModule("reagents");
    await loadModule("discontinued");
    await loadModule("groups");
    await loadModule("history");

    await updateStats();
}

init();


