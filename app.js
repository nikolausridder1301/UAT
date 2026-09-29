const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const els = {
  tableBody: document.getElementById("issueTableBody"),
  openFormBtn: document.getElementById("openFormBtn"),
  closeFormBtn: document.getElementById("closeFormBtn"),
  cancelFormBtn: document.getElementById("cancelFormBtn"),
  formOverlay: document.getElementById("formOverlay"),
  issueForm: document.getElementById("issueForm"),
  fieldDate: document.getElementById("fieldDate"),
  fieldReportedBy: document.getElementById("fieldReportedBy"),
  fieldIssue: document.getElementById("fieldIssue"),
  fieldWhy: document.getElementById("fieldWhy"),
  fieldOwner: document.getElementById("fieldOwner"),
  fieldAgent: document.getElementById("fieldAgent"),
  pasteZone: document.getElementById("pasteZone"),
  fileInput: document.getElementById("fileInput"),
  screenshotPreview: document.getElementById("screenshotPreview"),
  submitBtn: document.getElementById("submitBtn"),
  lightbox: document.getElementById("lightbox"),
  lightboxImg: document.getElementById("lightboxImg"),
  filterReportedBy: document.getElementById("filterReportedBy"),
  filterOwner: document.getElementById("filterOwner"),
  filterAgent: document.getElementById("filterAgent"),
  filterResolved: document.getElementById("filterResolved"),
  filterResetBtn: document.getElementById("filterResetBtn"),
  resolveOverlay: document.getElementById("resolveOverlay"),
  resolveForm: document.getElementById("resolveForm"),
  resolveBy: document.getElementById("resolveBy"),
  resolveComment: document.getElementById("resolveComment"),
  resolveSubmitBtn: document.getElementById("resolveSubmitBtn"),
  closeResolveBtn: document.getElementById("closeResolveBtn"),
  cancelResolveBtn: document.getElementById("cancelResolveBtn"),
};

function autoGrow(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

let pendingFiles = []; // File objects staged for upload on submit
let allIssues = []; // zuletzt geladene Eintraege, ungefiltert
let resolvingIssueId = null;

function populateNameDropdowns() {
  els.fieldReportedBy.innerHTML = "";
  appendOptions(els.fieldReportedBy, TEAM_NAMES);

  els.fieldOwner.innerHTML = "";
  appendOptions(els.fieldOwner, LOOPS_OWNERS);

  els.fieldAgent.innerHTML = "";
  for (const agent of AGENT_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = agent;
    opt.textContent = agent;
    els.fieldAgent.appendChild(opt);
  }

  appendOptions(els.filterReportedBy, TEAM_NAMES);
  appendOptions(els.filterOwner, LOOPS_OWNERS);
  appendOptions(els.filterAgent, AGENT_OPTIONS);

  els.resolveBy.innerHTML = '<option value="" disabled selected>Please select</option>';
  appendOptions(els.resolveBy, TEAM_NAMES);
}

function appendOptions(select, values) {
  for (const value of values) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
}

function openForm() {
  els.issueForm.reset();
  els.fieldDate.value = new Date().toISOString().slice(0, 10);
  pendingFiles = [];
  renderPreview();
  els.formOverlay.classList.remove("hidden");
  els.fieldIssue.focus();
  for (const ta of [els.fieldIssue, els.fieldWhy]) {
    ta.style.height = "auto";
  }
}

function closeForm() {
  els.formOverlay.classList.add("hidden");
}

function openResolveForm(row) {
  resolvingIssueId = row.id;
  els.resolveForm.reset();
  els.resolveOverlay.classList.remove("hidden");
  els.resolveComment.style.height = "auto";
}

function closeResolveForm() {
  resolvingIssueId = null;
  els.resolveOverlay.classList.add("hidden");
}

async function handleResolveSubmit(event) {
  event.preventDefault();
  els.resolveSubmitBtn.disabled = true;
  els.resolveSubmitBtn.textContent = "Saving…";

  try {
    const { error } = await supabaseClient
      .from("issues")
      .update({
        resolved: true,
        resolved_by: els.resolveBy.value,
        resolved_at: new Date().toISOString(),
        resolution_comment: els.resolveComment.value,
      })
      .eq("id", resolvingIssueId);

    if (error) {
      alert("Resolve failed: " + error.message);
      return;
    }

    closeResolveForm();
    loadIssues();
  } catch (err) {
    alert("Could not connect to Supabase. Are the credentials in config.js set correctly?");
  } finally {
    els.resolveSubmitBtn.disabled = false;
    els.resolveSubmitBtn.textContent = "Resolve";
  }
}

async function reopenIssue(id) {
  if (!confirm("Reopen this issue? Who/when/comment will be lost.")) return;
  const { error } = await supabaseClient
    .from("issues")
    .update({ resolved: false, resolved_by: null, resolved_at: null, resolution_comment: null })
    .eq("id", id);
  if (error) {
    alert("Reopen failed: " + error.message);
    return;
  }
  loadIssues();
}

function renderPreview() {
  els.screenshotPreview.innerHTML = "";
  pendingFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    const wrap = document.createElement("div");
    wrap.className = "thumb-wrap";

    const img = document.createElement("img");
    img.src = url;
    img.addEventListener("click", () => openLightbox(url));

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-thumb";
    removeBtn.textContent = "✕";
    removeBtn.type = "button";
    removeBtn.addEventListener("click", () => {
      pendingFiles.splice(index, 1);
      renderPreview();
    });

    wrap.appendChild(img);
    wrap.appendChild(removeBtn);
    els.screenshotPreview.appendChild(wrap);
  });
}

