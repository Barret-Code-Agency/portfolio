(() => {
  const KEY = "demo-control-vehicular";
  const ITEMS = [
    { id: "luces", name: "Luces delanteras, traseras y de giro" },
    { id: "frenos", name: "Frenos de servicio y de mano" },
    { id: "neumaticos", name: "Neumáticos y rueda de auxilio" },
    { id: "extintor", name: "Extintor cargado y con vencimiento vigente" },
    { id: "cinturones", name: "Cinturones de seguridad en todas las plazas" },
    { id: "documentacion", name: "Cédula, seguro y VTV a bordo" },
    { id: "radio", name: "Prueba de enlace por radio con base" },
  ];
  const LATENCIA = 350;

  const $ = (id) => document.getElementById(id);
  const list = $("checklist"), logEl = $("log"), netDot = $("netDot"), netLabel = $("netLabel"),
        pendingLabel = $("pendingLabel"), toggleBtn = $("toggleNet");

  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  const state = Object.assign({ online: true, results: {}, synced: {}, queue: [], log: [] }, load());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

  const hora = () => new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const log = (msg, cls = "") => {
    state.log.unshift({ t: hora(), msg, cls });
    state.log = state.log.slice(0, 12);
    save(); renderLog();
  };

  const renderLog = () => {
    logEl.innerHTML = state.log.length
      ? state.log.map((l) => `<li class="${l.cls}">${l.t}  ${l.msg}</li>`).join("")
      : `<li>Sin actividad todavía. Marcá un ítem.</li>`;
  };

  const renderStatus = () => {
    const n = state.queue.length;
    netDot.className = "dot " + (!state.online ? "bad" : n ? "warn" : "");
    netLabel.textContent = state.online ? "Conectado" : "Sin conexión";
    pendingLabel.textContent = n ? `· ${n} pendiente${n > 1 ? "s" : ""} de subir` : "";
    toggleBtn.textContent = state.online ? "Cortar conexión" : "Reconectar";
  };

  list.innerHTML = ITEMS.map((it) => `<li data-item="${it.id}">
      <div><span class="item-name">${it.name}</span><span class="item-state"></span></div>
      <div class="choice">
        <button type="button" data-id="${it.id}" data-v="ok">OK</button>
        <button type="button" data-id="${it.id}" data-v="falla">Falla</button>
      </div>
    </li>`).join("");

  const renderList = () => {
    for (const it of ITEMS) {
      const r = state.results[it.id];
      const queued = state.queue.some((q) => q.id === it.id);
      const row = list.querySelector(`[data-item="${it.id}"]`);
      const st = row.querySelector(".item-state");
      st.textContent = !r ? "Sin revisar" : queued ? "Guardado en el dispositivo, pendiente de subir" : "Sincronizado con el servidor";
      st.className = "item-state " + (!r ? "" : queued ? "pending" : "ok");
      row.querySelector('[data-v="ok"]').className = r === "ok" ? "sel-ok" : "";
      row.querySelector('[data-v="falla"]').className = r === "falla" ? "sel-falla" : "";
    }
  };

  const render = () => { renderList(); renderStatus(); renderLog(); };

  const nombre = (id) => ITEMS.find((i) => i.id === id).name;

  const marcar = (id, v) => {
    state.results[id] = v;
    if (state.online) {
      save(); render();
      setTimeout(() => { state.synced[id] = v; log(`${nombre(id)}: ${v.toUpperCase()} subido al servidor`, "ok"); save(); render(); }, LATENCIA);
    } else {
      state.queue = state.queue.filter((q) => q.id !== id).concat({ id, v });
      log(`${nombre(id)}: ${v.toUpperCase()} guardado local (sin señal)`, "warn");
      save(); render();
    }
  };

  let draining = false;
  const drenar = () => {
    if (draining) return;
    draining = true;
    const paso = () => {
      if (!state.online || !state.queue.length) { draining = false; render(); return; }
      const q = state.queue.shift();
      state.synced[q.id] = q.v;
      log(`${nombre(q.id)}: ${q.v.toUpperCase()} sincronizado`, "ok");
      save(); render();
      setTimeout(paso, LATENCIA);
    };
    log(`Conexión recuperada: subiendo ${state.queue.length} registro${state.queue.length > 1 ? "s" : ""}`, "ok");
    setTimeout(paso, LATENCIA);
  };

  const setOnline = (on) => {
    if (state.online === on) return;
    state.online = on;
    save(); render();
    if (on) { if (state.queue.length) drenar(); else log("Conexión recuperada", "ok"); }
    else log("Conexión cortada: todo lo que marques queda en el dispositivo", "bad");
  };

  list.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]");
    if (b) marcar(b.dataset.id, b.dataset.v);
  });
  toggleBtn.addEventListener("click", () => setOnline(!state.online));
  $("resetDemo").addEventListener("click", () => {
    Object.assign(state, { online: true, results: {}, synced: {}, queue: [], log: [] });
    save(); render();
  });

  // Si el navegador pierde la red de verdad, la demo reacciona igual.
  window.addEventListener("offline", () => setOnline(false));
  window.addEventListener("online", () => setOnline(true));

  render();
  if (state.online && state.queue.length) drenar();
})();

