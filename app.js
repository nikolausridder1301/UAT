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
  filterStatus: document.getElementById("filterStatus"),
  filterResetBtn: document.getElementById("filterResetBtn"),
  resolveOverlay: document.getElementById("resolveOverlay"),
  resolveForm: document.getElementById("resolveForm"),
  resolveBy: document.getElementById("resolveBy"),
  resolveComment: document.getElementById("resolveComment"),
  resolveSubmitBtn: document.getElementById("resolveSubmitBtn"),
  closeResolveBtn: document.getElementById("closeResolveBtn"),
  cancelResolveBtn: document.getElementById("cancelResolveBtn"),
  editOverlay: document.getElementById("editOverlay"),
  editBody: document.getElementById("editBody"),
  closeEditBtn: document.getElementById("closeEditBtn"),
  detailOverlay: document.getElementById("detailOverlay"),
  detailBody: document.getElementById("detailBody"),
  detailTitle: document.getElementById("detailTitle"),
  closeDetailBtn: document.getElementById("closeDetailBtn"),
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
  appendOptions(els.fieldAgent, AGENT_OPTIONS);

  appendOptions(els.filterReportedBy, TEAM_NAMES);
  appendOptions(els.filterOwner, LOOPS_OWNERS);
  appendOptions(els.filterAgent, AGENT_OPTIONS);

  els.resolveBy.innerHTML = '<option value="" disabled selected>Please select</option>';
  appendOptions(els.resolveBy, TEAM_NAMES);
}

