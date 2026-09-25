
import { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

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

const STATUSES = ["New","Scheduled","In Progress","Ready for Inspection","Completed","Invoiced"];
const SERVICES = ["Full Paint","Cleaning","Turnover / Make-ready","Breezeway","Minor Repairs","Ceiling Painting","Other"];

const blankOrder = () => ({
  id:"", workOrder:"", property:"", manager:"", email:"", phone:"", address:"",
  building:"", unit:"", service:"Full Paint", status:"New", scheduledDate:"",
  dueDate:"", sqft:"", rate:"", amount:"", technician:"", notes:"",
  createdAt:"", updatedAt:""
});

function App(){
  const [user,setUser]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [login,setLogin]=useState({email:"",password:""});
  const [orders,setOrders]=useState(()=>{
    try{return JSON.parse(localStorage.getItem("mc_work_orders_v1")||"[]");}catch{return []}
  });
  const [form,setForm]=useState(blankOrder());
  const [editingId,setEditingId]=useState(null);
  const [view,setView]=useState("dashboard");
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("All");
  const [invoiceOrder,setInvoiceOrder]=useState(null);

  useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setAuthLoading(false)}),[]);
  useEffect(()=>localStorage.setItem("mc_work_orders_v1",JSON.stringify(orders)),[orders]);

  const visible=useMemo(()=>orders.filter(o=>{
    const hay=[o.workOrder,o.property,o.manager,o.unit,o.building,o.service,o.status,o.notes].join(" ").toLowerCase();
    return (statusFilter==="All"||o.status===statusFilter)&&hay.includes(search.toLowerCase());
  }),[orders,statusFilter,search]);

  const metrics={
    open:orders.filter(o=>!["Completed","Invoiced"].includes(o.status)).length,
    progress:orders.filter(o=>o.status==="In Progress").length,
    ready:orders.filter(o=>o.status==="Ready for Inspection").length,
    completed:orders.filter(o=>["Completed","Invoiced"].includes(o.status)).length
  };

  function startNew(){setEditingId(null);setForm(blankOrder());setView("new");}
  function editOrder(o){setEditingId(o.id);setForm({...blankOrder(),...o});setView("new");window.scrollTo({top:0,behavior:"smooth"});}
  function saveOrder(){
    if(!form.property.trim()||!form.unit.trim()) return alert("Property y Unit son requeridos.");
    const now=new Date().toISOString();
    const computed = Number(form.sqft)&&Number(form.rate) ? (Number(form.sqft)*Number(form.rate)).toFixed(2) : "";
    const item={...form,amount:form.amount||computed,id:editingId||String(Date.now()),createdAt:form.createdAt||now,updatedAt:now};
    setOrders(old=>editingId?old.map(o=>o.id===editingId?item:o):[item,...old]);
    setEditingId(null); setForm(blankOrder()); setView("orders");
  }
  function removeOrder(id){if(window.confirm("¿Borrar este Work Order?"))setOrders(old=>old.filter(o=>o.id!==id));}
  function updateStatus(id,status){setOrders(old=>old.map(o=>o.id===id?{...o,status,updatedAt:new Date().toISOString()}:o));}
  async function doLogin(){try{await signInWithEmailAndPassword(auth,login.email,login.password)}catch(e){alert("No pude iniciar sesión: "+e.message)}}

  if(authLoading)return <div className="center">Loading…</div>;

  if(!user)return <>
    <style>{styles}</style>
    <div className="loginPage">
      <div className="loginWrap">
        <img src="/mc-logo.png" alt="MC Property Solutions" className="loginLogo"/>
        <div className="kicker">MC PROPERTY SOLUTIONS</div>
        <h1>Field Operations</h1>
        <p>Work orders, field status and invoice handoff.</p>
        <input placeholder="Email" type="email" value={login.email} onChange={e=>setLogin({...login,email:e.target.value})}/>
        <input placeholder="Password" type="password" value={login.password} onChange={e=>setLogin({...login,password:e.target.value})} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
        <button className="goldBtn full" onClick={doLogin}>Sign in</button>
      </div>
    </div>
  </>;

  return <>
    <style>{styles}</style>
    <div className="shell">
      <aside>
        <div className="brandBlock">
          <img src="/mc-logo.png" alt="MCPS"/>
          <div><b>MC PROPERTY</b><span>SOLUTIONS</span></div>
        </div>
        <div className="navLabel">OPERATIONS</div>
        <button className={view==="dashboard"?"nav active":"nav"} onClick={()=>setView("dashboard")}>Dashboard</button>
        <button className={view==="orders"?"nav active":"nav"} onClick={()=>setView("orders")}>Work Orders</button>
        <button className={view==="new"?"nav active":"nav"} onClick={startNew}>New Work Order</button>
        <button className="nav" onClick={()=>{setStatusFilter("Ready for Inspection");setView("orders")}}>Ready for Inspection</button>
        <button className="nav" onClick={()=>{setStatusFilter("Completed");setView("orders")}}>Completed</button>
        <div className="navLabel">ACCOUNT</div>
        <button className="nav" onClick={()=>signOut(auth)}>Sign out</button>
      </aside>

      <main>
        <header>
          <div><div className="kicker">MC PROPERTY SOLUTIONS</div><h1>{view==="dashboard"?"Operations Dashboard":view==="orders"?"Work Orders":"Work Order"}</h1><p>{user.email}</p></div>
          <button className="goldBtn" onClick={startNew}>＋ New Work Order</button>
        </header>

        {view==="dashboard" && <>
          <section className="hero">
            <div><div className="kicker">FIELD OPERATIONS</div><h2>Clear work. Clear status. Clean handoff.</h2><p>Track each apartment from authorization through completion and invoice.</p></div>
            <div className="heroMark">MC</div>
          </section>
          <section className="metrics">
            <Metric label="Open" value={metrics.open}/>
            <Metric label="In Progress" value={metrics.progress}/>
            <Metric label="Ready" value={metrics.ready}/>
            <Metric label="Completed" value={metrics.completed}/>
          </section>
          <section className="panel">
            <div className="panelHead"><div><div className="kicker">RECENT</div><h3>Latest Work Orders</h3></div><button className="ghostBtn" onClick={()=>setView("orders")}>View all</button></div>
            <OrderTable orders={orders.slice(0,6)} editOrder={editOrder} removeOrder={removeOrder} updateStatus={updateStatus} onInvoice={setInvoiceOrder}/>
          </section>
        </>}

        {view==="orders" && <section className="panel">
          <div className="toolbar">
            <input placeholder="Search property, unit, manager, service…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option>All</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
            <button className="goldBtn" onClick={startNew}>＋ Add</button>
          </div>
          <OrderTable orders={visible} editOrder={editOrder} removeOrder={removeOrder} updateStatus={updateStatus} onInvoice={setInvoiceOrder}/>
        </section>}

        {view==="new" && <section className="panel formPanel">
          <div className="panelHead"><div><div className="kicker">WORK ORDER</div><h3>{editingId?"Edit Work Order":"Create Work Order"}</h3></div></div>
          <div className="formGrid">
            <Field label="Work Order #"><input value={form.workOrder} onChange={e=>setForm({...form,workOrder:e.target.value})}/></Field>
            <Field label="Property"><input value={form.property} onChange={e=>setForm({...form,property:e.target.value})}/></Field>
            <Field label="Manager"><input value={form.manager} onChange={e=>setForm({...form,manager:e.target.value})}/></Field>
            <Field label="Email"><input value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
            <Field label="Phone"><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></Field>
            <Field label="Address"><input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></Field>
            <Field label="Building"><input value={form.building} onChange={e=>setForm({...form,building:e.target.value})}/></Field>
            <Field label="Unit"><input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})}/></Field>
            <Field label="Service"><select value={form.service} onChange={e=>setForm({...form,service:e.target.value})}>{SERVICES.map(s=><option key={s}>{s}</option>)}</select></Field>
            <Field label="Status"><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></Field>
            <Field label="Scheduled"><input type="date" value={form.scheduledDate} onChange={e=>setForm({...form,scheduledDate:e.target.value})}/></Field>
            <Field label="Due Date"><input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/></Field>
            <Field label="Sq Ft"><input inputMode="decimal" value={form.sqft} onChange={e=>setForm({...form,sqft:e.target.value})}/></Field>
            <Field label="Rate"><input inputMode="decimal" value={form.rate} onChange={e=>setForm({...form,rate:e.target.value})}/></Field>
            <Field label="Amount"><input inputMode="decimal" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></Field>
            <Field label="Assigned To"><input value={form.technician} onChange={e=>setForm({...form,technician:e.target.value})}/></Field>
          </div>
          <Field label="Notes"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
          <div className="formActions"><button className="ghostBtn" onClick={()=>setView("orders")}>Cancel</button><button className="goldBtn" onClick={saveOrder}>Save Work Order</button></div>
        </section>}
      </main>
    </div>
    {invoiceOrder && <InvoiceModal order={invoiceOrder} onClose={()=>setInvoiceOrder(null)}/>}
  </>;
}