// Lightbox de capturas
(() => {
  const dlg = document.getElementById("lightbox");
  if (!dlg || !dlg.showModal) return;
  const img = dlg.querySelector("img");
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a.shot");
    if (!a) return;
    e.preventDefault();
    img.src = a.getAttribute("href");
    img.alt = a.querySelector("img")?.alt || "";
    dlg.showModal();
  });
  document.getElementById("lightboxClose").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("close", () => { img.removeAttribute("src"); });
})();

// Demo 2: libro de actas encadenado (SHA-256 real via WebCrypto)
(() => {
  const list = document.getElementById("chain");
  if (!list || !window.crypto?.subtle) return;
  const ACTAS = [
    { t: "Toma de servicio", b: "Puesto 4, 06:00. Recibo el puesto sin novedades. Llaves completas, radio operativa." , by: "Vig. 1120" },
    { t: "Novedad", b: "08:40. Camión de proveedor ingresa sin remito. Se retiene en portería hasta autorización.", by: "Vig. 1120" },
    { t: "Incidente", b: "11:15. Alarma en sector B. Se verifica: falsa alarma por sensor sucio. Se informa a mantenimiento.", by: "Vig. 1120" },
    { t: "Entrega de servicio", b: "14:00. Entrego el puesto a Vig. 1187. Sin pendientes.", by: "Vig. 1120" },
  ];
  const TAMPERED = "08:40. Camión de proveedor ingresa con remito en regla. Sin novedad.";
  const sha = async (s) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  const GENESIS = "0".repeat(64);
  let sealed = []; // hashes firmados al escribir cada acta
  let tampered = false;

  const firmar = async () => {
    let prev = GENESIS;
    for (const a of ACTAS) { const h = await sha(prev + "|" + a.t + "|" + a.b + "|" + a.by); sealed.push({ prev, h }); prev = h; }
  };
  const verificar = async () => {
    let prev = GENESIS, roto = false, out = [];
    for (let i = 0; i < ACTAS.length; i++) {
      const a = ACTAS[i], body = tampered && i === 1 ? TAMPERED : a.b;
      const h = await sha(prev + "|" + a.t + "|" + body + "|" + a.by);
      const ok = !roto && h === sealed[i].h && prev === sealed[i].prev;
      if (!ok) roto = true;
      out.push({ ok, h, prev, body, tam: tampered && i === 1 });
      prev = sealed[i].h;
    }
    return out;
  };
  const short = (h) => h.slice(0, 10) + "…" + h.slice(-6);
  const render = async () => {
    const v = await verificar();
    list.innerHTML = v.map((x, i) => `<li class="${x.ok ? "" : "broken"}${x.tam ? " tampered" : ""}">
      <span class="n">${i + 1}</span>
      <div>
        <div class="acta-title">${ACTAS[i].t} <span class="pending">· ${ACTAS[i].by}</span></div>
        <div class="acta-body">${x.body}</div>
        <div class="hashes"><span>anterior ${short(x.prev)}</span><span>firma ${short(sealed[i].h)}</span></div>
        <div class="verdict">${x.ok ? "Firma válida, enlazada con la anterior" : x.tam ? "El contenido no coincide con la firma registrada" : "Enlace roto: depende de un acta alterada"}</div>
      </div></li>`).join("");
    const broken = v.some((x) => !x.ok);
    document.getElementById("chainDot").className = "dot " + (broken ? "bad" : "");
    document.getElementById("chainLabel").textContent = broken ? "Cadena rota: " + v.filter((x) => !x.ok).length + " actas inválidas" : "Cadena íntegra";
    document.getElementById("tamper").hidden = tampered;
    document.getElementById("restore").hidden = !tampered;
  };
  document.getElementById("tamper").addEventListener("click", () => { tampered = true; render(); });
  document.getElementById("restore").addEventListener("click", () => { tampered = false; render(); });
  firmar().then(render);
})();