function appendOptions(select, values) {
  const sorted = [...values].sort((a, b) => a.localeCompare(b));
  for (const value of sorted) {
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

function openEditModal(row) {
  els.editBody.innerHTML = buildEditBodyHtml(row);
  wireEditBodyEvents(row);
  els.editOverlay.classList.remove("hidden");
}

function closeEditModal() {
  els.editOverlay.classList.add("hidden");
  els.editBody.innerHTML = "";
}

async function logHistory(issueId, event, actor, comment) {
  const { error } = await supabaseClient
    .from("issue_history")
    .insert({ issue_id: issueId, event, actor: actor || null, comment: comment || null });
  if (error) console.error("History log failed:", error);
}

const HISTORY_LABELS = {
  created: "Created",
  marked_in_progress: "Marked as In Progress",
  marked_open: "Marked as Open",
  resolved: "Resolved",
  reopened: "Reopened",
};

async function openDetailModal(row) {
  els.detailTitle.textContent = `Issue #${row.id}`;
  els.detailBody.innerHTML = '<p class="status-meta">Loading history…</p>';
  els.detailOverlay.classList.remove("hidden");

  const { data: history, error } = await supabaseClient
    .from("issue_history")
    .select("*")
    .eq("issue_id", row.id)
    .order("created_at", { ascending: false });

  els.detailBody.innerHTML = buildDetailBodyHtml(row, completeHistory(row, error ? [] : history || []));

  const thumbsWrap = document.getElementById("detailThumbs");
  if (thumbsWrap) {
    for (const url of row.screenshot_urls || []) {
      const img = document.createElement("img");
      img.src = url;
      img.addEventListener("click", () => openLightbox(url));
      thumbsWrap.appendChild(img);
    }
  }
}

function closeDetailModal() {
  els.detailOverlay.classList.add("hidden");
  els.detailBody.innerHTML = "";
}

function completeHistory(row, history) {
  const entries = [...history];

  if (!entries.some((h) => h.event === "created")) {
    entries.push({ event: "created", actor: row.reported_by, comment: null, created_at: row.created_at });
  }

  if (row.status === "resolved" && !entries.some((h) => h.event === "resolved")) {
    entries.push({
      event: "resolved",
      actor: row.resolved_by,
      comment: row.resolution_comment,
      created_at: row.resolved_at,
    });
  }

  return entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function detailField(label, value) {
  return `<div><div class="detail-field-label">${escapeHtml(label)}</div><div class="detail-field-value">${value}</div></div>`;
}

function buildDetailBodyHtml(row, history) {
  const statusBadgeHtml =
    row.status === "resolved"
      ? '<span class="status-badge resolved">Resolved</span>'
      : row.status === "in_progress"
        ? '<span class="status-badge in-progress">In Progress</span>'
        : '<span class="status-badge offen">Open</span>';

  let html = '<div class="detail-meta">';
  html += detailField("Date", escapeHtml(formatDate(row.date)));
  html += detailField("Reported by", escapeHtml(row.reported_by));
  html += detailField("Loops Owner", escapeHtml(row.owner));
  html += detailField("Agent", escapeHtml(row.agent));
  html += detailField("Status", statusBadgeHtml);
  html += "</div>";

  html += '<div class="detail-divider"></div>';

  html += '<div class="detail-section"><h3>Issue Explained</h3>';
  html += `<div class="cell-text">${linkify(escapeHtml(row.issue_explained || ""))}</div></div>`;

  if (row.why) {
    html += '<div class="detail-section"><h3>Why?</h3>';
    html += `<div class="cell-text">${linkify(escapeHtml(row.why))}</div></div>`;
  }

  if (row.screenshot_urls && row.screenshot_urls.length) {
    html += '<div class="detail-section"><h3>Screenshots</h3><div class="table-thumbs" id="detailThumbs"></div></div>';
  }

  if (row.status === "resolved" && row.resolution_comment) {
    html += '<div class="detail-section"><h3>Resolution Comment</h3>';
    html += `<div class="cell-text">${linkify(escapeHtml(row.resolution_comment))}</div></div>`;
  }

  html += '<div class="detail-divider"></div>';

  html += '<div class="detail-section"><h3>Change Log</h3>';
  if (!history.length) {
    html += '<p class="status-meta">No history yet.</p>';
  } else {
    html += '<ul class="history-list">';
    for (const h of history) {
      const label = HISTORY_LABELS[h.event] || h.event;
      const who = h.actor ? ` by ${escapeHtml(firstName(h.actor))}` : "";
      html += '<li class="history-item">';
      html += `<div class="history-event">${escapeHtml(label)}${who}</div>`;
      html += `<div class="history-time">${formatDateTime(h.created_at)}</div>`;
      if (h.comment) html += `<div class="history-comment">${escapeHtml(h.comment)}</div>`;
      html += "</li>";
    }
    html += "</ul>";
  }
  html += "</div>";

  return html;
}

function buildEditBodyHtml(row) {
  let html = "";

  if (row.status === "resolved") {
    html += '<span class="status-badge resolved">Resolved</span>';
    html += `<span class="status-badge neutral">${resolvedMetaLines(row)}</span>`;
    if (row.resolution_comment) {
      html += `<div class="cell-text edit-meta">${escapeHtml(row.resolution_comment)}</div>`;
    }
    html += '<button type="button" id="editReopenBtn" class="btn">Reopen Issue</button>';
  } else {
    html +=
      row.status === "in_progress"
        ? '<span class="status-badge in-progress">In Progress</span>'
        : '<span class="status-badge offen">Open</span>';

    html +=
      row.status === "in_progress"
        ? '<button type="button" id="editOpenBtn" class="btn">Mark as Open</button>'
        : '<button type="button" id="editInProgressBtn" class="btn">Mark as In Progress</button>';

    html += '<button type="button" id="editResolveBtn" class="btn primary">Resolve Issue</button>';
  }

  html += '<div class="edit-divider"></div>';
  html += '<button type="button" id="editDeleteBtn" class="btn danger">Delete Issue</button>';

  return html;
}

function wireEditBodyEvents(row) {
  document.getElementById("editInProgressBtn")?.addEventListener("click", () => updateStatus(row.id, "in_progress"));
  document.getElementById("editOpenBtn")?.addEventListener("click", () => updateStatus(row.id, "open"));
  document.getElementById("editResolveBtn")?.addEventListener("click", () => {
    closeEditModal();
    openResolveForm(row);
  });
  document.getElementById("editReopenBtn")?.addEventListener("click", () => {
    closeEditModal();
    reopenIssue(row.id);
  });
  document.getElementById("editDeleteBtn")?.addEventListener("click", () => deleteIssue(row.id));
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
        status: "resolved",
        resolved_by: els.resolveBy.value,
        resolved_at: new Date().toISOString(),
        resolution_comment: els.resolveComment.value,
      })
      .eq("id", resolvingIssueId);

    if (error) {
      alert("Resolve failed: " + error.message);
      return;
    }

    await logHistory(resolvingIssueId, "resolved", els.resolveBy.value, els.resolveComment.value);
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
    .update({
      resolved: false,
      status: "open",
      resolved_by: null,
      resolved_at: null,
      resolution_comment: null,
    })
    .eq("id", id);
  if (error) {
    alert("Reopen failed: " + error.message);
    return;
  }
  await logHistory(id, "reopened");
  loadIssues();
}

async function updateStatus(id, status) {
  const { error } = await supabaseClient
    .from("issues")
    .update({ status, resolved: status === "resolved" })
    .eq("id", id);
  if (error) {
    alert("Update failed: " + error.message);
    return;
  }
  await logHistory(id, status === "in_progress" ? "marked_in_progress" : "marked_open");
  closeEditModal();
  loadIssues();
}

async function deleteIssue(id) {
  if (
    !confirm(
      "Are you sure you want to delete this issue? Once deleted, it's gone for good and cannot be recovered."
    )
  )
    return;
  const { error } = await supabaseClient.from("issues").delete().eq("id", id);
  if (error) {
    alert("Delete failed: " + error.message);
    return;
  }
  closeEditModal();
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
      els.tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">Failed to load: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }

    allIssues = data || [];
    applyFilters();
  } catch (err) {
    els.tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">Could not connect to Supabase. Are the credentials in config.js set correctly?</td></tr>`;
  }
}