function addFiles(fileList) {
  for (const file of fileList) {
    if (file.type.startsWith("image/")) {
      pendingFiles.push(file);
    }
  }
  renderPreview();
}

function openLightbox(url) {
  els.lightboxImg.src = url;
  els.lightbox.classList.remove("hidden");
}

function closeLightbox() {
  els.lightbox.classList.add("hidden");
  els.lightboxImg.src = "";
}

async function uploadScreenshots(files) {
  const urls = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() || "png";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabaseClient.storage.from("screenshots").upload(path, file);
    if (error) {
      console.error("Upload error:", error);
      alert("A screenshot could not be uploaded: " + error.message);
      continue;
    }
    const { data } = supabaseClient.storage.from("screenshots").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

async function loadIssues() {
  try {
    const { data, error } = await supabaseClient
      .from("issues")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      els.tableBody.innerHTML = `<tr><td colspan="11" class="empty-state">Failed to load: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }

    allIssues = data || [];
    applyFilters();
  } catch (err) {
    els.tableBody.innerHTML = `<tr><td colspan="11" class="empty-state">Could not connect to Supabase. Are the credentials in config.js set correctly?</td></tr>`;
  }
}

function applyFilters() {
  const reportedBy = els.filterReportedBy.value;
  const owner = els.filterOwner.value;
  const agent = els.filterAgent.value;
  const resolved = els.filterResolved.value;

  const filtered = allIssues.filter((row) => {
    if (reportedBy && row.reported_by !== reportedBy) return false;
    if (owner && row.owner !== owner) return false;
    if (agent && row.agent !== agent) return false;
    if (resolved === "open" && row.resolved) return false;
    if (resolved === "resolved" && !row.resolved) return false;
    return true;
  });

  renderTable(filtered);
}

function renderTable(rows) {
  const countEl = document.getElementById("entryCount");
  if (countEl) {
    const suffix = rows.length !== allIssues.length ? ` of ${allIssues.length}` : "";
    countEl.textContent = allIssues.length ? `${rows.length}${suffix} entries` : "";
  }

  if (!rows || rows.length === 0) {
    const message = allIssues.length
      ? "No entries match these filters."
      : 'No entries yet. Click "+ New Issue" above.';
    els.tableBody.innerHTML = `<tr><td colspan="11" class="empty-state">${message}</td></tr>`;
    return;
  }

  els.tableBody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");

    tr.appendChild(td(row.id));
    tr.appendChild(td(formatDate(row.date)));
    tr.appendChild(tdName(row.reported_by));
    tr.appendChild(tdText(row.issue_explained));
    tr.appendChild(tdText(row.why));
    tr.appendChild(td(row.agent));
    tr.appendChild(tdThumbs(row.screenshot_urls || []));
    tr.appendChild(tdName(row.owner));
    tr.appendChild(tdStatusBadge(row));
    tr.appendChild(tdText(row.resolution_comment));
    tr.appendChild(tdActions(row));

    els.tableBody.appendChild(tr);
  }
}

function firstName(fullName) {
  return fullName ? fullName.split(" ")[0] : "";
}

function tdName(fullName) {
  const cell = document.createElement("td");
  cell.textContent = firstName(fullName);
  if (fullName) cell.title = fullName;
  return cell;
}

function td(text) {
  const cell = document.createElement("td");
  cell.textContent = text ?? "";
  return cell;
}

function tdText(text) {
  const cell = document.createElement("td");
  const span = document.createElement("div");
  span.className = "cell-text";
  span.textContent = text ?? "";
  cell.appendChild(span);
  return cell;
}

function tdThumbs(urls) {
  const cell = document.createElement("td");
  const wrap = document.createElement("div");
  wrap.className = "table-thumbs";
  urls.forEach((url) => {
    const img = document.createElement("img");
    img.src = url;
    img.addEventListener("click", () => openLightbox(url));
    wrap.appendChild(img);
  });
  cell.appendChild(wrap);
  return cell;
}

function tdStatusBadge(row) {
  const cell = document.createElement("td");
  const wrap = document.createElement("div");
  wrap.className = "status-cell";

  const badge = document.createElement("span");
  if (row.resolved) {
    badge.className = "status-badge resolved";
    badge.textContent = "Resolved";
    wrap.appendChild(badge);

    const meta = document.createElement("div");
    meta.className = "status-meta";
    meta.textContent = `${firstName(row.resolved_by) || "?"} · ${formatDateTime(row.resolved_at)}`;
    if (row.resolved_by) meta.title = row.resolved_by;
    wrap.appendChild(meta);
  } else {
    badge.className = "status-badge offen";
    badge.textContent = "Open";
    wrap.appendChild(badge);
  }

  cell.appendChild(wrap);
  return cell;
}

const ICON_CHECK =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
const ICON_REOPEN =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';
const ICON_DELETE =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';

function iconButton(icon, title, extraClass, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `icon-action-btn ${extraClass}`;
  btn.innerHTML = icon;
  btn.title = title;
  btn.addEventListener("click", onClick);
  return btn;
}

function tdActions(row) {
  const cell = document.createElement("td");
  cell.className = "delete-cell";

  const wrap = document.createElement("div");
  wrap.className = "actions-group";

  if (row.resolved) {
    wrap.appendChild(
      iconButton(ICON_REOPEN, "Reopen issue", "reopen-btn", () => reopenIssue(row.id))
    );
  } else {
    wrap.appendChild(
      iconButton(ICON_CHECK, "Resolve issue", "resolve-btn", () => openResolveForm(row))
    );
  }

  wrap.appendChild(
    iconButton(ICON_DELETE, "Delete entry", "delete-btn", async () => {
      if (!confirm("Really delete this entry?")) return;
      const { error } = await supabaseClient.from("issues").delete().eq("id", row.id);
      if (error) {
        alert("Delete failed: " + error.message);
        return;
      }
      loadIssues();
    })
  );

  cell.appendChild(wrap);
  return cell;
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

function formatDateTime(isoDateTime) {
  if (!isoDateTime) return "";
  const d = new Date(isoDateTime);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function handleSubmit(event) {
  event.preventDefault();
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Saving…";

  try {
    const screenshotUrls = await uploadScreenshots(pendingFiles);

    const { error } = await supabaseClient.from("issues").insert({
      date: els.fieldDate.value,
      reported_by: els.fieldReportedBy.value,
      issue_explained: els.fieldIssue.value,
      why: els.fieldWhy.value,
      owner: els.fieldOwner.value,
      agent: els.fieldAgent.value,
      resolved: false,
      screenshot_urls: screenshotUrls,
    });

    if (error) {
      alert("Save failed: " + error.message);
      return;
    }

    closeForm();
    loadIssues();
  } catch (err) {
    alert("Could not connect to Supabase. Are the credentials in config.js set correctly?");
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "Save";
  }
}

function initEvents() {
  els.openFormBtn.addEventListener("click", openForm);
  els.closeFormBtn.addEventListener("click", closeForm);
  els.cancelFormBtn.addEventListener("click", closeForm);
  els.formOverlay.addEventListener("click", (e) => {
    if (e.target === els.formOverlay) closeForm();
  });

  els.issueForm.addEventListener("submit", handleSubmit);

  els.pasteZone.addEventListener("click", () => els.fileInput.click());
  els.pasteZone.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items || [];
    const files = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) addFiles(files);
  });
  els.pasteZone.addEventListener("dragover", (e) => e.preventDefault());
  els.pasteZone.addEventListener("drop", (e) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  });

  els.fileInput.addEventListener("change", () => {
    addFiles(els.fileInput.files);
    els.fileInput.value = "";
  });

  // Erlaubt Strg+V auch wenn nicht die Paste-Zone selbst fokussiert ist,
  // solange das Formular offen ist.
  els.issueForm.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items || [];
    const files = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) addFiles(files);
  });

  els.lightbox.addEventListener("click", closeLightbox);

  for (const ta of [els.fieldIssue, els.fieldWhy, els.resolveComment]) {
    ta.addEventListener("input", () => autoGrow(ta));
  }

  els.resolveForm.addEventListener("submit", handleResolveSubmit);
  els.closeResolveBtn.addEventListener("click", closeResolveForm);
  els.cancelResolveBtn.addEventListener("click", closeResolveForm);
  els.resolveOverlay.addEventListener("click", (e) => {
    if (e.target === els.resolveOverlay) closeResolveForm();
  });

  for (const filterEl of [els.filterReportedBy, els.filterOwner, els.filterAgent, els.filterResolved]) {
    filterEl.addEventListener("change", applyFilters);
  }
  els.filterResetBtn.addEventListener("click", () => {
    els.filterReportedBy.value = "";
    els.filterOwner.value = "";
    els.filterAgent.value = "";
    els.filterResolved.value = "open"; // Standardansicht: resolved bleibt ausgeblendet
    applyFilters();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeForm();
      closeLightbox();
      closeResolveForm();
    }
  });
}

populateNameDropdowns();
initEvents();
loadIssues();