function Metric({label,value}){return <div className="metric"><span>{label}</span><strong>{value}</strong></div>}
function Field({label,children}){return <label className="field"><span>{label}</span>{children}</label>}

function OrderTable({orders,editOrder,removeOrder,updateStatus,onInvoice}){
  return <div className="tableWrap"><table><thead><tr><th>WO</th><th>Property / Unit</th><th>Service</th><th>Status</th><th>Due</th><th>Amount</th><th></th></tr></thead>
  <tbody>{orders.length===0?<tr><td colSpan="7" className="empty">No work orders found.</td></tr>:orders.map(o=><tr key={o.id}>
    <td><b>{o.workOrder||"—"}</b></td>
    <td><b>{o.property}</b><small>{"Building "+(o.building||"—")+" · Unit "+(o.unit||"—")+(o.manager?" · "+o.manager:"")}</small></td>
    <td>{o.service}</td>
    <td><select className="statusSelect" value={o.status} onChange={e=>updateStatus(o.id,e.target.value)}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></td>
    <td>{o.dueDate||"—"}</td>
    <td>{o.amount?"$"+Number(o.amount).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}):"—"}</td>
    <td className="actionsCell"><button onClick={()=>editOrder(o)}>Edit</button><button onClick={()=>onInvoice(o)}>Invoice</button><button className="danger" onClick={()=>removeOrder(o.id)}>Delete</button></td>
  </tr>)}</tbody></table></div>
}

