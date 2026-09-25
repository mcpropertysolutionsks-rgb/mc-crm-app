import { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCDJI-5TN_EfQoKbdBLpD0sUm8AGQgC7YU",
  authDomain: "mc-crm-ac51e.firebaseapp.com",
  projectId: "mc-crm-ac51e",
  storageBucket: "mc-crm-ac51e.firebasestorage.app",
  messagingSenderId: "582721987377",
  appId: "1:582721987377:web:fc5206c3582ceb88414610",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const STAGES = [
  "Nuevo Lead",
  "Contactado",
  "Visita",
  "Interesado",
  "Propuesta",
  "Onboarding",
  "Vendor Aprobado",
  "Trabajo Confirmado",
  "Cliente Activo",
  "Follow-up Futuro",
  "Perdido",
];

const SERVICES = ["Painting", "Cleaning", "Turnover / Make-ready", "Breezeway", "Minor Repairs", "Other"];
const PIPELINES = ["Multifamily / Commercial", "Residential Painting"];

function blankLead() {
  return {
    id: "",
    company: "",
    property: "",
    managementCompany: "",
    contact: "",
    role: "",
    email: "",
    phone: "",
    address: "",
    pipeline: PIPELINES[0],
    stage: STAGES[0],
    services: [],
    nextAction: "",
    nextActionDate: "",
    notes: "",
    vendor: { w9: false, coi: false, additionalInsured: false, application: false, contract: false, payment: false },
    createdAt: "",
    updatedAt: "",
  };
}

function normalizeLead(l) {
  return {
    ...blankLead(),
    ...l,
    property: l.property || l.company || "",
    company: l.company || l.property || "",
    pipeline: l.pipeline || PIPELINES[0],
    stage:
      l.stage ||
      (l.status === "Cerrado" ? "Cliente Activo" : l.status === "En Seguimiento" ? "Contactado" : "Nuevo Lead"),
    nextActionDate: l.nextActionDate || l.followUpDate || "",
    nextAction: l.nextAction || (l.followUpDate ? "Follow up" : ""),
    services: Array.isArray(l.services) ? l.services : [],
    vendor: { ...blankLead().vendor, ...(l.vendor || {}) },
  };
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [leads, setLeads] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mc_leads") || "[]");
      return saved.map(normalizeLead);
    } catch {
      return [];
    }
  });
  const [pipeline, setPipeline] = useState(PIPELINES[0]);
  const [stageFilter, setStageFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(blankLead());
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setAuthLoading(false); }), []);
  useEffect(() => localStorage.setItem("mc_leads", JSON.stringify(leads)), [leads]);

  const pipelineLeads = useMemo(() => leads.filter((l) => l.pipeline === pipeline), [leads, pipeline]);
  const visible = useMemo(() => pipelineLeads.filter((l) => {
    const hay = `${l.company} ${l.property} ${l.managementCompany} ${l.contact} ${l.email} ${l.phone} ${l.address} ${l.stage} ${l.nextAction} ${l.notes}`.toLowerCase();
    return (stageFilter === "Todos" || l.stage === stageFilter) && hay.includes(search.toLowerCase());
  }), [pipelineLeads, stageFilter, search]);

  const counts = {
    total: pipelineLeads.length,
    new: pipelineLeads.filter((l) => l.stage === "Nuevo Lead").length,
    active: pipelineLeads.filter((l) => ["Contactado", "Visita", "Interesado", "Propuesta", "Onboarding", "Vendor Aprobado"].includes(l.stage)).length,
    clients: pipelineLeads.filter((l) => ["Trabajo Confirmado", "Cliente Activo"].includes(l.stage)).length,
    due: pipelineLeads.filter((l) => l.nextActionDate && l.nextActionDate <= today && !["Perdido", "Cliente Activo"].includes(l.stage)).length,
  };

  function startNew() {
    setEditingId(null);
    setForm({ ...blankLead(), pipeline });
    setShowForm(true);
  }

  function editLead(l) {
    setEditingId(l.id);
    setForm(normalizeLead(l));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveLead() {
    if (!form.company.trim() && !form.property.trim()) return alert("Agrega por lo menos el nombre de la propiedad o compañía.");
    if (!form.contact.trim()) return alert("Agrega un contacto.");

    const now = new Date().toISOString();
    const clean = normalizeLead({
      ...form,
      id: editingId || String(Date.now()),
      createdAt: form.createdAt || now,
      updatedAt: now,
    });

    setLeads((old) => editingId ? old.map((l) => l.id === editingId ? clean : l) : [clean, ...old]);
    setShowForm(false);
    setEditingId(null);
    setForm(blankLead());
  }

  function removeLead(id) {
    if (window.confirm("¿Borrar este lead?")) setLeads((old) => old.filter((l) => l.id !== id));
  }

  function toggleService(name) {
    setForm((f) => ({
      ...f,
      services: f.services.includes(name) ? f.services.filter((x) => x !== name) : [...f.services, name],
    }));
  }

  function toggleVendor(key) {
    setForm((f) => ({ ...f, vendor: { ...f.vendor, [key]: !f.vendor[key] } }));
  }

  async function login() {
    try { await signInWithEmailAndPassword(auth, loginData.email, loginData.password); }
    catch (e) { alert("No pude iniciar sesión: " + e.message); }
  }

  async function importChapie() {
    try {
      const kind = pipeline === PIPELINES[1] ? "painting" : "property";
      const response = await fetch("https://mc-property-agent-4syy.vercel.app/api/lead-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "both", kind, area: "kansas city", maxQueries: 8, maxCards: 100, autoSave: false }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || result.note || "Chapi error");

      const imported = (result.leads || []).map((x, i) => normalizeLead({
        id: `chapi-${Date.now()}-${i}`,
        company: String(x.title || x.name || "Lead").replace(/^Potential painting client:\s*/i, ""),
        property: String(x.title || x.name || "Lead").replace(/^Potential painting client:\s*/i, ""),
        contact: x.contact || x.name || "",
        email: x.email || "",
        phone: x.phone || "",
        address: x.area || "",
        pipeline,
        stage: "Nuevo Lead",
        services: x.recommendedService ? [x.recommendedService] : [],
        notes: [x.description, x.opportunity, x.url ? `Source: ${x.url}` : ""].filter(Boolean).join(" | "),
        createdAt: new Date().toISOString(),
      }));

      setLeads((old) => {
        const keys = new Set(old.map((l) => [l.company, l.email, l.phone].join("|").toLowerCase()));
        return [...imported.filter((l) => !keys.has([l.company, l.email, l.phone].join("|").toLowerCase())), ...old];
      });
      alert(`Importados ${imported.length} lead(s) de Chapi.`);
    } catch (e) {
      alert("No pude importar desde Chapi: " + e.message);
    }
  }

  if (authLoading) return <div className="center">Cargando…</div>;

  if (!user) return (
    <>
      <style>{styles}</style>
      <div className="login">
        <div className="loginCard">
          <img src="/mc-logo.png" alt="MC Property Solutions" />
          <div className="eyebrow">MC PROPERTY SOLUTIONS</div>
          <h1>CRM</h1>
          <p>Leads, follow-ups y clientes en un solo lugar.</p>
          <input type="email" placeholder="Email" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} />
          <input type="password" placeholder="Password" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} onKeyDown={(e) => e.key === "Enter" && login()} />
          <button className="primary" onClick={login}>Entrar</button>
        </div>
      </div>
    </>
  );

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <aside>
          <div className="brandMini">
            <img src="/mc-logo.png" alt="MCPS" />
            <div><b>MCPS</b><small>CRM</small></div>
          </div>

          <div className="navLabel">PIPELINES</div>
          {PIPELINES.map((p) => (
            <button key={p} className={pipeline === p ? "nav active" : "nav"} onClick={() => { setPipeline(p); setStageFilter("Todos"); }}>
              {p === PIPELINES[0] ? "▦" : "⌂"} <span>{p}</span>
            </button>
          ))}

          <div className="navLabel">ACCIONES</div>
          <button className="nav" onClick={startNew}>＋ <span>Nuevo lead</span></button>
          <button className="nav" onClick={importChapie}>⇩ <span>Importar Chapi</span></button>

          <button className="signOut" onClick={() => signOut(auth)}>Cerrar sesión</button>
        </aside>

        <main>
          <header>
            <div>
              <div className="eyebrow">{pipeline}</div>
              <h1>MC Property Solutions CRM</h1>
              <p>Próxima acción clara para cada oportunidad.</p>
            </div>
            <button className="primary" onClick={startNew}>＋ Nuevo lead</button>
          </header>

          {counts.due > 0 && <div className="notice"><b>{counts.due}</b> seguimiento(s) requieren atención hoy o están vencidos.</div>}

          <section className="metrics">
            <Metric label="Total" value={counts.total} />
            <Metric label="Nuevos" value={counts.new} />
            <Metric label="En proceso" value={counts.active} />
            <Metric label="Trabajo / cliente" value={counts.clients} />
          </section>

          {showForm && (
            <section className="panel formPanel">
              <div className="panelHead">
                <div><span className="eyebrow">REGISTRO</span><h2>{editingId ? "Editar oportunidad" : "Nueva oportunidad"}</h2></div>
                <button className="iconBtn" onClick={() => setShowForm(false)}>×</button>
              </div>

              <div className="formGrid">
                <Field label="Propiedad / Lead"><input value={form.property} onChange={(e) => setForm({ ...form, property: e.target.value, company: form.company || e.target.value })} /></Field>
                <Field label="Management Company"><input value={form.managementCompany} onChange={(e) => setForm({ ...form, managementCompany: e.target.value })} /></Field>
                <Field label="Contacto"><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
                <Field label="Rol"><input placeholder="Property Manager, Maintenance…" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
                <Field label="Teléfono"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                <Field label="Email"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                <Field label="Dirección"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
                <Field label="Etapa"><select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Próxima acción"><input placeholder="Llamar, visitar, enviar propuesta…" value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} /></Field>
                <Field label="Fecha"><input type="date" value={form.nextActionDate} onChange={(e) => setForm({ ...form, nextActionDate: e.target.value })} /></Field>
              </div>

              <Field label="Servicios">
                <div className="chips">{SERVICES.map((s) => <button type="button" key={s} className={form.services.includes(s) ? "chip selected" : "chip"} onClick={() => toggleService(s)}>{s}</button>)}</div>
              </Field>

              {pipeline === PIPELINES[0] && <Field label="Vendor onboarding">
                <div className="checks">
                  {Object.entries({ w9: "W-9", coi: "COI", additionalInsured: "Additional Insured", application: "Vendor App", contract: "Contract", payment: "Payment Setup" }).map(([k, label]) => (
                    <label key={k}><input type="checkbox" checked={form.vendor[k]} onChange={() => toggleVendor(k)} /> {label}</label>
                  ))}
                </div>
              </Field>}

              <Field label="Notas"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              <div className="formActions"><button className="secondary" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary" onClick={saveLead}>Guardar</button></div>
            </section>
          )}

          <section className="panel">
            <div className="toolbar">
              <input className="search" placeholder="Buscar propiedad, contacto, teléfono, email…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
                <option>Todos</option>{STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="tableWrap">
              <table>
                <thead><tr><th>Propiedad / lead</th><th>Contacto</th><th>Etapa</th><th>Servicios</th><th>Próxima acción</th><th>Fecha</th><th></th></tr></thead>
                <tbody>
                  {visible.length === 0 ? <tr><td colSpan="7" className="empty">No hay oportunidades en esta vista.</td></tr> :
                    visible.map((l) => {
                      const due = l.nextActionDate && l.nextActionDate <= today && !["Perdido", "Cliente Activo"].includes(l.stage);
                      return <tr key={l.id}>
                        <td><b>{l.property || l.company}</b><small>{l.managementCompany || l.address || "—"}</small></td>
                        <td><b>{l.contact}</b><small>{l.phone || l.email || "—"}</small></td>
                        <td><span className="stage">{l.stage}</span></td>
                        <td><span className="serviceText">{l.services.slice(0, 2).join(", ") || "—"}{l.services.length > 2 ? ` +${l.services.length - 2}` : ""}</span></td>
                        <td>{l.nextAction || "—"}</td>
                        <td><span className={due ? "date due" : "date"}>{l.nextActionDate || "Sin fecha"}</span></td>
                        <td className="actionsCell"><button onClick={() => editLead(l)}>Editar</button><button className="danger" onClick={() => removeLead(l.id)}>Borrar</button></td>
                      </tr>;
                    })
                  }
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}
function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