// Demo 3: una pantalla, cuatro roles
(() => {
  const table = document.getElementById("rbacTable");
  if (!table) return;
  const ROWS = [
    { obj: "Planta Norte", puesto: "Puesto 4", vig: "Vig. 1120", hora: "08:40", nov: "Camión sin remito retenido en portería", est: "abierta", hs: 1.5, cliente: "Metalúrgica del Sur" },
    { obj: "Planta Norte", puesto: "Puesto 2", vig: "Vig. 1187", hora: "09:10", nov: "Luminaria apagada en estacionamiento", est: "resuelta", hs: 0.5, cliente: "Metalúrgica del Sur" },
    { obj: "Depósito Oeste", puesto: "Puesto 1", vig: "Vig. 1043", hora: "07:55", nov: "Portón secundario sin candado", est: "abierta", hs: 2, cliente: "Logística Andina" },
    { obj: "Torre Centro", puesto: "Puesto 1", vig: "Vig. 1201", hora: "10:20", nov: "Visita sin acreditar en recepción", est: "resuelta", hs: 0.25, cliente: "Estudio Ruiz" },
  ];
  const ROLES = {
    vigilador:  { scope: "Alcance: Planta Norte, Puesto 4 (el suyo)", filter: (r) => r.puesto === "Puesto 4" && r.obj === "Planta Norte", cols: ["hora", "nov", "est"], actions: ["Registrar novedad", "Firmar toma de servicio"] },
    supervisor: { scope: "Alcance: zona Norte (Planta Norte y Depósito Oeste)", filter: (r) => r.obj !== "Torre Centro", cols: ["obj", "puesto", "vig", "hora", "nov", "est"], actions: ["Resolver y firmar", "Ordenar ronda extra"] },
    gerencia:   { scope: "Alcance: toda la empresa", filter: () => true, cols: ["obj", "puesto", "vig", "hora", "nov", "est", "hs", "cliente"], actions: ["Exportar informe", "Ver costo por objetivo", "Asignar supervisor"] },
    cliente:    { scope: "Alcance: sus objetivos (Metalúrgica del Sur), sin datos internos", filter: (r) => r.cliente === "Metalúrgica del Sur", cols: ["obj", "hora", "nov", "est"], actions: [] },
  };
  const LABEL = { obj: "Objetivo", puesto: "Puesto", vig: "Vigilador", hora: "Hora", nov: "Novedad", est: "Estado", hs: "Hs. imputadas", cliente: "Cliente" };
  const cell = (r, c) => c === "est" ? `<span class="est ${r.est}">${r.est}</span>` : c === "hs" ? r.hs.toFixed(2) : r[c];
  const render = (role) => {
    const R = ROLES[role], rows = ROWS.filter(R.filter);
    table.innerHTML = `<thead><tr>${R.cols.map((c) => `<th>${LABEL[c]}</th>`).join("")}</tr></thead><tbody>${
      rows.map((r) => `<tr>${R.cols.map((c) => `<td>${cell(r, c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
    document.getElementById("scope").textContent = `${R.scope} · ${rows.length} de ${ROWS.length} novedades`;
    document.getElementById("rbacActions").innerHTML = R.actions.length
      ? R.actions.map((a) => `<span class="btn btn-ghost btn-sm">${a}</span>`).join("")
      : `<span class="none">Solo lectura: el cliente ve el servicio, no lo opera.</span>`;
    document.querySelectorAll("#roles button").forEach((b) => b.classList.toggle("sel", b.dataset.role === role));
  };
  document.getElementById("roles").addEventListener("click", (e) => { const b = e.target.closest("button[data-role]"); if (b) render(b.dataset.role); });
  render("vigilador");
})();

// Menu en el celular
(() => {
  const nav = document.querySelector(".nav"), btn = document.getElementById("navToggle");
  if (!btn) return;
  const set = (open) => { nav.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open)); btn.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú"); };
  btn.addEventListener("click", () => set(!nav.classList.contains("open")));
  document.getElementById("navLinks").addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
})();
