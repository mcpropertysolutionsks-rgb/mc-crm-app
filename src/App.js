import { useEffect, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCDJI-5TN_EfQoKbdBLpD0sUm8AGQgC7YU",
  authDomain: "mc-crm-ac51e.firebaseapp.com",
  projectId: "mc-crm-ac51e",
  storageBucket: "mc-crm-ac51e.firebasestorage.app",
  messagingSenderId: "582721987377",
  appId: "1:582721987377:web:fc5206c3582ceb88414610"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const importInputRef = useRef(null);

  const emptyForm = {
    company: "",
    contact: "",
    email: "",
    phone: "",
    address: "",
    status: "Nueva",
    followUpDate: "",
    notes: "",
  };

  const [form, setForm] = useState(emptyForm);

  const [leads, setLeads] = useState(() => {
    try {
      const saved = localStorage.getItem("mc_leads");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("No pude cargar mc_leads desde localStorage:", error);
      return [];
    }
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("mc_leads", JSON.stringify(leads));
    } catch (error) {
      console.error("No pude guardar mc_leads en localStorage:", error);
    }
  }, [leads]);

  function persistLeads(nextLeads) {
    try {
      localStorage.setItem("mc_leads", JSON.stringify(nextLeads));
      setLeads(nextLeads);
      return true;
    } catch (error) {
      console.error("No pude guardar mc_leads en localStorage:", error);
      alert("No pude guardar el lead en este dispositivo. Revisa el almacenamiento del navegador e intenta otra vez.");
      return false;
    }
  }

  const today = new Date().toISOString().split("T")[0];

  const followToday = leads.filter((l) => l.followUpDate === today).length;
  const followOverdue = leads.filter((l) => l.followUpDate && l.followUpDate < today).length;
  const followUpcoming = leads.filter((l) => l.followUpDate && l.followUpDate > today).length;

  function normalizeCsvHeader(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "");
  }

  function parseCsvLine(line) {
    const cells = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === ',' && !inQuotes) {
        cells.push(current);
        current = "";
        continue;
      }

      current += char;
    }

    cells.push(current);
    return cells.map((cell) => cell.trim());
  }

  function parseCsvText(text) {
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseCsvLine);
  }

  function buildLeadFromHeaders(row, headers, index) {
    const normalizedHeaders = headers.map(normalizeCsvHeader);
    const source = {};

    normalizedHeaders.forEach((header, headerIndex) => {
      source[header] = row[headerIndex] ?? "";
    });

    const pick = (...keys) => {
      for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null && String(source[key]).trim() !== "") {
          return String(source[key]).trim();
        }
      }
      return "";
    };

    const notesParts = [];
    const baseNotes = pick("notes", "nota", "notas", "comments", "comment", "description", "descripcion");
    const service = pick("service", "servicio");
    const sourceName = pick("source", "fuente", "origin", "origen");
    const score = pick("score", "puntaje", "rating");
    const website = pick("website", "web", "site", "url");

    if (baseNotes) notesParts.push(baseNotes);
    if (service) notesParts.push(`Service: ${service}`);
    if (sourceName) notesParts.push(`Source: ${sourceName}`);
    if (score) notesParts.push(`Score: ${score}`);
    if (website) notesParts.push(`Website: ${website}`);

    const status = pick("status", "estado") || "Nueva";
    const followUpDate = pick("followupdate", "followup", "followupfecha", "nextfollowup", "nextfollowupdate", "seguimiento");
    const company = pick("company", "compania", "empresa", "business", "businessname", "name", "leadname");
    const contact = pick("contact", "contacto", "name", "fullname", "nombre", "leadname") || company;
    const email = pick("email", "correo", "mail");
    const phone = pick("phone", "telefono", "celular", "mobile", "whatsapp");
    const address = pick("address", "direccion", "city", "ciudad", "location");

    return {
      id: Date.now() + index,
      createdAt: new Date().toLocaleDateString("es-US"),
      company,
      contact,
      email,
      phone,
      address,
      status,
      followUpDate,
      notes: notesParts.join(" | "),
    };
  }

  function buildLeadFromFallbackRow(row, index) {
    const value = (position) => String(row[position] ?? "").trim();

    const company = value(1) || value(0);
    const contact = value(0) || value(1);
    const email = value(3) || value(2);
    const phone = value(2) || value(3);
    const address = value(4);
    const status = value(8) || value(5) || "Nueva";
    const followUpDate = value(6);
    const notesParts = [value(7), value(5)].filter(Boolean);

    return {
      id: Date.now() + index,
      createdAt: new Date().toLocaleDateString("es-US"),
      company,
      contact,
      email,
      phone,
      address,
      status,
      followUpDate,
      notes: notesParts.join(" | "),
    };
  }


  function leadKey(lead) {
    return [lead.company, lead.contact, lead.email, lead.phone].join("|").toLowerCase();
  }

  function mergeImportedLeads(currentLeads, importedLeads) {
    const merged = [...importedLeads, ...currentLeads];
    const seen = new Set();

    return merged.filter((lead) => {
      const key = leadKey(lead);

      if (key === "|||") {
        return true;
      }

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  function buildLeadFromChapie(lead, index) {
    const title = String(lead.title || lead.name || "Chapie lead").replace(/^Potential painting client:\s*/i, "").trim();
    const notesParts = [
      lead.description || "",
      lead.opportunity ? `Opportunity: ${lead.opportunity}` : "",
      lead.recommendedService ? `Service: ${lead.recommendedService}` : "",
      lead.temperature ? `Temperature: ${lead.temperature}` : "",
      lead.leadCategory ? `Category: ${lead.leadCategory}` : "",
      lead.needSignalType ? `Need signal: ${lead.needSignalType}` : "",
      lead.contactUrl ? `Website: ${lead.contactUrl}` : "",
      lead.url ? `Source: ${lead.url}` : "",
      lead.outreachScript ? `Script: ${lead.outreachScript}` : "",
    ].filter(Boolean);

    return {
      id: Date.now() + index,
      createdAt: new Date().toLocaleDateString("es-US"),
      company: title,
      contact: title,
      email: lead.email || "",
      phone: lead.phone || "",
      address: lead.area || "",
      status: "Nueva",
      followUpDate: "",
      notes: notesParts.join(" | "),
    };
  }

  async function importChapieOlatheLeads() {
    try {
      const response = await fetch("https://mc-property-agent-4syy.vercel.app/api/lead-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "both",
          kind: "painting",
          area: "olathe",
          maxQueries: 6,
          maxCards: 100,
          autoSave: false,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || result.note || `Chapie responded ${response.status}`);
      }

      const importedLeads = (result.leads || [])
        .filter((lead) => lead.phone || lead.email)
        .map(buildLeadFromChapie);

      if (importedLeads.length === 0) {
        alert("Chapie no encontro leads con telefono o email cerca de Olathe.");
        return;
      }

      setLeads((currentLeads) => mergeImportedLeads(currentLeads, importedLeads));
      setSearch("");
      clearForm();
      alert(`Importados ${importedLeads.length} lead(s) desde Chapie Olathe.`);
    } catch (error) {
      alert("No pude importar desde Chapie: " + error.message);
    }
  }
  async function importCSV(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    try {
      const text = await file.text();
      const rows = parseCsvText(text);

      if (rows.length === 0) {
        alert("El archivo esta vacio.");
        return;
      }

      const firstRow = rows[0];
      const normalizedFirstRow = firstRow.map(normalizeCsvHeader);
      const headerHints = new Set([
        "company",
        "contact",
        "contacto",
        "email",
        "phone",
        "telefono",
        "address",
        "direccion",
        "status",
        "estado",
        "followup",
        "followupdate",
        "notes",
        "notas",
        "name",
        "companyname",
        "source",
        "score",
        "website",
        "city",
        "ciudad",
      ]);

      const hasHeaders = normalizedFirstRow.some((header) => headerHints.has(header));
      const dataRows = hasHeaders ? rows.slice(1) : rows;

      const importedLeads = dataRows
        .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
        .map((row, index) => (hasHeaders ? buildLeadFromHeaders(row, firstRow, index) : buildLeadFromFallbackRow(row, index)))
        .filter((lead) => lead.company || lead.contact || lead.email || lead.phone || lead.notes);

      if (importedLeads.length === 0) {
        alert("No pude detectar leads en ese archivo CSV.");
        return;
      }

      const replaceCurrent = window.confirm(
        `Encontre ${importedLeads.length} leads.\n\nAceptar = reemplazar los leads actuales.\nCancelar = agregarlos al inicio.`
      );

      setLeads((currentLeads) => {
        if (replaceCurrent) {
          return importedLeads;
        }

        const merged = [...importedLeads, ...currentLeads];
        const seen = new Set();

        return merged.filter((lead) => {
          const key = [lead.company, lead.contact, lead.email, lead.phone].join("|").toLowerCase();

          if (key === "|||") {
            return true;
          }

          if (seen.has(key)) {
            return false;
          }

          seen.add(key);
          return true;
        });
      });

      setSearch("");
      clearForm();
      alert(`Importados ${importedLeads.length} lead(s) desde CSV.`);
    } catch (error) {
      alert("No pude importar el CSV: " + error.message);
    }
  }
  function handleLoginChange(e) {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  }

  async function login() {
    try {
      await signInWithEmailAndPassword(auth, loginData.email, loginData.password);
    } catch (error) {
      alert("Error login: " + error.message);
    }
  }

  async function register() {
    try {
      await createUserWithEmailAndPassword(auth, loginData.email, loginData.password);
    } catch (error) {
      alert("Error registro: " + error.message);
    }
  }

  async function logout() {
    await signOut(auth);
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function clearForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function saveLead() {
    const company = form.company.trim();
    const contact = form.contact.trim();

    if (!company && !contact) {
      alert("Pon por lo menos compania o contacto.");
      return;
    }

    const normalizedForm = {
      ...form,
      company: company || contact,
      contact: contact || company,
    };

    if (editingId) {
      const nextLeads = leads.map((lead) =>
        lead.id === editingId ? { ...lead, ...normalizedForm } : lead
      );

      if (persistLeads(nextLeads)) {
        clearForm();
      }
      return;
    }

    const newLead = {
      id: Date.now(),
      createdAt: new Date().toLocaleDateString("es-US"),
      ...normalizedForm,
    };

    const nextLeads = [newLead, ...leads];

    if (persistLeads(nextLeads)) {
      clearForm();
    }
  }

  function editLead(lead) {
    setEditingId(lead.id);
    setForm({
      company: lead.company || "",
      contact: lead.contact || "",
      email: lead.email || "",
      phone: lead.phone || "",
      address: lead.address || "",
      status: lead.status || "Nueva",
      followUpDate: lead.followUpDate || "",
      notes: lead.notes || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteLead(id) {
    if (window.confirm("Seguro que quieres borrar este lead?")) {
      persistLeads(leads.filter((lead) => lead.id !== id));
    }
  }

  const filteredLeads = leads.filter((lead) => {
    const text = `${lead.company} ${lead.contact} ${lead.email} ${lead.phone} ${lead.address} ${lead.status} ${lead.followUpDate} ${lead.notes}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  function exportCSV() {
    if (leads.length === 0) {
      alert("No hay leads para exportar.");
      return;
    }

    const headers = ["Company", "Contact", "Email", "Phone", "Address", "Status", "Follow Up", "Notes", "Created"];

    const rows = leads.map((lead) => [
      lead.company,
      lead.contact,
      lead.email,
      lead.phone,
      lead.address,
      lead.status,
      lead.followUpDate || "",
      lead.notes,
      lead.createdAt || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((item) => `"${String(item || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "mc-property-leads.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  function followClass(date) {
    if (!date) return "followDate";
    if (date === today) return "dueToday";
    if (date < today) return "overdue";
    return "followDate";
  }

  if (authLoading) {
    return (
      <>
        <style>{styles}</style>
      <input ref={importInputRef} type="file" accept=".csv,text/csv" onChange={importCSV} style={{ display: "none" }} />
        <div className="loginScreen">
          <h1>Cargando...</h1>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <style>{styles}</style>
      <input ref={importInputRef} type="file" accept=".csv,text/csv" onChange={importCSV} style={{ display: "none" }} />

        <div className="loginScreen">
          <div className="brand">
            <img src="/mc-logo.png" alt="MC Property Solutions" />
            <h1>MC PROPERTY</h1>
            <h2>SOLUTIONS</h2>
          </div>

          <div className="loginBox">
            <h3>WELCOME BACK</h3>
            <p>Sign in to your CRM</p>

            <div className="inputRow">
              <span>@</span>
              <input
                name="email"
                type="email"
                value={loginData.email}
                onChange={handleLoginChange}
                placeholder="Email"
              />
            </div>

            <div className="inputRow">
              <span>*</span>
              <input
                name="password"
                type="password"
                value={loginData.password}
                onChange={handleLoginChange}
                placeholder="Password"
                onKeyDown={(e) => e.key === "Enter" && login()}
              />
            </div>

            <button className="goldBtn loginFull" onClick={login}>
              LOGIN
            </button>

            <button className="darkBtn loginFull" onClick={register}>
              CREAR CUENTA
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <input ref={importInputRef} type="file" accept=".csv,text/csv" onChange={importCSV} style={{ display: "none" }} />

      <div className="dashboard">
        <aside className="sidebar">
          <img src="/mc-logo.png" alt="MC Logo" />
          <h2>MC PROPERTY</h2>
          <p>SOLUTIONS</p>

          <button>Dashboard</button>
          <button>Leads</button>
          <button>Follow Ups</button>
          <button onClick={importChapieOlatheLeads}>Importar Chapie Olathe</button>
          <button onClick={() => importInputRef.current?.click()}>Importar CSV</button>
          <button onClick={exportCSV}>Exportar CSV</button>

          <button className="logout" onClick={logout}>
         Cerrar Sesion
          </button>
        </aside>

        <main className="main">
          <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
  <div>
    <h1>BIENVENIDO, MC PROPERTY</h1>
    <small>{user.email}</small>
  </div>
  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
    <button
      type="button"
      onClick={importChapieOlatheLeads}
      style={{ padding: "10px 14px", borderRadius: "12px", border: "1px solid #38bdf8", background: "#062033", color: "#8ee7ff", fontWeight: 700, cursor: "pointer" }}
    >
      Importar Chapie Olathe
    </button>
    <button
      type="button"
      onClick={() => importInputRef.current?.click()}
      style={{ padding: "10px 14px", borderRadius: "12px", border: "1px solid #d4a72c", background: "#111", color: "#f5c84c", fontWeight: 700, cursor: "pointer" }}
    >
      Importar CSV
    </button>
    <button
      type="button"
      onClick={exportCSV}
      style={{ padding: "10px 14px", borderRadius: "12px", border: "none", background: "linear-gradient(180deg, #f5c84c, #c98d12)", color: "#111", fontWeight: 800, cursor: "pointer" }}
    >
      Exportar CSV
    </button>
    <span>
    Fecha:{" "}
      {new Date().toLocaleDateString("es-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}
    </span>
  </div>
</header>

          {(followToday > 0 || followOverdue > 0) && (
            <div className="alertBanner">
             Tienes {followToday} follow-up para hoy y {followOverdue} vencido(s).
            </div>
          )}

          <section className="stats">
            <div><b>NUEVOS</b><strong>{leads.filter((l) => l.status === "Nueva").length}</strong></div>
            <div><b>SEGUIMIENTO</b><strong>{leads.filter((l) => l.status === "En Seguimiento").length}</strong></div>
            <div><b>CERRADOS</b><strong>{leads.filter((l) => l.status === "Cerrado").length}</strong></div>
            <div><b>TOTAL</b><strong>{leads.length}</strong></div>
          </section>

          <section className="stats followStats">
            <div><b>FOLLOW-UP HOY</b><strong>{followToday}</strong></div>
            <div><b>VENCIDOS</b><strong>{followOverdue}</strong></div>
            <div><b>PROXIMOS</b><strong>{followUpcoming}</strong></div>
            <div><b>SIN FECHA</b><strong>{leads.filter((l) => !l.followUpDate).length}</strong></div>
          </section>

          <section className="formBox">
            <h2>{editingId ? "EDITAR LEAD" : "AGREGAR LEAD"}</h2>

            <div className="grid">
              <input name="company" value={form.company} onChange={handleChange} placeholder="Nombre de Compania" />
              <input name="contact" value={form.contact} onChange={handleChange} placeholder="Nombre del Contacto" />
              <input name="email" value={form.email} onChange={handleChange} placeholder="Email" />
              <input name="phone" value={form.phone} onChange={handleChange} placeholder="Telefono" />
              <input name="address" value={form.address} onChange={handleChange} placeholder="Direccion" />

              <select name="status" value={form.status} onChange={handleChange}>
                <option>Nueva</option>
                <option>En Seguimiento</option>
                <option>Cerrado</option>
              </select>

              <input name="followUpDate" value={form.followUpDate} onChange={handleChange} type="date" />
            </div>

            <textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Notas"></textarea>

            <div className="actions">
              <button className="goldBtn" onClick={saveLead}>
                {editingId ? "ACTUALIZAR LEAD" : "GUARDAR LEAD"}
              </button>
              <button className="darkBtn" onClick={clearForm}>LIMPIAR</button>
            </div>
          </section>

          <section className="tableBox">
            <div className="tableTop">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por compania, contacto, email, telefono, follow-up o notas..."
              />
              <button className="darkBtn" onClick={() => importInputRef.current?.click()}>IMPORTAR CSV</button>
              <button className="darkBtn" onClick={importChapieOlatheLeads}>IMPORTAR CHAPIE OLATHE</button>
              <button className="goldBtn" onClick={exportCSV}>EXPORTAR CSV</button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>COMPANIA</th>
                  <th>CONTACTO</th>
                  <th>EMAIL</th>
                  <th>TELEFONO</th>
                  <th>DIRECCION</th>
                  <th>ESTADO</th>
                  <th>FOLLOW-UP</th>
                  <th>NOTAS</th>
                  <th>ACCIONES</th>
                </tr>
              </thead>

              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan="9">No hay leads encontrados.</td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.company}</td>
                      <td>{lead.contact}</td>
                      <td>
                        {lead.email ? <a href={`mailto:${lead.email}`} className="link">{lead.email}</a> : "-"}
                      </td>
                      <td>
                        {lead.phone ? <a href={`tel:${lead.phone}`} className="link">{lead.phone}</a> : "-"}
                      </td>
                      <td>{lead.address}</td>
                      <td><span className="status">{lead.status}</span></td>
                      <td><span className={followClass(lead.followUpDate)}>{lead.followUpDate || "Sin fecha"}</span></td>
                      <td>{lead.notes}</td>
                      <td>
                        <button className="edit" onClick={() => editLead(lead)}>Editar</button>
                        <button className="delete" onClick={() => deleteLead(lead.id)}>Borrar</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </main>
      </div>
    </>
  );
}

const styles = `
* { box-sizing: border-box; }

body {
  margin: 0;
  background: #02070d;
  font-family: Arial, Helvetica, sans-serif;
}

.loginScreen {
  min-height: 100vh;
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at top, rgba(255,190,30,.2), transparent 25%),
    linear-gradient(135deg, #02070d, #061726, #02070d);
}

.brand { text-align: center; margin-bottom: 25px; }

.brand img {
  width: 230px;
  filter: drop-shadow(0 0 25px rgba(255,190,40,.8));
}

.brand h1 {
  margin: 5px 0 0;
  font-size: 48px;
  color: #ddd;
  letter-spacing: 3px;
}

.brand h2 {
  margin: 0;
  color: #f6c246;
  letter-spacing: 8px;
}

.loginBox {
  width: 520px;
  max-width: 90%;
  padding: 38px;
  border: 2px solid #c89115;
  border-radius: 24px;
  background: rgba(1, 12, 24, .92);
  text-align: center;
  box-shadow: 0 0 35px rgba(255,183,0,.2);
}

.loginBox h3 {
  color: #f5b51b;
  font-size: 32px;
  margin: 0;
}

.loginBox p { color: #d6d6d6; }

.loginFull {
  width: 100%;
  margin-top: 10px;
}

.inputRow {
  display: flex;
  align-items: center;
  height: 60px;
  border: 2px solid #b57912;
  border-radius: 8px;
  margin-bottom: 18px;
  background: rgba(4,20,35,.95);
}

.inputRow span {
  width: 60px;
  font-size: 24px;
}

.inputRow input {
  flex: 1;
  height: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: white;
  font-size: 22px;
}

.goldBtn {
  border: none;
  border-radius: 8px;
  padding: 14px 28px;
  background: linear-gradient(180deg, #ffd65a, #c78a0d);
  color: #050505;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 0 18px rgba(255,195,40,.25);
}

.darkBtn {
  border: 1px solid #6b7280;
  background: rgba(10,20,35,.8);
  color: white;
  border-radius: 8px;
  padding: 14px 28px;
  cursor: pointer;
}

.dashboard {
  min-height: 100vh;
  display: flex;
  color: white;
  background:
    radial-gradient(circle at top, rgba(0,120,180,.22), transparent 30%),
    linear-gradient(135deg, #02070d, #061726, #02070d);
}

.sidebar {
  width: 260px;
  padding: 28px 20px;
  border-right: 1px solid #b57912;
  background: rgba(0,10,20,.95);
}

.sidebar img {
  width: 150px;
  display: block;
  margin: 0 auto 10px;
}

.sidebar h2,
.sidebar p {
  text-align: center;
  margin: 0;
}

.sidebar p {
  color: #f5b51b;
  letter-spacing: 4px;
  margin-bottom: 35px;
}

.sidebar button {
  width: 100%;
  padding: 15px;
  margin-bottom: 12px;
  border: 1px solid rgba(255,183,0,.35);
  background: transparent;
  color: white;
  text-align: left;
  border-radius: 10px;
  cursor: pointer;
}

.sidebar button:hover { background: rgba(255,183,0,.18); }

.logout { margin-top: 80px; }

.main {
  flex: 1;
  padding: 30px;
  overflow-x: auto;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

header span {
  color: #f5b51b;
  font-weight: bold;
}

header small {
  color: #38bdf8;
}

.alertBanner {
  margin-top: 18px;
  padding: 18px 22px;
  border: 1px solid #ff6b6b;
  border-radius: 14px;
  background: rgba(127, 29, 29, 0.45);
  color: #ffd1d1;
  font-weight: 900;
  box-shadow: 0 0 25px rgba(255, 80, 80, 0.25);
}

.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 22px;
  margin: 25px 0;
}

.stats div,
.formBox,
.tableBox {
  padding: 22px;
  border: 1px solid #b57912;
  border-radius: 14px;
  background: rgba(0,15,30,.85);
  box-shadow: 0 0 20px rgba(0,0,0,.25);
}

.stats b,
.formBox h2 { color: #f5b51b; }

.stats strong {
  display: block;
  font-size: 42px;
  margin-top: 10px;
}

.followStats div:nth-child(1) strong { color: #38bdf8; }
.followStats div:nth-child(2) strong { color: #ff6b6b; }

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}

input,
select,
textarea {
  background: rgba(0,10,20,.95);
  border: 1px solid #b57912;
  border-radius: 8px;
  color: white;
  padding: 14px;
  font-size: 15px;
}

textarea {
  width: 100%;
  height: 80px;
  margin-top: 15px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 15px;
}

.tableTop {
  display: flex;
  gap: 15px;
  margin-bottom: 18px;
}

.tableTop input { flex: 1; }

table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1100px;
}

th {
  color: #f5b51b;
  text-align: left;
  padding: 14px;
  border-bottom: 1px solid #b57912;
}

td {
  padding: 14px;
  border-bottom: 1px solid rgba(181,121,18,.35);
}

.status,
.followDate,
.dueToday,
.overdue {
  border: 1px solid #f5b51b;
  padding: 6px 14px;
  border-radius: 6px;
  color: #f5b51b;
  white-space: nowrap;
}

.dueToday {
  border-color: #38bdf8;
  color: #38bdf8;
  box-shadow: 0 0 14px rgba(56,189,248,.35);
}

.overdue {
  border-color: #ff6b6b;
  color: #ff6b6b;
  box-shadow: 0 0 14px rgba(255,107,107,.35);
}

.link {
  color: #38bdf8;
  font-weight: bold;
  text-decoration: none;
}

.link:hover { text-decoration: underline; }

.edit,
.delete {
  padding: 8px 12px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  margin-right: 6px;
}

.edit {
  background: #d99a12;
  color: black;
}

.delete {
  background: #b91c1c;
  color: white;
}

@media (max-width: 1000px) {
  .dashboard { flex-direction: column; }
  .sidebar { width: 100%; }
  .stats, .grid { grid-template-columns: 1fr; }
  header { flex-direction: column; align-items: flex-start; }
  .tableTop { flex-direction: column; }
}
`;

export default App;