const styles = `
*{box-sizing:border-box}body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0b0c0e;color:#f7f7f5}button,input,select,textarea{font:inherit}.center,.login{min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 0,rgba(197,150,53,.14),transparent 34%),#08090a}.loginCard{width:min(420px,92vw);padding:36px;border:1px solid #2a2c30;border-radius:24px;background:#101114;box-shadow:0 28px 80px rgba(0,0,0,.45)}.loginCard img{width:95px;display:block;margin:0 auto 18px}.loginCard h1{font-size:38px;margin:4px 0}.loginCard p{color:#989da6;margin:0 0 24px}.loginCard input{width:100%;margin:0 0 12px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;color:#cfa849}.primary,.secondary,.iconBtn{border:0;border-radius:10px;padding:11px 16px;font-weight:800;cursor:pointer}.primary{background:#d7ae4b;color:#101010}.secondary{background:#23252a;color:#f2f2f2}.app{display:grid;grid-template-columns:230px 1fr;min-height:100vh}aside{position:sticky;top:0;height:100vh;padding:20px 14px;border-right:1px solid #24262a;background:#0e0f11}.brandMini{display:flex;gap:10px;align-items:center;padding:0 8px 22px}.brandMini img{width:42px;height:42px;object-fit:contain}.brandMini b{display:block;font-size:16px}.brandMini small{display:block;color:#cfa849;letter-spacing:.18em}.navLabel{margin:22px 10px 8px;color:#646a73;font-size:10px;font-weight:900;letter-spacing:.13em}.nav{width:100%;display:flex;gap:10px;align-items:center;padding:11px;border:0;border-radius:10px;background:transparent;color:#aeb3bb;text-align:left;cursor:pointer}.nav:hover,.nav.active{background:#1a1c20;color:#fff}.nav.active{box-shadow:inset 2px 0 #d7ae4b}.signOut{position:absolute;bottom:20px;left:14px;right:14px;width:calc(100% - 28px);border:1px solid #292c31;border-radius:9px;padding:10px;background:transparent;color:#8b9098;cursor:pointer}main{min-width:0;padding:34px;max-width:1500px;width:100%;margin:auto}header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:24px}header h1{margin:5px 0 3px;font-size:30px}header p{margin:0;color:#8e949d}.notice{margin:0 0 20px;padding:13px 16px;border:1px solid #5d4820;border-radius:11px;background:#211b0e;color:#d9be7b}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.metric{padding:18px;border:1px solid #26282d;border-radius:14px;background:#121316}.metric span{display:block;color:#868c95;font-size:12px;font-weight:700}.metric strong{display:block;margin-top:7px;font-size:30px}.panel{margin-bottom:18px;border:1px solid #26282d;border-radius:16px;background:#111214;overflow:hidden}.formPanel{padding:22px}.panelHead{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}.panelHead h2{margin:4px 0 0}.iconBtn{font-size:22px;padding:4px 11px;background:#202227;color:#bbb}.formGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.field{display:block;margin-bottom:14px}.field>span{display:block;margin-bottom:7px;color:#8d939d;font-size:12px;font-weight:800}.field input,.field select,.field textarea,.toolbar input,.toolbar select{width:100%;border:1px solid #30333a;border-radius:9px;padding:11px 12px;background:#0c0d0f;color:#f4f4f1;outline:none}.field input:focus,.field select:focus,.field textarea:focus,.toolbar input:focus{border-color:#a9873d}.field textarea{min-height:92px;resize:vertical}.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{border:1px solid #34373d;border-radius:999px;padding:7px 10px;background:#17181b;color:#aeb3bb;cursor:pointer}.chip.selected{border-color:#8e7134;background:#28200f;color:#e3c371}.checks{display:flex;flex-wrap:wrap;gap:10px 18px;color:#c0c4cb}.formActions{display:flex;justify-content:flex-end;gap:10px}.toolbar{display:flex;gap:12px;padding:15px;border-bottom:1px solid #24262a}.search{flex:1}.toolbar select{width:220px}.tableWrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:980px}th{padding:12px 14px;color:#6f757e;font-size:10px;text-transform:uppercase;letter-spacing:.09em;text-align:left;background:#0f1012}td{padding:14px;border-top:1px solid #202226;color:#c9cdd3;vertical-align:middle}td b{display:block;color:#f2f2ef;font-size:13px}td small{display:block;margin-top:4px;color:#777d86}.stage{display:inline-block;padding:6px 9px;border:1px solid #474036;border-radius:999px;background:#1c1912;color:#d7bd80;font-size:11px;font-weight:800}.serviceText{font-size:12px;color:#aab0b8}.date{font-size:12px;color:#9298a1}.date.due{color:#e28a8a;font-weight:800}.actionsCell{white-space:nowrap}.actionsCell button{border:0;background:transparent;color:#cbb06d;cursor:pointer;margin-right:10px}.actionsCell .danger{color:#b86d6d}.empty{text-align:center;padding:40px;color:#666b73}@media(max-width:900px){.app{grid-template-columns:1fr}aside{position:static;height:auto;border-right:0;border-bottom:1px solid #24262a}.signOut{position:static;width:100%;margin-top:12px}.metrics{grid-template-columns:repeat(2,1fr)}main{padding:20px}.formGrid{grid-template-columns:1fr}header{align-items:flex-start;flex-direction:column}.toolbar{flex-direction:column}.toolbar select{width:100%}}@media(max-width:520px){.metrics{grid-template-columns:1fr 1fr}.metric{padding:14px}.metric strong{font-size:24px}}
`;

export default App;