function applyFilters() {
  const reportedBy = els.filterReportedBy.value;
  const owner = els.filterOwner.value;
  const agent = els.filterAgent.value;
  const status = els.filterStatus.value;

  const filtered = allIssues.filter((row) => {
    if (reportedBy && row.reported_by !== reportedBy) return false;
    if (owner && row.owner !== owner) return false;
    if (agent && row.agent !== agent) return false;
    if (status === "not_resolved" && row.status === "resolved") return false;
    if (status && status !== "not_resolved" && row.status !== status) return false;
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
    els.tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">${message}</td></tr>`;
    return;
  }

  els.tableBody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");

    tr.appendChild(tdId(row));
    tr.appendChild(td(formatDate(row.date)));
    tr.appendChild(tdName(row.reported_by));
    tr.appendChild(tdText(row.issue_explained));
    tr.appendChild(tdText(row.why));
    tr.appendChild(tdThumbs(row.screenshot_urls || []));
    tr.appendChild(tdName(row.owner));
    tr.appendChild(tdStatusBadge(row));
    tr.appendChild(tdEdit(row));

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

function tdId(row) {
  const cell = document.createElement("td");
  const link = document.createElement("button");
  link.type = "button";
  link.className = "id-link";
  link.textContent = row.id;
  link.title = "View issue details";
  link.addEventListener("click", () => openDetailModal(row));
  cell.appendChild(link);
  return cell;
}

function linkify(escapedText) {
  return escapedText.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" class="cell-link">${url}</a>`
  );
}

const TRUNCATE_LENGTH = 150;

function tdText(text) {
  const cell = document.createElement("td");
  const wrap = document.createElement("div");
  wrap.className = "cell-text";
  const value = text ?? "";
  const isLong = value.length > TRUNCATE_LENGTH || (value.match(/\n/g) || []).length > 2;

  if (!isLong) {
    wrap.innerHTML = linkify(escapeHtml(value));
    cell.appendChild(wrap);
    return cell;
  }

  const textPart = document.createElement("span");
  const toggleLink = document.createElement("span");
  toggleLink.className = "show-more-link";

  let expanded = false;
  const render = () => {
    if (expanded) {
      textPart.innerHTML = linkify(escapeHtml(value)) + " ";
      toggleLink.textContent = "show less";
    } else {
      textPart.innerHTML = linkify(escapeHtml(value.slice(0, TRUNCATE_LENGTH).trimEnd())) + "… ";
      toggleLink.textContent = "show more";
    }
  };
  render();

  toggleLink.addEventListener("click", () => {
    expanded = !expanded;
    render();
  });

  wrap.appendChild(textPart);
  wrap.appendChild(toggleLink);
  cell.appendChild(wrap);
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
  if (row.status === "resolved") {
    badge.className = "status-badge resolved";
    badge.textContent = "Resolved";
    wrap.appendChild(badge);
  } else if (row.status === "in_progress") {
    badge.className = "status-badge in-progress";
    badge.textContent = "In Progress";
    wrap.appendChild(badge);
  } else {
    badge.className = "status-badge offen";
    badge.textContent = "Open";
    wrap.appendChild(badge);
  }

  cell.appendChild(wrap);
  return cell;
}

const ICON_EDIT =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>';

function tdEdit(row) {
  const cell = document.createElement("td");
  cell.className = "delete-cell";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-action-btn edit-btn";
  btn.innerHTML = ICON_EDIT;
  btn.title = "Edit issue";
  btn.addEventListener("click", () => openEditModal(row));

  cell.appendChild(btn);
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

function resolvedMetaLines(row) {
  const [datePart, timePart] = formatDateTime(row.resolved_at).split(" ");
  return [escapeHtml(firstName(row.resolved_by) || "?"), datePart, timePart].join("<br>");
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

    const { data, error } = await supabaseClient
      .from("issues")
      .insert({
        date: els.fieldDate.value,
        reported_by: els.fieldReportedBy.value,
        issue_explained: els.fieldIssue.value,
        why: els.fieldWhy.value,
        owner: els.fieldOwner.value,
        agent: els.fieldAgent.value,
        resolved: false,
        status: "open",
        screenshot_urls: screenshotUrls,
      })
      .select()
      .single();

    if (error) {
      alert("Save failed: " + error.message);
      return;
    }

    await logHistory(data.id, "created", els.fieldReportedBy.value);
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

  for (const filterEl of [els.filterReportedBy, els.filterOwner, els.filterAgent, els.filterStatus]) {
    filterEl.addEventListener("change", applyFilters);
  }
  els.filterResetBtn.addEventListener("click", () => {
    els.filterReportedBy.value = "";
    els.filterOwner.value = "";
    els.filterAgent.value = "";
    els.filterStatus.value = "not_resolved"; // Standardansicht: resolved bleibt ausgeblendet
    applyFilters();
  });

  els.closeEditBtn.addEventListener("click", closeEditModal);
  els.editOverlay.addEventListener("click", (e) => {
    if (e.target === els.editOverlay) closeEditModal();
  });

  els.closeDetailBtn.addEventListener("click", closeDetailModal);
  els.detailOverlay.addEventListener("click", (e) => {
    if (e.target === els.detailOverlay) closeDetailModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeForm();
      closeLightbox();
      closeResolveForm();
      closeEditModal();
      closeDetailModal();
    }
  });
}

populateNameDropdowns();
initEvents();
loadIssues();
