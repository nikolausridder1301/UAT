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
  fieldResolved: document.getElementById("fieldResolved"),
  pasteZone: document.getElementById("pasteZone"),
  fileInput: document.getElementById("fileInput"),
  screenshotPreview: document.getElementById("screenshotPreview"),
  submitBtn: document.getElementById("submitBtn"),
  lightbox: document.getElementById("lightbox"),
  lightboxImg: document.getElementById("lightboxImg"),
};

let pendingFiles = []; // File objects staged for upload on submit

function populateNameDropdowns() {
  for (const select of [els.fieldReportedBy, els.fieldOwner]) {
    select.innerHTML = "";
    for (const name of TEAM_NAMES) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    }
  }
}

function openForm() {
  els.issueForm.reset();
  els.fieldDate.value = new Date().toISOString().slice(0, 10);
  pendingFiles = [];
  renderPreview();
  els.formOverlay.classList.remove("hidden");
  els.fieldIssue.focus();
}

function closeForm() {
  els.formOverlay.classList.add("hidden");
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
      console.error("Upload-Fehler:", error);
      alert("Ein Screenshot konnte nicht hochgeladen werden: " + error.message);
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
      els.tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">Fehler beim Laden: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }

    renderTable(data);
  } catch (err) {
    els.tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">Verbindung zu Supabase fehlgeschlagen. Sind die Zugangsdaten in config.js korrekt hinterlegt?</td></tr>`;
  }
}

function renderTable(rows) {
  const countEl = document.getElementById("entryCount");
  if (countEl) {
    countEl.textContent = rows && rows.length ? `${rows.length} Einträge` : "";
  }

  if (!rows || rows.length === 0) {
    els.tableBody.innerHTML = `<tr><td colspan="9" class="empty-state">Noch keine Einträge. Klicke oben auf "+ Neuer Eintrag".</td></tr>`;
    return;
  }

  els.tableBody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");

    tr.appendChild(td(row.id));
    tr.appendChild(td(formatDate(row.date)));
    tr.appendChild(td(row.reported_by));
    tr.appendChild(tdText(row.issue_explained));
    tr.appendChild(tdText(row.why));
    tr.appendChild(tdThumbs(row.screenshot_urls || []));
    tr.appendChild(tdResolved(row));
    tr.appendChild(td(row.owner));
    tr.appendChild(tdDelete(row.id));

    els.tableBody.appendChild(tr);
  }
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

function tdResolved(row) {
  const cell = document.createElement("td");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "resolved-toggle";
  checkbox.checked = !!row.resolved;
  checkbox.addEventListener("change", async () => {
    const { error } = await supabaseClient
      .from("issues")
      .update({ resolved: checkbox.checked })
      .eq("id", row.id);
    if (error) {
      alert("Konnte Status nicht speichern: " + error.message);
      checkbox.checked = !checkbox.checked;
    }
  });
  cell.appendChild(checkbox);
  return cell;
}

function tdDelete(id) {
  const cell = document.createElement("td");
  const btn = document.createElement("button");
  btn.className = "delete-btn";
  btn.textContent = "🗑";
  btn.title = "Eintrag löschen";
  btn.addEventListener("click", async () => {
    if (!confirm("Diesen Eintrag wirklich löschen?")) return;
    const { error } = await supabaseClient.from("issues").delete().eq("id", id);
    if (error) {
      alert("Löschen fehlgeschlagen: " + error.message);
      return;
    }
    loadIssues();
  });
  cell.appendChild(btn);
  return cell;
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function handleSubmit(event) {
  event.preventDefault();
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Speichere…";

  try {
    const screenshotUrls = await uploadScreenshots(pendingFiles);

    const { error } = await supabaseClient.from("issues").insert({
      date: els.fieldDate.value,
      reported_by: els.fieldReportedBy.value,
      issue_explained: els.fieldIssue.value,
      why: els.fieldWhy.value,
      owner: els.fieldOwner.value,
      resolved: els.fieldResolved.checked,
      screenshot_urls: screenshotUrls,
    });

    if (error) {
      alert("Speichern fehlgeschlagen: " + error.message);
      return;
    }

    closeForm();
    loadIssues();
  } catch (err) {
    alert("Verbindung zu Supabase fehlgeschlagen. Sind die Zugangsdaten in config.js korrekt hinterlegt?");
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "Speichern";
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

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeForm();
      closeLightbox();
    }
  });
}

populateNameDropdowns();
initEvents();
loadIssues();
