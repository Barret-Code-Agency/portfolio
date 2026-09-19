(() => {
  const KEY = "demo-control-vehicular";
  const ITEMS = [
    { id: "luces", name: "Luces delanteras, traseras y de giro" },
    { id: "frenos", name: "Frenos de servicio y de mano" },
    { id: "neumaticos", name: "Neumaticos y rueda de auxilio" },
    { id: "extintor", name: "Extintor cargado y con vencimiento vigente" },
    { id: "cinturones", name: "Cinturones de seguridad en todas las plazas" },
    { id: "documentacion", name: "Cedula, seguro y VTV a bordo" },
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
      : `<li>Sin actividad todavia. Marca un item.</li>`;
  };

  const renderStatus = () => {
    const n = state.queue.length;
    netDot.className = "dot " + (!state.online ? "bad" : n ? "warn" : "");
    netLabel.textContent = state.online ? "Conectado" : "Sin conexion";
    pendingLabel.textContent = n ? `· ${n} pendiente${n > 1 ? "s" : ""} de subir` : "";
    toggleBtn.textContent = state.online ? "Cortar conexion" : "Reconectar";
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
    log(`Conexion recuperada: subiendo ${state.queue.length} registro${state.queue.length > 1 ? "s" : ""}`, "ok");
    setTimeout(paso, LATENCIA);
  };

  const setOnline = (on) => {
    if (state.online === on) return;
    state.online = on;
    save(); render();
    if (on) { if (state.queue.length) drenar(); else log("Conexion recuperada", "ok"); }
    else log("Conexion cortada: todo lo que marques queda en el dispositivo", "bad");
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
