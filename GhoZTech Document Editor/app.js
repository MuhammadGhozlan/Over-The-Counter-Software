(function () {
  "use strict";

  const STORAGE_KEY = "ghoztech-document-editor-state-v1";
  const DATA_ENDPOINT = "api/documents";
  const DATA_FILE_NAME = "documents-data.json";

  const TEMPLATES = {
    blank: {
      title: "Untitled Document",
      html: "<p></p>"
    },
    letter: {
      title: "Business Letter",
      html: "<p>Your Name<br>Street Address<br>City, State ZIP</p><p>Date</p><p>Recipient Name<br>Recipient Title<br>Company</p><p>Dear Recipient,</p><p>Write your letter here. Keep the purpose clear, the details organized, and the closing direct.</p><p>Sincerely,<br>Your Name</p>"
    },
    meeting: {
      title: "Meeting Notes",
      html: "<h1>Meeting Notes</h1><p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><h2>Agenda</h2><ul><li>Topic one</li><li>Topic two</li></ul><h2>Decisions</h2><p></p><h2>Action Items</h2><table><tbody><tr><th>Task</th><th>Owner</th><th>Due</th></tr><tr><td></td><td></td><td></td></tr></tbody></table>"
    },
    proposal: {
      title: "Project Proposal",
      html: "<h1>Project Proposal</h1><p><strong>Prepared for:</strong> </p><p><strong>Prepared by:</strong> GhoZTech</p><h2>Overview</h2><p>Describe the opportunity, problem, or request.</p><h2>Scope</h2><ul><li>Deliverable one</li><li>Deliverable two</li><li>Deliverable three</li></ul><h2>Timeline</h2><p>Summarize milestones and dates.</p><h2>Investment</h2><p>List pricing, payment terms, or budget assumptions.</p>"
    }
  };

  const DEFAULT_STATE = {
    theme: "light",
    currentDocumentId: "doc-welcome",
    documents: [
      {
        id: "doc-welcome",
        title: "Welcome to GhoZTech Document Editor",
        html: "<h1>Welcome to GhoZTech Document Editor</h1><p>This local editor gives you a Microsoft Word-style writing workspace with document storage, formatting tools, templates, printing, and export options.</p><h2>Start here</h2><ul><li>Use the toolbar to format text.</li><li>Create documents from the sidebar.</li><li>Open the app with launch.bat to save to documents-data.json.</li></ul><p>Your documents stay on this computer unless you export or share them.</p>",
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T00:00:00.000Z",
        pageSize: "letter",
        margin: "normal",
        zoom: "1"
      }
    ]
  };

  let state = loadBrowserState();
  let currentDocument = null;
  let storageMode = "browser";
  let fileSaveTimer = null;
  let toastTimer = null;
  let currentMatchIndex = -1;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    document.execCommand("styleWithCSS", false, true);
    bindEvents();
    applyTheme();
    loadCurrentDocument();
    renderAll();
    await hydrateFromFileStorage();
    registerServiceWorker();
  }

  function bindEvents() {
    $("#newDocument").addEventListener("click", () => createDocument("blank"));
    $("#duplicateDocument").addEventListener("click", duplicateDocument);
    $("#documentSearch").addEventListener("input", renderDocumentList);
    $("#documentTitle").addEventListener("input", handleTitleInput);
    $("#editor").addEventListener("input", handleEditorInput);
    $("#editor").addEventListener("keyup", updateSelectionMeta);
    $("#editor").addEventListener("mouseup", updateSelectionMeta);
    $("#saveNow").addEventListener("click", () => {
      persistCurrentDocument();
      saveState();
      showToast("Document saved.");
    });
    $("#themeToggle").addEventListener("click", toggleTheme);
    $("#printDocument").addEventListener("click", () => window.print());
    $("#deleteDocument").addEventListener("click", deleteCurrentDocument);
    $("#blockFormat").addEventListener("change", (event) => runCommand("formatBlock", event.target.value));
    $("#fontName").addEventListener("change", (event) => runCommand("fontName", event.target.value));
    $("#fontSize").addEventListener("change", (event) => runCommand("fontSize", event.target.value));
    $("#foreColor").addEventListener("input", (event) => runCommand("foreColor", event.target.value));
    $("#hiliteColor").addEventListener("input", (event) => runCommand("hiliteColor", event.target.value));
    $("#insertTable").addEventListener("click", insertTable);
    $("#insertLink").addEventListener("click", insertLink);
    $("#insertImage").addEventListener("click", () => $("#imageFile").click());
    $("#imageFile").addEventListener("change", insertImage);
    $("#findReplaceToggle").addEventListener("click", toggleFindPanel);
    $("#findNext").addEventListener("click", findNext);
    $("#replaceNext").addEventListener("click", replaceNext);
    $("#replaceAll").addEventListener("click", replaceAll);
    $("#pageSize").addEventListener("change", (event) => updatePageSetting("pageSize", event.target.value));
    $("#pageMargin").addEventListener("change", (event) => updatePageSetting("margin", event.target.value));
    $("#zoomLevel").addEventListener("change", (event) => updatePageSetting("zoom", event.target.value));
    $("#exportHtml").addEventListener("click", exportHtml);
    $("#exportDoc").addEventListener("click", exportDoc);
    $("#exportTxt").addEventListener("click", exportTxt);

    $$("[data-command]").forEach((button) => {
      button.addEventListener("click", () => runCommand(button.dataset.command));
    });
    $$("[data-template]").forEach((button) => {
      button.addEventListener("click", () => createDocument(button.dataset.template));
    });
  }

  function loadBrowserState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? normalizeState(JSON.parse(stored)) : structuredCloneSafe(DEFAULT_STATE);
    } catch (error) {
      console.warn("Unable to load browser state.", error);
      return structuredCloneSafe(DEFAULT_STATE);
    }
  }

  function normalizeState(input) {
    const base = structuredCloneSafe(DEFAULT_STATE);
    const documents = Array.isArray(input.documents) && input.documents.length
      ? input.documents.map(normalizeDocument)
      : base.documents;
    const currentDocumentId = documents.some((doc) => doc.id === input.currentDocumentId)
      ? input.currentDocumentId
      : documents[0].id;

    return {
      theme: input.theme === "dark" ? "dark" : "light",
      currentDocumentId,
      documents
    };
  }

  function normalizeDocument(documentData) {
    const now = new Date().toISOString();
    return {
      id: documentData.id || uid("doc"),
      title: documentData.title || "Untitled Document",
      html: documentData.html || "<p></p>",
      createdAt: documentData.createdAt || now,
      updatedAt: documentData.updatedAt || now,
      pageSize: documentData.pageSize || "letter",
      margin: documentData.margin || "normal",
      zoom: String(documentData.zoom || "1")
    };
  }

  function structuredCloneSafe(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  async function hydrateFromFileStorage() {
    if (!canUseFileStorage()) {
      updateStorageStatus("Saved in browser only");
      return;
    }

    updateStorageStatus(`Checking ${DATA_FILE_NAME}`);
    try {
      const response = await fetch(DATA_ENDPOINT, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Load failed with status ${response.status}.`);
      }
      const payload = await response.json();
      storageMode = "file";

      if (payload.exists && payload.data) {
        state = normalizeState(payload.data);
        applyTheme();
        loadCurrentDocument();
        renderAll();
        showToast(`Loaded ${DATA_FILE_NAME}.`);
        return;
      }

      saveState();
      showToast(`${DATA_FILE_NAME} will store your documents.`);
    } catch (error) {
      console.warn("File-backed storage unavailable.", error);
      storageMode = "browser";
      updateStorageStatus("Saved in browser only");
    }
  }

  function canUseFileStorage() {
    return location.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1"].includes(location.hostname);
  }

  function loadCurrentDocument() {
    currentDocument = state.documents.find((doc) => doc.id === state.currentDocumentId) || state.documents[0];
    state.currentDocumentId = currentDocument.id;
  }

  function renderAll() {
    renderDocumentList();
    renderCurrentDocument();
    updateDocumentStats();
    updateStorageStatus(storageMode === "file" ? `Saved to ${DATA_FILE_NAME}` : "Saved in browser only");
  }

  function renderDocumentList() {
    const query = $("#documentSearch").value.trim().toLowerCase();
    const documents = state.documents
      .filter((doc) => {
        if (!query) return true;
        return doc.title.toLowerCase().includes(query) || stripHtml(doc.html).toLowerCase().includes(query);
      })
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    $("#documentList").innerHTML = documents.length
      ? documents.map((doc) => `
        <button class="document-item ${doc.id === state.currentDocumentId ? "is-active" : ""}" type="button" data-document-id="${escapeHtml(doc.id)}">
          <strong>${escapeHtml(doc.title)}</strong>
          <span>${escapeHtml(countWords(stripHtml(doc.html)))} words · ${escapeHtml(formatDateTime(doc.updatedAt))}</span>
        </button>
      `).join("")
      : `<div class="document-item"><strong>No documents found</strong><span>Change your search or create a new document.</span></div>`;

    $$("[data-document-id]").forEach((button) => {
      button.addEventListener("click", () => switchDocument(button.dataset.documentId));
    });
  }

  function renderCurrentDocument() {
    $("#documentTitle").value = currentDocument.title;
    $("#editor").innerHTML = currentDocument.html;
    $("#pageSize").value = currentDocument.pageSize;
    $("#pageMargin").value = currentDocument.margin;
    $("#zoomLevel").value = currentDocument.zoom;
    applyPageSettings();
  }

  function switchDocument(id) {
    persistCurrentDocument();
    state.currentDocumentId = id;
    loadCurrentDocument();
    renderAll();
    saveState();
  }

  function createDocument(templateName) {
    persistCurrentDocument();
    const template = TEMPLATES[templateName] || TEMPLATES.blank;
    const now = new Date().toISOString();
    const documentData = {
      id: uid("doc"),
      title: template.title,
      html: template.html,
      createdAt: now,
      updatedAt: now,
      pageSize: "letter",
      margin: "normal",
      zoom: "1"
    };
    state.documents.unshift(documentData);
    state.currentDocumentId = documentData.id;
    loadCurrentDocument();
    renderAll();
    saveState();
    $("#editor").focus();
    showToast("New document created.");
  }

  function duplicateDocument() {
    persistCurrentDocument();
    const copy = structuredCloneSafe(currentDocument);
    copy.id = uid("doc");
    copy.title = `${currentDocument.title} Copy`;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    state.documents.unshift(copy);
    state.currentDocumentId = copy.id;
    loadCurrentDocument();
    renderAll();
    saveState();
    showToast("Document duplicated.");
  }

  function deleteCurrentDocument() {
    if (state.documents.length === 1) {
      showToast("Create another document before deleting this one.");
      return;
    }
    if (!window.confirm("Delete this document?")) return;
    state.documents = state.documents.filter((doc) => doc.id !== currentDocument.id);
    state.currentDocumentId = state.documents[0].id;
    loadCurrentDocument();
    renderAll();
    saveState();
    showToast("Document deleted.");
  }

  function handleTitleInput() {
    currentDocument.title = $("#documentTitle").value.trim() || "Untitled Document";
    currentDocument.updatedAt = new Date().toISOString();
    renderDocumentList();
    saveState();
  }

  function handleEditorInput() {
    persistCurrentDocument();
    updateDocumentStats();
    saveState();
  }

  function persistCurrentDocument() {
    if (!currentDocument) return;
    currentDocument.title = $("#documentTitle").value.trim() || "Untitled Document";
    currentDocument.html = $("#editor").innerHTML;
    currentDocument.updatedAt = new Date().toISOString();
  }

  function saveState() {
    persistCurrentDocument();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (storageMode === "file") {
      scheduleFileSave();
      return;
    }
    updateStorageStatus("Saved in browser only");
  }

  function scheduleFileSave() {
    clearTimeout(fileSaveTimer);
    updateStorageStatus(`Saving to ${DATA_FILE_NAME}`);
    fileSaveTimer = setTimeout(saveStateToFile, 300);
  }

  async function saveStateToFile() {
    try {
      const response = await fetch(DATA_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state)
      });
      if (!response.ok) {
        throw new Error(`Save failed with status ${response.status}.`);
      }
      updateStorageStatus(`Saved to ${DATA_FILE_NAME}`);
    } catch (error) {
      console.warn("Unable to save document file.", error);
      updateStorageStatus("File save failed. Browser copy saved.");
    }
  }

  function updateStorageStatus(message) {
    $("#saveStatus").textContent = message;
    $("#storageDetail").textContent = storageMode === "file"
      ? `Automatic save file: ${DATA_FILE_NAME} in this folder.`
      : `Direct browser mode: use launch.bat for automatic ${DATA_FILE_NAME} storage.`;
  }

  function runCommand(command, value = null) {
    $("#editor").focus();
    document.execCommand(command, false, value);
    persistCurrentDocument();
    updateDocumentStats();
    saveState();
  }

  function insertTable() {
    const rows = Math.min(12, Math.max(1, Number(window.prompt("Rows", "3")) || 3));
    const columns = Math.min(8, Math.max(1, Number(window.prompt("Columns", "3")) || 3));
    let html = "<table><tbody>";
    for (let row = 0; row < rows; row += 1) {
      html += "<tr>";
      for (let column = 0; column < columns; column += 1) {
        html += row === 0 ? "<th>Header</th>" : "<td></td>";
      }
      html += "</tr>";
    }
    html += "</tbody></table><p></p>";
    runCommand("insertHTML", html);
  }

  function insertLink() {
    const url = window.prompt("Enter link URL", "https://");
    if (!url) return;
    runCommand("createLink", url);
  }

  function insertImage(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      runCommand("insertHTML", `<p><img src="${escapeAttribute(reader.result)}" alt="${escapeAttribute(file.name)}"></p>`);
      event.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  function toggleFindPanel() {
    $("#findPanel").classList.toggle("is-visible");
    if ($("#findPanel").classList.contains("is-visible")) {
      $("#findText").focus();
    }
  }

  function findNext() {
    const needle = $("#findText").value;
    if (!needle) return;
    const text = $("#editor").innerText;
    const start = currentMatchIndex + 1;
    let index = text.toLowerCase().indexOf(needle.toLowerCase(), start);
    if (index < 0) {
      index = text.toLowerCase().indexOf(needle.toLowerCase(), 0);
    }
    currentMatchIndex = index;
    if (index < 0) {
      showToast("No match found.");
      return;
    }
    selectTextRange(index, needle.length);
    showToast(`Found match at character ${index + 1}.`);
  }

  function replaceNext() {
    const needle = $("#findText").value;
    const replacement = $("#replaceText").value;
    if (!needle) return;
    findNext();
    if (currentMatchIndex >= 0) {
      document.execCommand("insertText", false, replacement);
      currentMatchIndex = Math.max(-1, currentMatchIndex - 1);
      handleEditorInput();
    }
  }

  function replaceAll() {
    const needle = $("#findText").value;
    const replacement = $("#replaceText").value;
    if (!needle) return;
    const safeNeedle = escapeRegExp(needle);
    $("#editor").innerHTML = $("#editor").innerHTML.replace(new RegExp(safeNeedle, "gi"), replacement);
    currentMatchIndex = -1;
    handleEditorInput();
    showToast("Replacement complete.");
  }

  function selectTextRange(start, length) {
    const editor = $("#editor");
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let offset = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;
    let node = walker.nextNode();

    while (node) {
      const nextOffset = offset + node.textContent.length;
      if (!startNode && start >= offset && start <= nextOffset) {
        startNode = node;
        startOffset = start - offset;
      }
      if (startNode && start + length >= offset && start + length <= nextOffset) {
        endNode = node;
        endOffset = start + length - offset;
        break;
      }
      offset = nextOffset;
      node = walker.nextNode();
    }

    if (!startNode || !endNode) return;
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function updatePageSetting(key, value) {
    currentDocument[key] = value;
    currentDocument.updatedAt = new Date().toISOString();
    applyPageSettings();
    saveState();
  }

  function applyPageSettings() {
    const pageWrap = $("#pageWrap");
    pageWrap.className = `page-wrap page-${currentDocument.pageSize} margin-${currentDocument.margin}`;
    pageWrap.style.setProperty("--zoom", currentDocument.zoom);
  }

  function updateDocumentStats() {
    const text = $("#editor").innerText || "";
    const words = countWords(text);
    const chars = text.replace(/\s/g, "").length;
    $("#documentMeta").textContent = `${words} words · ${chars} characters`;
    updateSelectionMeta();
  }

  function updateSelectionMeta() {
    const selected = String(window.getSelection() || "").trim();
    $("#selectionMeta").textContent = selected ? `${countWords(selected)} words selected` : "Ready";
  }

  function exportHtml() {
    downloadFile(`${safeFileName(currentDocument.title)}.html`, buildExportHtml(), "text/html");
  }

  function exportDoc() {
    downloadFile(`${safeFileName(currentDocument.title)}.doc`, buildExportHtml(), "application/msword");
  }

  function exportTxt() {
    downloadFile(`${safeFileName(currentDocument.title)}.txt`, $("#editor").innerText, "text/plain");
  }

  function buildExportHtml() {
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(currentDocument.title)}</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; line-height: 1.5; color: #111827; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #9ca3af; padding: 7px; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
${$("#editor").innerHTML}
</body>
</html>`;
  }

  function downloadFile(fileName, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`${fileName} exported.`);
  }

  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
    saveState();
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
  }

  function countWords(text) {
    const matches = String(text || "").trim().match(/\b[\w']+\b/g);
    return matches ? matches.length : 0;
  }

  function stripHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = html || "";
    return template.content.textContent || "";
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function uid(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  function safeFileName(name) {
    return String(name || "document")
      .replace(/[<>:"/\\|?*]+/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "document";
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").catch(() => {
        console.info("Service worker unavailable in this environment.");
      });
    }
  }
})();