function InvoiceModal({order,onClose}){
  const amount=Number(order.amount||0);
  const invoiceNo=order.workOrder?order.workOrder.replace(/^WO[- ]?/i,"INV-"):"INV-"+(order.unit||Date.now());
  return <div className="modal">
    <div className="invoiceCard">
      <div className="invoiceToolbar"><button className="ghostBtn" onClick={onClose}>Close</button><button className="goldBtn" onClick={()=>window.print()}>Print / Save PDF</button></div>
      <section className="invoiceSheet">
        <div className="invTop"><div><div className="invBrand">MC PROPERTY SOLUTIONS</div><div className="invTag">QUALITY SPACES. STRONGER COMMUNITIES.</div></div><div className="invTitle">INVOICE</div></div>
        <div className="invGrid">
          <div><h4>Bill To</h4><p><b>{order.manager||"Property Manager"}</b><br/>{order.property}<br/>{order.address||""}<br/>{order.email||""}<br/>{order.phone||""}</p></div>
          <div><h4>Invoice Details</h4><p>Invoice #: <b>{invoiceNo}</b><br/>Work Order #: <b>{order.workOrder||"—"}</b><br/>Unit #: <b>{order.unit||"—"}</b><br/>Building #: <b>{order.building||"—"}</b><br/>Invoice Date: <b>{new Date().toLocaleDateString()}</b></p></div>
        </div>
        <table className="invoiceTable"><thead><tr><th>Description</th><th>Units</th><th>Cost</th><th>Quantity</th><th>Amount</th></tr></thead>
        <tbody><tr><td><b>{order.service}</b><br/><small>{order.notes||"Authorized work completed per work order."}</small></td><td>{order.sqft?"Sq Ft":"Service"}</td><td>{order.rate?"$"+Number(order.rate).toFixed(2):"$"+amount.toFixed(2)}</td><td>{order.sqft||1}</td><td>{"$"+amount.toFixed(2)}</td></tr></tbody></table>
        <div className="invBottom"><div><h4>Notes</h4><p>{order.notes||"Thank you for your trust and partnership."}</p></div><div className="totals"><p><span>Subtotal</span><b>{"$"+amount.toFixed(2)}</b></p><p><span>Taxes</span><b>—</b></p><p className="total"><span>Total</span><b>{"$"+amount.toFixed(2)}</b></p></div></div>
        <div className="signature">Manager's Signature ______________________________</div>
      </section>
    </div>
  </div>
}

