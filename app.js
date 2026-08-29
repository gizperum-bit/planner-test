(function () {
  // --- Conexión a Supabase ---
  // La "anon key" está pensada para usarse en el navegador: no es secreta,
  // la protección real la dan las reglas de acceso (RLS) configuradas en la base de datos.
  const SUPABASE_URL = "https://eeldjnprpfljmyjcezrx.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlbGRqbnBycGZsam15amNlenJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5ODIwMDcsImV4cCI6MjEwMzU1ODAwN30.qgwnPMwVhX1_PubJjpHmCHU_L1mfBf9OxOur-uS7dqA";
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const SESSION_KEY = "rumbo_session";
  const PRIO_ORDER = { alta: 0, media: 1, baja: 2 };
  const PRIO_LABEL = { alta: "Alta", media: "Media", baja: "Baja" };

  function fmtDate(d) {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    return `${day} ${months[parseInt(m,10)-1]}`;
  }
  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join("");
  }

  function showError(err) {
    console.error(err);
    const toast = document.getElementById("toast");
    toast.textContent = "Hubo un problema de conexión. Intenta de nuevo en unos segundos.";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 4000);
  }

  let currentUser = null; // { id, name, is_leader }
  let editingTaskId = null;

  const loginWrap = document.getElementById("loginWrap");
  const app = document.getElementById("app");
  const nameInput = document.getElementById("nameInput");
  const leaderCheck = document.getElementById("leaderCheck");
  const enterBtn = document.getElementById("enterBtn");
  const loginError = document.getElementById("loginError");
  const boardTabBtn = document.getElementById("boardTabBtn");
  const userAvatar = document.getElementById("userAvatar");
  const userNameLabel = document.getElementById("userNameLabel");
  const greetingText = document.getElementById("greetingText");

  function setLoginError(msg) {
    loginError.textContent = msg;
    loginError.classList.toggle("show", !!msg);
  }

  async function enter(name, leaderFlag) {
    name = name.trim();
    if (!name) return;
    enterBtn.disabled = true;
    enterBtn.textContent = "Entrando…";
    setLoginError("");
    try {
      const { data: existing, error: findErr } = await sb
        .from("people").select("*").ilike("name", name).limit(1);
      if (findErr) throw findErr;

      let person = existing && existing[0];
      if (!person) {
        const { data: inserted, error: insErr } = await sb
          .from("people").insert({ name, is_leader: leaderFlag }).select().single();
        if (insErr) throw insErr;
        person = inserted;
      }
      currentUser = person;
      sessionStorage.setItem(SESSION_KEY, person.name);
      renderApp();
    } catch (err) {
      showError(err);
      setLoginError("No pudimos conectar con la base de datos. Revisa tu conexión e intenta de nuevo.");
    } finally {
      enterBtn.disabled = false;
      enterBtn.textContent = "Entrar";
    }
  }

  enterBtn.addEventListener("click", () => enter(nameInput.value, leaderCheck.checked));
  nameInput.addEventListener("keydown", e => { if (e.key === "Enter") enter(nameInput.value, leaderCheck.checked); });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    currentUser = null;
    app.classList.remove("active");
    loginWrap.style.display = "flex";
    nameInput.value = "";
    leaderCheck.checked = false;
  });

  document.querySelectorAll(".tab-btn").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));

  function switchView(view) {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    document.getElementById("view-mine").classList.toggle("active", view === "mine");
    document.getElementById("view-board").classList.toggle("active", view === "board");
    if (view === "board") renderBoard(); else renderMine();
  }

  function refreshActiveView() {
    const activeTab = document.querySelector(".tab-btn.active");
    if (activeTab && activeTab.dataset.view === "board") renderBoard();
    else renderMine();
  }

  function renderApp() {
    loginWrap.style.display = "none";
    app.classList.add("active");
    userAvatar.textContent = initials(currentUser.name);
    userNameLabel.textContent = currentUser.name;
    greetingText.textContent = "Hola, " + currentUser.name.split(" ")[0];
    boardTabBtn.style.display = currentUser.is_leader ? "inline-block" : "none";
    switchView("mine");
  }

  async function populateAssigneeSelect() {
    const sel = document.getElementById("fAssignee");
    const { data, error } = await sb.from("people").select("name").order("name");
    let names = error ? [] : data.map(d => d.name);
    if (!names.includes(currentUser.name)) names.unshift(currentUser.name);
    sel.innerHTML = names.map(n => `<option value="${n}">${n === currentUser.name ? n + " (tú)" : n}</option>`).join("");
  }

  function renderKanbanColumns(idPrefix, tasks, showAssignee) {
    ["todo", "in_progress", "done"].forEach(status => {
      const col = document.getElementById(idPrefix + "col-" + status);
      const items = tasks.filter(t => t.status === status).sort((a, b) => PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority]);
      document.getElementById(idPrefix + "count-" + status).textContent = items.length;
      col.innerHTML = "";
      if (!items.length) {
        col.innerHTML = '<div class="kcol-empty">Sin tareas aquí</div>';
      } else {
        items.forEach(t => col.appendChild(taskCard(t, { showAssignee })));
      }
    });
  }

  async function renderMine() {
    const { data: tasks, error } = await sb.from("tasks").select("*").eq("assigned_to", currentUser.name);
    if (error) { showError(error); return; }
    renderKanbanColumns("", tasks, false);
  }

  async function renderBoard() {
    const [{ data: dir, error: dirErr }, { data: allTasks, error: taskErr }] = await Promise.all([
      sb.from("people").select("*"),
      sb.from("tasks").select("*"),
    ]);
    if (dirErr || taskErr) { showError(dirErr || taskErr); return; }

    let doneSum = 0, openSum = 0, urgentSum = 0;
    allTasks.forEach(t => {
      if (t.status === "done") doneSum++;
      else { openSum++; if (t.priority === "alta") urgentSum++; }
    });
    const totalSum = allTasks.length;

    document.getElementById("teamDone").textContent = (totalSum ? Math.round((doneSum / totalSum) * 100) : 0) + "%";
    document.getElementById("teamMembers").textContent = dir.length;
    document.getElementById("teamOpen").textContent = openSum;
    document.getElementById("teamUrgent").textContent = urgentSum;

    renderKanbanColumns("team", allTasks, true);
  }

  function taskCard(task, opts) {
    opts = opts || {};
    const card = document.createElement("div");
    card.className = "kcard";
    card.draggable = true;
    card.dataset.id = task.id;

    const note = (task.assigned_to === currentUser.name && task.created_by && task.created_by !== task.assigned_to)
      ? `<div class="kcard-note">Te la asignó ${task.created_by}</div>` : "";

    const assigneeHtml = opts.showAssignee
      ? `<span class="kcard-assignee"><span class="avatar sm">${initials(task.assigned_to)}</span>${task.assigned_to}</span>` : "";

    card.innerHTML = `
      <div class="kcard-top">
        <span class="prio-chip prio-${task.priority}">${PRIO_LABEL[task.priority]}</span>
        <div class="kcard-actions">
          <button class="kicon-btn danger del-btn" aria-label="Eliminar"><svg viewBox="0 0 24 24" fill="none"><path d="M5 6h14M9 6V4h6v2M7 6l1 14h8l1-14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
      </div>
      <div class="kcard-title"></div>
      <div class="kcard-meta">
        <span class="kcard-dates">${fmtDate(task.start_date)} → ${fmtDate(task.end_date)}</span>
        ${assigneeHtml}
      </div>
      ${note}
      <select class="kcard-move">
        <option value="todo"${task.status === "todo" ? " selected" : ""}>Por hacer</option>
        <option value="in_progress"${task.status === "in_progress" ? " selected" : ""}>En progreso</option>
        <option value="done"${task.status === "done" ? " selected" : ""}>Hecho</option>
      </select>
    `;
    card.querySelector(".kcard-title").textContent = task.title;

    card.querySelector(".del-btn").addEventListener("click", async e => {
      e.stopPropagation();
      const { error } = await sb.from("tasks").delete().eq("id", task.id);
      if (error) { showError(error); return; }
      refreshActiveView();
    });

    const moveSelect = card.querySelector(".kcard-move");
    moveSelect.addEventListener("click", e => e.stopPropagation());
    moveSelect.addEventListener("change", async () => {
      const { error } = await sb.from("tasks").update({ status: moveSelect.value }).eq("id", task.id);
      if (error) { showError(error); return; }
      refreshActiveView();
    });

    let didDrag = false;
    card.addEventListener("dragstart", () => { didDrag = true; card.classList.add("dragging"); });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.addEventListener("click", () => {
      if (didDrag) { didDrag = false; return; }
      openModal(task);
    });

    return card;
  }

  document.querySelectorAll(".kcol").forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("drag-over"); });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", async e => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const dragging = document.querySelector(".kcard.dragging");
      if (!dragging) return;
      const id = dragging.dataset.id;
      const { error } = await sb.from("tasks").update({ status: col.dataset.status }).eq("id", id);
      if (error) { showError(error); return; }
      refreshActiveView();
    });
  });

  const modalOverlay = document.getElementById("modalOverlay");
  const modalTitle = document.getElementById("modalTitle");
  const modalDeleteBtn = document.getElementById("modalDeleteBtn");

  async function openModal(task) {
    await populateAssigneeSelect();
    editingTaskId = task ? task.id : null;
    modalTitle.textContent = task ? "Editar tarea" : "Nueva tarea";
    document.getElementById("fTitle").value = task ? task.title : "";
    document.getElementById("fAssignee").value = task ? task.assigned_to : currentUser.name;
    document.getElementById("fPriority").value = task ? task.priority : "media";
    document.getElementById("fStart").value = task ? (task.start_date || "") : "";
    document.getElementById("fEnd").value = task ? (task.end_date || "") : "";
    document.getElementById("fStatus").value = task ? task.status : "todo";
    modalDeleteBtn.style.display = task ? "inline-block" : "none";
    modalOverlay.classList.add("active");
    document.getElementById("fTitle").focus();
  }
  function closeModal() { modalOverlay.classList.remove("active"); editingTaskId = null; }

  document.getElementById("openAddBtn").addEventListener("click", () => openModal(null));
  document.getElementById("modalCancelBtn").addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) closeModal(); });

  document.getElementById("modalSaveBtn").addEventListener("click", async () => {
    const title = document.getElementById("fTitle").value.trim();
    if (!title) { document.getElementById("fTitle").focus(); return; }
    const assignedTo = document.getElementById("fAssignee").value;
    const priority = document.getElementById("fPriority").value;
    let startDate = document.getElementById("fStart").value || null;
    let endDate = document.getElementById("fEnd").value || null;
    if (startDate && endDate && endDate < startDate) endDate = startDate;
    const status = document.getElementById("fStatus").value;

    const saveBtn = document.getElementById("modalSaveBtn");
    saveBtn.disabled = true;
    try {
      if (editingTaskId) {
        const { error } = await sb.from("tasks")
          .update({ title, assigned_to: assignedTo, priority, start_date: startDate, end_date: endDate, status })
          .eq("id", editingTaskId);
        if (error) throw error;
      } else {
        const { error } = await sb.from("tasks").insert({
          title, assigned_to: assignedTo, created_by: currentUser.name,
          priority, start_date: startDate, end_date: endDate, status,
        });
        if (error) throw error;
      }
      closeModal();
      refreshActiveView();
    } catch (err) {
      showError(err);
    } finally {
      saveBtn.disabled = false;
    }
  });

  modalDeleteBtn.addEventListener("click", async () => {
    if (!editingTaskId) return;
    const { error } = await sb.from("tasks").delete().eq("id", editingTaskId);
    if (error) { showError(error); return; }
    closeModal();
    refreshActiveView();
  });

  (async function init() {
    const savedName = sessionStorage.getItem(SESSION_KEY);
    if (!savedName) return;
    try {
      const { data, error } = await sb.from("people").select("*").eq("name", savedName).limit(1);
      if (!error && data && data.length) { currentUser = data[0]; renderApp(); }
    } catch (err) { console.error(err); }
  })();
})();