const styles = [
"*{box-sizing:border-box}",
"body{margin:0;font-family:Inter,Arial,sans-serif;background:#050709;color:#f5f5f2}",
"button,input,select,textarea{font:inherit}",
".center,.loginPage{min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 0,rgba(211,170,65,.16),transparent 30%),linear-gradient(135deg,#030405,#0b1116,#030405)}",
".loginWrap{width:min(430px,92vw);padding:38px;border:1px solid rgba(211,170,65,.45);border-radius:28px;background:rgba(5,8,11,.94);box-shadow:0 30px 90px #000}",
".loginLogo{width:190px;display:block;margin:0 auto 14px;filter:drop-shadow(0 0 22px rgba(211,170,65,.35))}",
".loginWrap h1{margin:4px 0 8px}.loginWrap p{color:#8f969e;margin:0 0 24px}.loginWrap input{width:100%;margin-bottom:12px}.full{width:100%}",
".goldBtn,.ghostBtn{border:0;border-radius:10px;padding:11px 16px;font-weight:800;cursor:pointer}",
".goldBtn{background:linear-gradient(180deg,#f0ce72,#b88218);color:#111}.ghostBtn{background:#181b1f;color:#f4f4f2;border:1px solid #2d3137}",
".kicker{color:#d6af4e;font-size:11px;font-weight:900;letter-spacing:.16em}",
".shell{min-height:100vh;display:grid;grid-template-columns:250px 1fr;background:linear-gradient(135deg,#050607,#0b1117,#050607)}",
"aside{position:sticky;top:0;height:100vh;padding:20px 14px;border-right:1px solid rgba(211,170,65,.28);background:#07090b}",
".brandBlock{display:flex;gap:10px;align-items:center;padding:6px 8px 24px}.brandBlock img{width:58px}.brandBlock b{display:block;font-size:14px}.brandBlock span{display:block;color:#d6af4e;letter-spacing:.15em;font-size:10px}",
".navLabel{margin:20px 10px 8px;color:#626972;font-size:10px;font-weight:900;letter-spacing:.14em}",
".nav{width:100%;padding:12px;border:0;border-radius:10px;background:transparent;color:#aab0b8;text-align:left;cursor:pointer}.nav:hover,.nav.active{background:#171a1e;color:#fff;box-shadow:inset 2px 0 #d6af4e}",
"main{min-width:0;padding:32px;max-width:1500px;width:100%;margin:auto}header{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:22px}header h1{margin:5px 0 2px;font-size:30px}header p{margin:0;color:#858b93}",
".hero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:28px;border:1px solid rgba(211,170,65,.24);border-radius:20px;background:radial-gradient(circle at 80% 30%,rgba(211,170,65,.15),transparent 30%),linear-gradient(135deg,#11151a,#090b0e);box-shadow:0 30px 70px #0006}",
".hero h2{font-size:38px;max-width:650px;margin:8px 0}.hero p{color:#9da3ab}.heroMark{width:110px;height:110px;border-radius:50%;display:grid;place-items:center;font-size:36px;font-weight:900;background:radial-gradient(circle at 30% 20%,#fff0a9,#d6af4e,#755310);color:#111}",
".metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:18px 0}.metric,.panel{border:1px solid #262a30;background:#0d1014;border-radius:16px}.metric{padding:18px}.metric span{color:#828992;font-size:12px;font-weight:800}.metric strong{display:block;margin-top:6px;font-size:30px}",
".panel{overflow:hidden}.formPanel{padding:22px}.panelHead{display:flex;justify-content:space-between;align-items:center;padding:18px 20px}.panelHead h3{margin:4px 0 0}.toolbar{display:flex;gap:12px;padding:15px;border-bottom:1px solid #23272d}.toolbar input{flex:1}.toolbar select{width:220px}",
".field{display:block;margin-bottom:14px}.field>span{display:block;margin-bottom:7px;color:#969da6;font-size:12px;font-weight:800}.field input,.field select,.field textarea,.toolbar input,.toolbar select,.loginWrap input{width:100%;border:1px solid #30353c;border-radius:10px;background:#080a0d;color:#f4f4f2;padding:11px 12px;outline:none}.field textarea{min-height:110px;resize:vertical}.formGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.formActions{display:flex;justify-content:flex-end;gap:10px}",
".tableWrap{overflow:auto}table{width:100%;border-collapse:collapse;min-width:980px}th{padding:12px 14px;text-align:left;color:#737a84;font-size:10px;letter-spacing:.1em;text-transform:uppercase;background:#090b0e}td{padding:14px;border-top:1px solid #22262c;color:#c7ccd2}td b{display:block;color:#f1f1ef}td small{display:block;margin-top:4px;color:#777f89}.statusSelect{border:1px solid #5d4b28;background:#17130b;color:#e1c176;border-radius:999px;padding:7px 10px}.actionsCell{white-space:nowrap}.actionsCell button{border:0;background:transparent;color:#d6af4e;cursor:pointer;margin-right:9px}.actionsCell .danger{color:#c87373}.empty{text-align:center;padding:40px;color:#666e78}",
".modal{position:fixed;inset:0;background:#000c;z-index:50;overflow:auto;padding:30px}.invoiceCard{max-width:980px;margin:auto}.invoiceToolbar{display:flex;justify-content:flex-end;gap:10px;margin-bottom:12px}.invoiceSheet{background:white;color:#111;padding:36px;border-radius:4px;min-height:1050px}.invTop{display:flex;justify-content:space-between;border-bottom:4px solid #111;padding-bottom:18px}.invBrand{font-size:26px;font-weight:900}.invTag{font-size:10px;letter-spacing:.28em;color:#9b7a2b;margin-top:5px}.invTitle{font-size:42px;font-weight:900;color:#b88a25}.invGrid{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin:28px 0}.invGrid h4,.invBottom h4{margin:0 0 8px;color:#9b7a2b}.invGrid p,.invBottom p{line-height:1.6;margin:0}.invoiceTable{min-width:0;border:1px solid #ddd}.invoiceTable th{background:#111;color:#d8b250}.invoiceTable td{color:#111;border-color:#ddd}.invoiceTable small{color:#555}.invBottom{display:grid;grid-template-columns:1fr 320px;gap:30px;margin-top:24px}.totals p{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #ddd}.totals .total{font-size:22px;border-top:3px solid #111;border-bottom:0}.signature{margin-top:70px;border-top:1px solid #bbb;padding-top:12px}",
"@media(max-width:900px){.shell{grid-template-columns:1fr}aside{position:static;height:auto}.metrics{grid-template-columns:repeat(2,1fr)}.formGrid{grid-template-columns:1fr}header{align-items:flex-start;flex-direction:column}main{padding:18px}.toolbar{flex-direction:column}.toolbar select{width:100%}.hero{align-items:flex-start}.heroMark{display:none}.invGrid,.invBottom{grid-template-columns:1fr}}",
"@media print{body *{visibility:hidden}.invoiceSheet,.invoiceSheet *{visibility:visible}.invoiceSheet{position:absolute;inset:0;border-radius:0;min-height:auto}.modal{padding:0;background:white}.invoiceToolbar{display:none}}"
].join("");

export default App;
