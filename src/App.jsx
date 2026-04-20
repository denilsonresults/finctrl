import { useState, useEffect, useRef, useCallback } from "react";

// ─── Supabase ──────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://vwgumwnpgbybcocpzygq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Z3Vtd25wZ2J5YmNvY3B6eWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODI3NzYsImV4cCI6MjA5MTA1ODc3Nn0.7JeR226bGW9mGvbKUeboFNcmwp4NA9SF4DdRJDxD11k";

const sb = async (path, opts = {}) => {
  const { headers: extraHeaders, prefer, ...rest } = opts;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: prefer !== undefined ? prefer : "return=representation",
      ...extraHeaders,
    },
    ...rest,
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const db = {
  getCategories: () => sb("categories?order=code"),
  insertCategory: (cat) => sb("categories", { method: "POST", body: JSON.stringify(cat) }),
  updateCategory: (id, data) => sb(`categories?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCategory: (id) => sb(`categories?id=eq.${id}`, { method: "DELETE", prefer: "" }),
  getTransactions: () => sb("transactions?order=due_date.desc"),
  insertTransactions: (txs) => sb("transactions", { method: "POST", body: JSON.stringify(txs) }),
  updateTransaction: (id, data) => sb(`transactions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTransaction: (id) => sb(`transactions?id=eq.${id}`, { method: "DELETE", prefer: "" }),
  getCreditAnalyses: () => sb("credit_analyses?order=created_at.desc"),
  insertCreditAnalysis: (a) => sb("credit_analyses", { method: "POST", body: JSON.stringify(a) }),
  updateCreditAnalysis: (id, data) => sb(`credit_analyses?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// ─── Auth (senha local simples) ────────────────────────────────────────────
const APP_PASSWORD = "241441"; // ← altere aqui se quiser mudar a senha
const isAuthed = () => sessionStorage.getItem("cgf_auth") === "ok";
const setAuthed = () => sessionStorage.setItem("cgf_auth", "ok");
const clearAuthed = () => sessionStorage.removeItem("cgf_auth");

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmtDate = (iso) => { if (!iso) return ""; const [y,m,d] = String(iso).slice(0,10).split("-"); return `${d}/${m}/${y}`; };
const fmtCurrency = (v) => Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const parseCurrency = (s) => parseFloat(String(s).replace(/\./g,"").replace(",","."))||0;
const nowISO = () => new Date().toISOString().slice(0,10);
const monthKey = (iso) => String(iso).slice(0,7);
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const mapTx = (t) => ({ id:t.id, description:t.description, categoryId:t.category_id, env:t.env, dueDate:t.due_date, plannedValue:Number(t.planned_value), settled:t.settled, settledDate:t.settled_date, settledValue:Number(t.settled_value||0), recurGroup:t.recur_group });
const mapCat = (c) => ({ id:c.id, code:c.code, name:c.name, type:c.type, env:c.env });
const mapAnalysis = (a) => ({ id:a.id, cardName:a.card_name, dueDate:a.due_date, fileName:a.file_name, analyzedAt:a.analyzed_at, totalValue:Number(a.total_value), topExpenses:a.top_expenses||[], summary:a.summary||"", addedToCashFlow:a.added_to_cash_flow });
const getCatName = (id,cats) => cats.find(c=>c.id===id)?.name||"—";
const getCatType = (id,cats) => cats.find(c=>c.id===id)?.type||"";
const fileToBase64 = (file) => new Promise((res,rej) => { const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });

// ─── Login Screen ──────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const submit = () => {
    if (pw === APP_PASSWORD) { setAuthed(); onLogin(); }
    else { setErr(true); setTimeout(()=>setErr(false),2000); }
  };
  return (
    <div style={S.loginWrap}>
      <div style={S.loginBox}>
        <div style={S.loginLogo}>CGF</div>
        <h1 style={S.loginTitle}>Controle de Gestão Financeira</h1>
        <p style={S.loginSub}>Acesso restrito — informe a senha</p>
        <input
          type="password" placeholder="Senha" value={pw}
          onChange={e=>setPw(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&submit()}
          style={{ ...S.input, marginBottom:12, border: err?"2px solid #dc2626":"1px solid #bfdbfe" }}
        />
        {err && <p style={{color:"#dc2626",fontSize:13,marginBottom:8}}>Senha incorreta.</p>}
        <button style={S.btnPrimary} onClick={submit}>Entrar</button>
      </div>
    </div>
  );
}

// ─── App Root ──────────────────────────────────────────────────────────────
export default function App() {
  // Inject responsive CSS once
  useEffect(() => {
    const id = "cgf-responsive";
    if(!document.getElementById(id)) {
      const s = document.createElement("style");
      s.id = id;
      s.textContent = `
        @media (max-width: 860px) {
          .cgf-logo-title { font-size: 13px !important; }
          .cgf-logo-sub { display: none !important; }
          .cgf-env-label { display: none !important; }
        }
        @media (max-width: 600px) {
          .cgf-logo-title { display: none !important; }
        }
      `;
      document.head.appendChild(s);
    }
  }, []);
  const [authed, setAuthedState] = useState(isAuthed());
  const [env, setEnv] = useState("casa");
  const [screen, setScreen] = useState("dashboard");
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [creditAnalyses, setCreditAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Ping automático — mantém o Supabase ativo (evita pause após 7 dias sem uso)
  useEffect(() => {
    const ping = () => fetch(`${SUPABASE_URL}/rest/v1/categories?limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    }).catch(()=>{});
    ping(); // ping imediato ao abrir
    const interval = setInterval(ping, 1000 * 60 * 60 * 24 * 3); // a cada 3 dias
    return () => clearInterval(interval);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cats,txs,analyses] = await Promise.all([db.getCategories(),db.getTransactions(),db.getCreditAnalyses()]);
      setCategories(cats.map(mapCat));
      setTransactions(txs.map(mapTx));
      setCreditAnalyses(analyses.map(mapAnalysis));
    } catch { showToast("Erro ao carregar dados.","error"); }
    setLoading(false);
  },[]);

  useEffect(()=>{ if(authed) loadAll(); },[authed,loadAll]);

  // Notificações de vencimento
  const today = nowISO();
  const upcoming = transactions.filter(t => !t.settled && t.dueDate >= today && t.dueDate <= today.slice(0,8) + String(parseInt(today.slice(8,10))+5).padStart(2,"0") && t.env === env);
  const overdue = transactions.filter(t => !t.settled && t.dueDate < today && t.env === env);

  if (!authed) return <LoginScreen onLogin={()=>setAuthedState(true)} />;

  const navItems = [
    {id:"dashboard",label:"Dashboard",icon:"📈"},
    {id:"categories",label:"Categorias",icon:"🗂"},
    {id:"launch",label:"Lançamentos",icon:"➕"},
    {id:"settle",label:"Baixas",icon:"✅"},
    {id:"dre",label:"DRE",icon:"📊"},
    {id:"cashflow",label:"Fluxo de Caixa",icon:"📅"},
    ...(env==="casa"?[{id:"credit",label:"Cartão",icon:"💳"}]:[]),
  ];

  if (loading) return (
    <div style={{...S.root,display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:40,marginBottom:12}}>⟳</div>
        <p style={{color:"#1d4ed8",fontWeight:700,letterSpacing:3}}>CARREGANDO...</p>
      </div>
    </div>
  );

  return (
    <div style={S.root}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.logoWrap}>
            <span style={S.logoIcon}>📊</span>
            <div>
              <div style={S.logoTitle} className="cgf-logo-title">Controle de Gestão Financeira</div>
              <div style={S.logoSub} className="cgf-logo-sub">Sistema Integrado de Finanças Pessoais</div>
            </div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {(overdue.length>0||upcoming.length>0) && (
            <div style={S.alertBell} title={`${overdue.length} vencido(s), ${upcoming.length} a vencer`}>
              🔔 <span style={S.alertCount}>{overdue.length+upcoming.length}</span>
            </div>
          )}
          <div style={S.envToggle}>
            {["casa","escritorio"].map(e=>(
              <button key={e} style={{...S.envBtn,...(env===e?S.envBtnActive:{})}}
                onClick={()=>{setEnv(e);setScreen("dashboard");}}>
                <span>{e==="casa"?"🏠":"💼"}</span>
                <span className="cgf-env-label">{e==="casa"?" Casa":" Escritório"}</span>
              </button>
            ))}
          </div>
          <button style={S.btnLogout} onClick={()=>{clearAuthed();setAuthedState(false);}}>Sair</button>
        </div>
      </header>

      {/* Alerts bar */}
      {(overdue.length>0||upcoming.length>0) && (
        <div style={S.alertBar}>
          {overdue.length>0 && <span style={S.alertRed}>⚠️ {overdue.length} lançamento(s) vencido(s) sem baixa</span>}
          {upcoming.length>0 && <span style={S.alertYellow}>🔔 {upcoming.length} vencimento(s) nos próximos 5 dias</span>}
        </div>
      )}

      {/* Nav */}
      <nav style={S.nav}>
        {navItems.map(n=>(
          <button key={n.id} style={{...S.navBtn,...(screen===n.id?S.navBtnActive:{})}} onClick={()=>setScreen(n.id)}>
            <span style={S.navIcon}>{n.icon}</span>
            <span style={S.navLabel}>{n.label}</span>
          </button>
        ))}
        <button style={{...S.navBtn,marginLeft:"auto"}} onClick={loadAll} title="Sincronizar dados">
          <span style={S.navIcon}>🔄</span>
          <span style={S.navLabel}>Sync</span>
        </button>
      </nav>

      {/* Main */}
      <main style={S.main}>
        {screen==="dashboard" && <Dashboard transactions={transactions} categories={categories} env={env} overdue={overdue} upcoming={upcoming} />}
        {screen==="categories" && <Categories categories={categories} setCategories={setCategories} env={env} showToast={showToast} />}
        {screen==="launch" && <Launch categories={categories} transactions={transactions} setTransactions={setTransactions} env={env} showToast={showToast} />}
        {screen==="settle" && <Settle transactions={transactions} setTransactions={setTransactions} categories={categories} env={env} showToast={showToast} />}
        {screen==="dre" && <DRE transactions={transactions} categories={categories} env={env} />}
        {screen==="cashflow" && <CashFlow transactions={transactions} categories={categories} env={env} />}
        {screen==="credit" && env==="casa" && <CreditCard creditAnalyses={creditAnalyses} setCreditAnalyses={setCreditAnalyses} transactions={transactions} setTransactions={setTransactions} categories={categories} showToast={showToast} />}
      </main>

      {toast && (
        <div style={{...S.toast,background:toast.type==="error"?"#dc2626":"#16a34a"}}>{toast.msg}</div>
      )}
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
function Dashboard({ transactions, categories, env, overdue, upcoming }) {
  const curMonth = nowISO().slice(0,7);
  const settled = transactions.filter(t=>t.env===env&&monthKey(t.dueDate)===curMonth&&t.settled);
  const revenue = settled.filter(t=>getCatType(t.categoryId,categories)==="revenue").reduce((s,t)=>s+t.settledValue,0);
  const expense = settled.filter(t=>getCatType(t.categoryId,categories)==="expense").reduce((s,t)=>s+t.settledValue,0);
  const investment = settled.filter(t=>getCatType(t.categoryId,categories)==="investment").reduce((s,t)=>s+t.settledValue,0);
  const balance = revenue-expense-investment;
  const pending = transactions.filter(t=>t.env===env&&!t.settled&&monthKey(t.dueDate)===curMonth);

  // Chart data — últimos 6 meses
  const chartMonths = Array.from({length:6},(_,i)=>{
    const d = new Date(); d.setMonth(d.getMonth()-5+i);
    return d.toISOString().slice(0,7);
  });
  const chartData = chartMonths.map(mk=>{
    const s = transactions.filter(t=>t.env===env&&monthKey(t.dueDate)===mk&&t.settled);
    const r = s.filter(t=>getCatType(t.categoryId,categories)==="revenue").reduce((a,t)=>a+t.settledValue,0);
    const e = s.filter(t=>getCatType(t.categoryId,categories)==="expense").reduce((a,t)=>a+t.settledValue,0);
    return {label:MONTHS[parseInt(mk.slice(5,7))-1], revenue:r, expense:e, balance:r-e};
  });
  const maxVal = Math.max(...chartData.flatMap(d=>[d.revenue,d.expense]),1);

  return (
    <div>
      <h2 style={S.pageTitle}>Dashboard — {env==="casa"?"🏠 Casa":"💼 Escritório"}</h2>
      <p style={S.subtitle}>{MONTHS[parseInt(curMonth.slice(5,7))-1]} / {curMonth.slice(0,4)}</p>

      <div style={S.kpiRow}>
        <KPI label="Receitas" value={revenue} color="#16a34a" icon="↑" />
        <KPI label="Despesas" value={expense} color="#dc2626" icon="↓" />
        <KPI label="Investimentos" value={investment} color="#2563eb" icon="◆" />
        <KPI label="Saldo" value={balance} color={balance>=0?"#16a34a":"#dc2626"} icon="=" />
        <KPI label="Pendentes" value={pending.length} color="#d97706" icon="⏳" isCount />
      </div>

      {/* Bar Chart */}
      <div style={S.card}>
        <h3 style={S.cardTitle}>Evolução — Últimos 6 Meses</h3>
        <div style={{display:"flex",alignItems:"flex-end",gap:16,height:160,padding:"0 8px"}}>
          {chartData.map((d,i)=>(
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{display:"flex",alignItems:"flex-end",gap:3,height:130}}>
                <div title={`Receita: ${fmtCurrency(d.revenue)}`} style={{width:18,height:`${(d.revenue/maxVal)*100}%`,background:"#bbf7d0",borderRadius:"3px 3px 0 0",minHeight:2}} />
                <div title={`Despesa: ${fmtCurrency(d.expense)}`} style={{width:18,height:`${(d.expense/maxVal)*100}%`,background:"#fecaca",borderRadius:"3px 3px 0 0",minHeight:2}} />
              </div>
              <span style={{fontSize:10,color:"#64748b",fontWeight:600}}>{d.label}</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:16,marginTop:8,justifyContent:"center"}}>
          <span style={{fontSize:11,color:"#16a34a"}}>■ Receitas</span>
          <span style={{fontSize:11,color:"#dc2626"}}>■ Despesas</span>
        </div>
      </div>

      {/* Alerts */}
      {overdue.length>0 && (
        <div style={{...S.card,border:"1px solid #fca5a5",background:"#fff5f5"}}>
          <h3 style={{...S.cardTitle,color:"#dc2626"}}>⚠️ Vencidos sem baixa ({overdue.length})</h3>
          <table style={S.table}>
            <thead><tr><th style={S.th}>Vencimento</th><th style={S.th}>Descrição</th><th style={S.th}>Valor</th></tr></thead>
            <tbody>
              {overdue.slice(0,5).map(t=>(
                <tr key={t.id} style={S.tr}>
                  <td style={{...S.td,color:"#dc2626",fontWeight:700}}>{fmtDate(t.dueDate)}</td>
                  <td style={S.td}>{t.description}</td>
                  <td style={{...S.td,textAlign:"right"}}>{fmtCurrency(t.plannedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={S.sectionTitle}>Pendentes no mês ({pending.length})</h3>
      {pending.length===0 ? <p style={S.empty}>Nenhum lançamento pendente.</p> : (
        <table style={S.table}>
          <thead><tr><th style={S.th}>Vencimento</th><th style={S.th}>Descrição</th><th style={S.th}>Categoria</th><th style={S.th}>Valor Prev.</th></tr></thead>
          <tbody>
            {pending.map(t=>(
              <tr key={t.id} style={S.tr}>
                <td style={S.td}>{fmtDate(t.dueDate)}</td>
                <td style={S.td}>{t.description}</td>
                <td style={S.td}>{getCatName(t.categoryId,categories)}</td>
                <td style={{...S.td,textAlign:"right"}}>{fmtCurrency(t.plannedValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function KPI({ label, value, color, icon, isCount }) {
  return (
    <div style={S.kpi}>
      <span style={S.kpiLabel}>{label}</span>
      <span style={{...S.kpiValue,color}}>
        {isCount ? value : fmtCurrency(value)}
      </span>
    </div>
  );
}

// ─── Categories ────────────────────────────────────────────────────────────
function Categories({ categories, setCategories, env, showToast }) {
  const empty = {code:"",name:"",type:"expense",env:"both"};
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const catTypes = [{v:"title",l:"Título"},{v:"revenue",l:"Receita"},{v:"expense",l:"Despesa"},{v:"investment",l:"Investimento"}];
  const envOpts = [{v:"both",l:"Ambos"},{v:"casa",l:"Casa"},{v:"escritorio",l:"Escritório"}];

  const handleSave = async () => {
    if(!form.code||!form.name){showToast("Preencha código e nome.","error");return;}
    setSaving(true);
    try {
      const record = {code:form.code,name:form.name,type:form.type,env:form.env};
      if(editing) {
        await db.updateCategory(editing, record);
        const updated = {...record, id: editing};
        setCategories(cs=>cs.map(c=>c.id===editing?mapCat(updated):c));
        showToast("Categoria atualizada.");
      } else {
        const newRecord = {...record, id: form.code};
        const inserted = await db.insertCategory(newRecord);
        const cat = Array.isArray(inserted) ? inserted[0] : inserted;
        setCategories(cs=>[...cs, mapCat(cat||newRecord)].sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true})));
        showToast("Categoria criada.");
      }
      setForm(empty);setEditing(null);
    } catch(e) { showToast("Erro ao salvar: "+e.message,"error"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try { await db.deleteCategory(id); setCategories(cs=>cs.filter(c=>c.id!==id)); showToast("Removida."); }
    catch { showToast("Erro ao remover.","error"); }
  };

  const filtered = categories.filter(c=>c.env==="both"||c.env===env).sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));

  return (
    <div>
      <h2 style={S.pageTitle}>Plano de Contas</h2>
      <div style={S.card}>
        <h3 style={S.cardTitle}>{editing?"Editar":"Nova"} Categoria</h3>
        <div style={S.formRow}>
          <Field label="Código" value={form.code} onChange={v=>setForm(f=>({...f,code:v}))} placeholder="Ex: 2.1.1" />
          <Field label="Nome" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="Nome da conta" style={{flex:2}} />
        </div>
        <div style={S.formRow}>
          <SelectField label="Tipo" value={form.type} onChange={v=>setForm(f=>({...f,type:v}))} options={catTypes} />
          <SelectField label="Ambiente" value={form.env} onChange={v=>setForm(f=>({...f,env:v}))} options={envOpts} />
        </div>
        <div style={S.btnRow}>
          <button style={S.btnPrimary} onClick={handleSave} disabled={saving}>{saving?"Salvando...":(editing?"Salvar Edição":"Adicionar")}</button>
          {editing&&<button style={S.btnGhost} onClick={()=>{setForm(empty);setEditing(null);}}>Cancelar</button>}
        </div>
      </div>
      <table style={S.table}>
        <thead><tr><th style={S.th}>Código</th><th style={S.th}>Nome</th><th style={S.th}>Tipo</th><th style={S.th}>Ambiente</th><th style={S.th}>Ações</th></tr></thead>
        <tbody>
          {filtered.map(c=>(
            <tr key={c.id} style={{...S.tr,...(c.type==="title"?S.trTitle:{})}}>
              <td style={S.td}>{c.code}</td>
              <td style={{...S.td,fontWeight:c.type==="title"?700:400}}>{c.name}</td>
              <td style={S.td}>{catTypes.find(t=>t.v===c.type)?.l}</td>
              <td style={S.td}>{envOpts.find(e=>e.v===c.env)?.l}</td>
              <td style={S.td}>
                <button style={S.btnSm} onClick={()=>{setForm({code:c.code,name:c.name,type:c.type,env:c.env});setEditing(c.id);}}>✏️</button>
                <button style={{...S.btnSm,color:"#dc2626"}} onClick={()=>handleDelete(c.id)}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Launch ────────────────────────────────────────────────────────────────
// Helper: add N months keeping last-day-of-month logic (30/jan → 28/fev, not 03/mar)
function addMonthsSafe(isoDate, n) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const targetMonth = m - 1 + n; // 0-based
  const newYear = y + Math.floor(targetMonth / 12);
  const newMonth = ((targetMonth % 12) + 12) % 12; // 0-based
  const lastDay = new Date(newYear, newMonth + 1, 0).getDate();
  const newDay = Math.min(d, lastDay);
  return `${newYear}-${String(newMonth + 1).padStart(2,"0")}-${String(newDay).padStart(2,"0")}`;
}

function Launch({ categories, transactions, setTransactions, env, showToast }) {
  const emptyForm = {description:"",categoryId:"",dueDate:nowISO(),plannedValue:"",recurring:false,recurMonths:1};
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({description:"",categoryId:"",dueDate:"",plannedValue:""});
  const [confirmDelete, setConfirmDelete] = useState(null);

  const validCats = categories.filter(c=>c.type!=="title"&&(c.env==="both"||c.env===env)).sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));

  const handleSave = async () => {
    if(!form.description||!form.categoryId||!form.dueDate||!form.plannedValue){showToast("Preencha todos os campos.","error");return;}
    setSaving(true);
    try {
      const val = parseCurrency(form.plannedValue);
      const months = form.recurring?parseInt(form.recurMonths)||1:1;
      const recurGroup = form.recurring?uid():null;
      const newTxs = Array.from({length:months},(_,i)=>{
        const dueDate = addMonthsSafe(form.dueDate, i);
        return {id:uid(),description:form.description,category_id:form.categoryId,env,due_date:dueDate,planned_value:val,settled:false,settled_date:null,settled_value:0,recur_group:recurGroup};
      });
      const inserted = await db.insertTransactions(newTxs);
      setTransactions(ts=>[...ts,...inserted.map(mapTx)]);
      showToast(`${months} lançamento(s) criado(s)!`);
      setForm(emptyForm);
    } catch(e) { showToast("Erro ao salvar: "+e.message,"error"); }
    setSaving(false);
  };

  const startEdit = (t) => {
    setEditingTx(t);
    setEditForm({description:t.description,categoryId:t.categoryId,dueDate:t.dueDate,plannedValue:fmtCurrency(t.plannedValue)});
  };

  const confirmEdit = async () => {
    if(!editForm.description||!editForm.categoryId||!editForm.dueDate||!editForm.plannedValue){showToast("Preencha todos os campos.","error");return;}
    setSaving(true);
    try {
      const val = parseCurrency(editForm.plannedValue);
      await db.updateTransaction(editingTx.id,{description:editForm.description,category_id:editForm.categoryId,due_date:editForm.dueDate,planned_value:val});
      setTransactions(ts=>ts.map(t=>t.id===editingTx.id?{...t,description:editForm.description,categoryId:editForm.categoryId,dueDate:editForm.dueDate,plannedValue:val}:t));
      showToast("Lançamento atualizado!");
      setEditingTx(null);
    } catch(e) { showToast("Erro ao editar: "+e.message,"error"); }
    setSaving(false);
  };

  const handleDelete = async (t) => {
    try {
      await db.deleteTransaction(t.id);
      setTransactions(ts=>ts.filter(x=>x.id!==t.id));
      showToast("Lançamento excluído.");
      setConfirmDelete(null);
    } catch(e) { showToast("Erro ao excluir: "+e.message,"error"); }
  };

  return (
    <div>
      <h2 style={S.pageTitle}>Novo Lançamento</h2>
      <div style={S.card}>
        <div style={S.formRow}>
          <Field label="Descrição" value={form.description} onChange={v=>setForm(f=>({...f,description:v}))} placeholder="Ex: Aluguel" style={{flex:2}} />
          <div style={S.fieldWrap}>
            <label style={S.label}>Categoria</label>
            <select style={S.input} value={form.categoryId} onChange={e=>setForm(f=>({...f,categoryId:e.target.value}))}>
              <option value="">Selecione...</option>
              {validCats.map(c=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
        </div>
        <div style={S.formRow}>
          <Field label="Data de Vencimento" type="date" value={form.dueDate} onChange={v=>setForm(f=>({...f,dueDate:v}))} />
          <Field label="Valor Previsto" value={form.plannedValue} onChange={v=>setForm(f=>({...f,plannedValue:v}))} placeholder="0,00" />
        </div>
        <div style={S.checkRow}>
          <input type="checkbox" id="recur" checked={form.recurring} onChange={e=>setForm(f=>({...f,recurring:e.target.checked}))} />
          <label htmlFor="recur" style={S.checkLabel}>Lançamento recorrente?</label>
        </div>
        {form.recurring && (
          <div style={{...S.card,background:"#eff6ff",marginTop:4}}>
            <Field label="Repetir por quantos meses?" type="number" value={form.recurMonths} onChange={v=>setForm(f=>({...f,recurMonths:v}))} placeholder="1" />
            <p style={{color:"#3b82f6",fontSize:12,marginTop:4}}>Serão criados {form.recurMonths||1} lançamentos. Datas com dia 29/30/31 serão ajustadas ao último dia do mês.</p>
          </div>
        )}
        <div style={S.btnRow}>
          <button style={S.btnPrimary} onClick={handleSave} disabled={saving}>{saving?"Salvando...":"Lançar"}</button>
        </div>
      </div>

      <h3 style={S.sectionTitle}>Lançamentos ({[...transactions].filter(t=>t.env===env).length} no total)</h3>
      <table style={S.table}>
        <thead><tr><th style={S.th}>Vencimento</th><th style={S.th}>Descrição</th><th style={S.th}>Categoria</th><th style={S.th}>Valor</th><th style={S.th}>Status</th><th style={S.th}>Ações</th></tr></thead>
        <tbody>
          {[...transactions].filter(t=>t.env===env).sort((a,b)=>b.dueDate.localeCompare(a.dueDate)).map(t=>(
            <tr key={t.id} style={S.tr}>
              <td style={S.td}>{fmtDate(t.dueDate)}</td>
              <td style={S.td}>{t.description}</td>
              <td style={S.td}>{getCatName(t.categoryId,categories)}</td>
              <td style={{...S.td,textAlign:"right"}}>{fmtCurrency(t.plannedValue)}</td>
              <td style={S.td}><span style={{...S.badge,background:t.settled?"#16a34a":"#d97706"}}>{t.settled?"Pago":"Pendente"}</span></td>
              <td style={S.td}>
                {!t.settled && <button style={S.btnSm} onClick={()=>startEdit(t)} title="Editar">✏️</button>}
                <button style={{...S.btnSm,color:"#dc2626"}} onClick={()=>setConfirmDelete(t)} title="Excluir">🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal Editar */}
      {editingTx && (
        <div style={S.modal}>
          <div style={S.modalBox}>
            <h3 style={{color:"#1e3a5f",marginBottom:16}}>Editar Lançamento</h3>
            <Field label="Descrição" value={editForm.description} onChange={v=>setEditForm(f=>({...f,description:v}))} />
            <div style={S.fieldWrap}>
              <label style={S.label}>Categoria</label>
              <select style={S.input} value={editForm.categoryId} onChange={e=>setEditForm(f=>({...f,categoryId:e.target.value}))}>
                <option value="">Selecione...</option>
                {validCats.map(c=><option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </div>
            <div style={{marginTop:8}}>
              <Field label="Data de Vencimento" type="date" value={editForm.dueDate} onChange={v=>setEditForm(f=>({...f,dueDate:v}))} />
            </div>
            <Field label="Valor Previsto" value={editForm.plannedValue} onChange={v=>setEditForm(f=>({...f,plannedValue:v}))} placeholder="0,00" />
            <div style={S.btnRow}>
              <button style={S.btnPrimary} onClick={confirmEdit} disabled={saving}>{saving?"Salvando...":"Salvar"}</button>
              <button style={S.btnGhost} onClick={()=>setEditingTx(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {confirmDelete && (
        <div style={S.modal}>
          <div style={S.modalBox}>
            <h3 style={{color:"#dc2626",marginBottom:12}}>Confirmar Exclusão</h3>
            <p style={{color:"#64748b",marginBottom:20}}>Deseja excluir o lançamento <strong>{confirmDelete.description}</strong> de {fmtDate(confirmDelete.dueDate)}?</p>
            <div style={S.btnRow}>
              <button style={{...S.btnPrimary,background:"#dc2626"}} onClick={()=>handleDelete(confirmDelete)}>Excluir</button>
              <button style={S.btnGhost} onClick={()=>setConfirmDelete(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settle ────────────────────────────────────────────────────────────────
function Settle({ transactions, setTransactions, categories, env, showToast }) {
  const [month, setMonth] = useState(nowISO().slice(0,7));
  const [editing, setEditing] = useState(null);
  const [editMode, setEditMode] = useState("settle"); // "settle" | "edit"
  const [settleForm, setSettleForm] = useState({settledDate:nowISO(),settledValue:"",updateFuture:false});
  const [saving, setSaving] = useState(false);

  const txMonth = transactions.filter(t=>t.env===env&&monthKey(t.dueDate)===month).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const pending = txMonth.filter(t=>!t.settled);
  const paid = txMonth.filter(t=>t.settled);

  const openSettle = (t) => {
    setEditMode("settle");
    setEditing(t);
    setSettleForm({settledDate:nowISO(),settledValue:fmtCurrency(t.plannedValue),updateFuture:false});
  };

  const openEditPaid = (t) => {
    setEditMode("edit");
    setEditing(t);
    setSettleForm({settledDate:t.settledDate||nowISO(),settledValue:fmtCurrency(t.settledValue),updateFuture:false});
  };

  const confirmSettle = async () => {
    setSaving(true);
    try {
      const val = parseCurrency(settleForm.settledValue);
      await db.updateTransaction(editing.id,{settled:true,settled_date:settleForm.settledDate,settled_value:val});
      setTransactions(ts=>ts.map(t=>t.id===editing.id?{...t,settled:true,settledDate:settleForm.settledDate,settledValue:val}:t));
      if(settleForm.updateFuture&&editing.recurGroup){
        const diff=val-editing.plannedValue;
        if(diff!==0){
          const future=transactions.filter(t=>t.recurGroup===editing.recurGroup&&!t.settled&&t.dueDate>editing.dueDate);
          for(const ft of future){
            const nv=ft.plannedValue+diff;
            await db.updateTransaction(ft.id,{planned_value:nv});
            setTransactions(ts=>ts.map(t=>t.id===ft.id?{...t,plannedValue:nv}:t));
          }
        }
      }
      showToast("Baixa efetuada!"); setEditing(null);
    } catch(e) { showToast("Erro: "+e.message,"error"); }
    setSaving(false);
  };

  const confirmEditPaid = async () => {
    setSaving(true);
    try {
      const val = parseCurrency(settleForm.settledValue);
      await db.updateTransaction(editing.id,{settled_date:settleForm.settledDate,settled_value:val});
      setTransactions(ts=>ts.map(t=>t.id===editing.id?{...t,settledDate:settleForm.settledDate,settledValue:val}:t));
      showToast("Baixa atualizada!"); setEditing(null);
    } catch(e) { showToast("Erro: "+e.message,"error"); }
    setSaving(false);
  };

  const cancelSettle = async (t) => {
    if(!window.confirm(`Desfazer baixa de "${t.description}"?`)) return;
    try {
      await db.updateTransaction(t.id,{settled:false,settled_date:null,settled_value:0});
      setTransactions(ts=>ts.map(x=>x.id===t.id?{...x,settled:false,settledDate:null,settledValue:0}:x));
      showToast("Baixa desfeita.");
    } catch(e) { showToast("Erro: "+e.message,"error"); }
  };

  return (
    <div>
      <h2 style={S.pageTitle}>Baixas — {env==="casa"?"🏠 Casa":"💼 Escritório"}</h2>
      <div style={S.formRow}>
        <div style={S.fieldWrap}>
          <label style={S.label}>Mês de referência</label>
          <input type="month" style={S.input} value={month} onChange={e=>setMonth(e.target.value)} />
        </div>
      </div>

      {/* Pendentes */}
      <h3 style={S.sectionTitle}>⏳ Pendentes ({pending.length})</h3>
      {pending.length===0 ? <p style={S.empty}>Nenhum lançamento pendente neste mês.</p> : (
        <table style={S.table}>
          <thead><tr><th style={S.th}>Vencimento</th><th style={S.th}>Descrição</th><th style={S.th}>Categoria</th><th style={S.th}>Valor Prev.</th><th style={S.th}>Ação</th></tr></thead>
          <tbody>
            {pending.map(t=>(
              <tr key={t.id} style={S.tr}>
                <td style={{...S.td,color:t.dueDate<nowISO()?"#dc2626":"inherit",fontWeight:t.dueDate<nowISO()?700:400}}>{fmtDate(t.dueDate)}</td>
                <td style={S.td}>{t.description}</td>
                <td style={S.td}>{getCatName(t.categoryId,categories)}</td>
                <td style={{...S.td,textAlign:"right"}}>{fmtCurrency(t.plannedValue)}</td>
                <td style={S.td}><button style={S.btnPrimary} onClick={()=>openSettle(t)}>Dar Baixa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagos */}
      <h3 style={{...S.sectionTitle,marginTop:24}}>✅ Pagos ({paid.length})</h3>
      {paid.length===0 ? <p style={S.empty}>Nenhum lançamento pago neste mês.</p> : (
        <table style={S.table}>
          <thead><tr><th style={S.th}>Vencimento</th><th style={S.th}>Descrição</th><th style={S.th}>Categoria</th><th style={S.th}>Valor Prev.</th><th style={S.th}>Valor Pago</th><th style={S.th}>Dt. Pagto</th><th style={S.th}>Ações</th></tr></thead>
          <tbody>
            {paid.map(t=>(
              <tr key={t.id} style={S.tr}>
                <td style={S.td}>{fmtDate(t.dueDate)}</td>
                <td style={S.td}>{t.description}</td>
                <td style={S.td}>{getCatName(t.categoryId,categories)}</td>
                <td style={{...S.td,textAlign:"right",color:"#94a3b8"}}>{fmtCurrency(t.plannedValue)}</td>
                <td style={{...S.td,textAlign:"right",fontWeight:700,color:"#16a34a"}}>{fmtCurrency(t.settledValue)}</td>
                <td style={S.td}>{fmtDate(t.settledDate)}</td>
                <td style={S.td}>
                  <button style={S.btnSm} onClick={()=>openEditPaid(t)} title="Editar valor pago">✏️</button>
                  <button style={{...S.btnSm,color:"#f59e0b",marginLeft:4}} onClick={()=>cancelSettle(t)} title="Desfazer baixa">↩️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Modal Dar Baixa / Editar Baixa */}
      {editing && (
        <div style={S.modal}>
          <div style={S.modalBox}>
            <h3 style={{color:"#1e3a5f",marginBottom:12}}>
              {editMode==="edit" ? "✏️ Editar Valor Pago" : "Confirmar Baixa"}
            </h3>
            <p style={{color:"#64748b",marginBottom:16}}>{editing.description} — Venc. {fmtDate(editing.dueDate)}</p>
            <Field label="Data do Pagamento" type="date" value={settleForm.settledDate} onChange={v=>setSettleForm(f=>({...f,settledDate:v}))} />
            <Field label="Valor Pago" value={settleForm.settledValue} onChange={v=>setSettleForm(f=>({...f,settledValue:v}))} placeholder="0,00" />
            {editMode==="settle" && editing.recurGroup && (
              <div style={{...S.checkRow,marginTop:12}}>
                <input type="checkbox" id="uf" checked={settleForm.updateFuture} onChange={e=>setSettleForm(f=>({...f,updateFuture:e.target.checked}))} />
                <label htmlFor="uf" style={S.checkLabel}>Atualizar meses seguintes com a diferença?</label>
              </div>
            )}
            <div style={S.btnRow}>
              <button style={S.btnPrimary} onClick={editMode==="edit"?confirmEditPaid:confirmSettle} disabled={saving}>
                {saving?"Salvando...":"Salvar"}
              </button>
              <button style={S.btnGhost} onClick={()=>setEditing(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Financial Report (DRE + CashFlow) ────────────────────────────────────
function DRE({ transactions, categories, env }) {
  const [year, setYear] = useState(new Date().getFullYear());
  return <FinancialReport title="DRE — Realizado" transactions={transactions} categories={categories} env={env} year={year} setYear={setYear} onlySettled={true} />;
}
function CashFlow({ transactions, categories, env }) {
  const [year, setYear] = useState(new Date().getFullYear());
  return <FinancialReport title="Fluxo de Caixa — Programado" transactions={transactions} categories={categories} env={env} year={year} setYear={setYear} onlySettled={false} />;
}

function FinancialReport({ title, transactions, categories, env, year, setYear, onlySettled }) {
  const months = Array.from({length:12},(_,i)=>i+1);
  const getValue = (catId,monthIdx) => {
    const mk=`${year}-${String(monthIdx).padStart(2,"0")}`;
    if(onlySettled) {
      // DRE: usa a data em que foi PAGO (settledDate), não o vencimento
      return transactions.filter(t=>
        t.env===env && t.categoryId===catId && t.settled &&
        monthKey(t.settledDate||t.dueDate)===mk
      ).reduce((s,t)=>s+t.settledValue,0);
    } else {
      // Fluxo de Caixa: usa data de vencimento (planejado)
      return transactions.filter(t=>
        t.env===env && t.categoryId===catId && monthKey(t.dueDate)===mk
      ).reduce((s,t)=>s+t.plannedValue,0);
    }
  };
  // Sort ALL categories numerically and build sections dynamically
  const sortedCats = [...categories].filter(c=>c.env==="both"||c.env===env)
    .sort((a,b)=>a.code.localeCompare(b.code,undefined,{numeric:true}));
  const sections = [];
  let cur = null;
  for(const cat of sortedCats) {
    if(cat.type==="title") { if(cur) sections.push(cur); cur={title:cat,leaves:[]}; }
    else { if(!cur) cur={title:null,leaves:[]}; cur.leaves.push(cat); }
  }
  if(cur) sections.push(cur);
  const typeColor = {revenue:"#16a34a",expense:"#dc2626",investment:"#2563eb"};
  // Grand totals: revenue minus expense minus investment
  const grandByType = {};
  sections.forEach(sec=>{
    const tp = sec.title?.type;
    if(!tp||tp==="title") return;
    if(!grandByType[tp]) grandByType[tp]=months.map(()=>0);
    sec.leaves.forEach(c=>months.forEach((m,i)=>{ grandByType[tp][i]+=getValue(c.id,m); }));
  });
  const totals = months.map((_,i)=>
    (grandByType.revenue?.[i]||0)-(grandByType.expense?.[i]||0)-(grandByType.investment?.[i]||0)
  );

  // Export to CSV
  const exportCSV = () => {
    const rows = [["Conta",...months.map(m=>MONTHS[m-1])]];
    sections.forEach(sec=>{
      if(sec.title) rows.push([`${sec.title.code} — ${sec.title.name}`,...months.map(()=>"")]);
      sec.leaves.forEach(c=>{ rows.push([`${c.code} — ${c.name}`,...months.map(m=>fmtCurrency(getValue(c.id,m)))]); });
      if(sec.title) {
        const sub=months.map(m=>sec.leaves.reduce((s,c)=>s+getValue(c.id,m),0));
        rows.push([`Subtotal — ${sec.title.name}`,...sub.map(v=>fmtCurrency(v))]);
      }
    });
    rows.push(["TOTAL (REC − DESP − INV)",...totals.map(v=>fmtCurrency(v))]);
    const csv=rows.map(r=>r.map(c=>`"${c}"`).join(";")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=`${title.replace(/\s/g,"_")}_${year}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 style={S.pageTitle}>{title}</h2>
      <div style={{...S.formRow,marginBottom:16,alignItems:"flex-end"}}>
        <div style={S.fieldWrap}>
          <label style={S.label}>Ano</label>
          <input type="number" style={{...S.input,width:100}} value={year} onChange={e=>setYear(parseInt(e.target.value))} />
        </div>
        <button style={{...S.btnPrimary,marginBottom:0}} onClick={exportCSV}>⬇ Exportar CSV</button>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{...S.table,minWidth:1100}}>
          <thead>
            <tr>
              <th style={{...S.th,minWidth:220,position:"sticky",left:0,background:"#dbeafe"}}>Conta</th>
              {months.map(m=><th key={m} style={{...S.th,width:80,textAlign:"right"}}>{MONTHS[m-1]}</th>)}
            </tr>
          </thead>
          <tbody>
            {sections.map((sec,si)=>{
              const color = sec.title ? (typeColor[sec.title.type]||"#2563eb") : "#2563eb";
              const subRow = months.map(m=>sec.leaves.reduce((s,c)=>s+getValue(c.id,m),0));
              return [
                sec.title && (
                  <tr key={`title-${si}`} style={S.trGroupHeader}>
                    <td style={{...S.td,fontWeight:800,color,fontSize:13,position:"sticky",left:0,background:"#e0f2fe"}} colSpan={13}>
                      {sec.title.code} — {sec.title.name}
                    </td>
                  </tr>
                ),
                ...sec.leaves.map(c=>(
                  <tr key={c.id} style={S.tr}>
                    <td style={{...S.td,paddingLeft:28,position:"sticky",left:0,background:"#f0f9ff"}}>{c.code} — {c.name}</td>
                    {months.map(m=>{ const v=getValue(c.id,m); return <td key={m} style={{...S.td,textAlign:"right",color:v===0?"#cbd5e1":"#1e3a5f"}}>{fmtCurrency(v)}</td>; })}
                  </tr>
                )),
                sec.title && (
                  <tr key={`sub-${si}`} style={S.trSubtotal}>
                    <td style={{...S.td,fontWeight:700,color,position:"sticky",left:0,background:"#dbeafe"}}>Subtotal — {sec.title.name}</td>
                    {subRow.map((v,i)=><td key={i} style={{...S.td,textAlign:"right",fontWeight:700,color}}>{fmtCurrency(v)}</td>)}
                  </tr>
                ),
              ];
            })}
            <tr style={S.trTotal}>
              <td style={{...S.td,fontWeight:800,fontSize:13,position:"sticky",left:0,background:"#bfdbfe"}}>TOTAL (REC − DESP − INV)</td>
              {totals.map((v,i)=><td key={i} style={{...S.td,textAlign:"right",fontWeight:800,fontSize:13,color:v>=0?"#16a34a":"#dc2626"}}>{fmtCurrency(v)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Credit Card ───────────────────────────────────────────────────────────
function CreditCard({ creditAnalyses, setCreditAnalyses, transactions, setTransactions, categories, showToast }) {
  const [file, setFile] = useState(null);
  const [cardName, setCardName] = useState("");
  const [dueDate, setDueDate] = useState(nowISO());
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const fileRef = useRef();

  const analyze = async () => {
    if(!file||!cardName){showToast("Informe o cartão e selecione o arquivo.","error");return;}
    setAnalyzing(true);
    try {
      const base64=await fileToBase64(file);
      const isPdf=file.type==="application/pdf";
      const resp=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1500,messages:[{role:"user",content:[isPdf?{type:"document",source:{type:"base64",media_type:"application/pdf",data:base64}}:{type:"image",source:{type:"base64",media_type:file.type,data:base64}},{type:"text",text:`Analise esta fatura de cartão de crédito e retorne SOMENTE um JSON válido sem markdown:\n{"totalValue":<número>,"topExpenses":[{"description":"nome","value":<número>,"date":"dd/mm/aaaa"}],"summary":"resumo"}\nListe os 10 maiores gastos do maior para o menor. Valores como números sem formatação.`}]}]})});
      const data=await resp.json();
      const raw=data.content?.map(b=>b.text||"").join("")||"";
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      setResult({id:uid(),cardName,dueDate,fileName:file.name,analyzedAt:nowISO(),totalValue:parsed.totalValue,topExpenses:parsed.topExpenses||[],summary:parsed.summary||"",addedToCashFlow:false});
    } catch { showToast("Erro ao analisar. Verifique o arquivo.","error"); }
    setAnalyzing(false);
  };

  const saveAnalysis = async () => {
    if(!result)return;
    try {
      await db.insertCreditAnalysis({id:result.id,card_name:result.cardName,due_date:result.dueDate,file_name:result.fileName,analyzed_at:result.analyzedAt,total_value:result.totalValue,top_expenses:result.topExpenses,summary:result.summary,added_to_cash_flow:false});
      setCreditAnalyses(a=>[result,...a]);
      showToast("Análise salva!");
      setResult(null);setFile(null);setCardName("");setDueDate(nowISO());
      if(fileRef.current)fileRef.current.value="";
    } catch { showToast("Erro ao salvar.","error"); }
  };

  const addToCashFlow = async (analysis) => {
    const cat=categories.find(c=>c.type==="expense"&&(c.env==="both"||c.env==="casa"));
    const tx={id:uid(),description:`Fatura ${analysis.cardName}`,category_id:cat?.id||null,env:"casa",due_date:analysis.dueDate,planned_value:analysis.totalValue,settled:false,settled_date:null,settled_value:0,recur_group:null};
    try {
      const inserted=await db.insertTransactions([tx]);
      setTransactions(ts=>[...ts,...inserted.map(mapTx)]);
      await db.updateCreditAnalysis(analysis.id,{added_to_cash_flow:true});
      setCreditAnalyses(as=>as.map(a=>a.id===analysis.id?{...a,addedToCashFlow:true}:a));
      showToast("Fatura adicionada ao Fluxo de Caixa!");
    } catch { showToast("Erro ao adicionar ao fluxo.","error"); }
  };

  // Export credit analyses to CSV
  const exportAnalysesCSV = () => {
    const rows=[["Cartão","Vencimento","Total","Analisado em","#","Descrição","Valor"]];
    creditAnalyses.forEach(a=>{
      if(a.topExpenses.length===0) rows.push([a.cardName,fmtDate(a.dueDate),fmtCurrency(a.totalValue),fmtDate(a.analyzedAt),"","",""]);
      a.topExpenses.forEach((e,i)=>rows.push([i===0?a.cardName:"",i===0?fmtDate(a.dueDate):"",i===0?fmtCurrency(a.totalValue):"",i===0?fmtDate(a.analyzedAt):"",i+1,e.description,fmtCurrency(e.value)]));
    });
    const csv=rows.map(r=>r.map(c=>`"${c}"`).join(";")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="historico_cartoes.csv";a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h2 style={S.pageTitle}>💳 Análise de Cartão de Crédito</h2>
      <div style={S.card}>
        <h3 style={S.cardTitle}>Analisar Nova Fatura</h3>
        <div style={S.formRow}>
          <Field label="Nome do Cartão" value={cardName} onChange={setCardName} placeholder="Ex: Nubank, Itaú Visa" />
          <Field label="Data de Vencimento" type="date" value={dueDate} onChange={setDueDate} />
        </div>
        <div style={S.fieldWrap}>
          <label style={S.label}>Arquivo da Fatura (PDF ou imagem)</label>
          <input ref={fileRef} type="file" accept=".pdf,image/*" style={S.input} onChange={e=>setFile(e.target.files[0])} />
        </div>
        <div style={S.btnRow}>
          <button style={S.btnPrimary} onClick={analyze} disabled={analyzing}>{analyzing?"Analisando com IA...":"Analisar Fatura"}</button>
        </div>
      </div>

      {result&&(
        <div style={{...S.card,border:"2px solid #2563eb"}}>
          <h3 style={S.cardTitle}>Resultado — {result.cardName}</h3>
          <p style={{color:"#64748b",marginBottom:12}}>{result.summary}</p>
          <div style={S.kpiRow}>
            <KPI label="Total da Fatura" value={result.totalValue} color="#2563eb" />
            <KPI label="Vencimento" value={fmtDate(result.dueDate)} color="#1e3a5f" />
          </div>
          <h4 style={{color:"#1e3a5f",marginTop:16,marginBottom:8}}>Top 10 Maiores Gastos</h4>
          <table style={S.table}>
            <thead><tr><th style={S.th}>#</th><th style={S.th}>Descrição</th><th style={S.th}>Data</th><th style={S.th}>Valor</th></tr></thead>
            <tbody>
              {result.topExpenses.map((e,i)=>(
                <tr key={i} style={S.tr}>
                  <td style={S.td}>{i+1}</td><td style={S.td}>{e.description}</td>
                  <td style={S.td}>{e.date}</td><td style={{...S.td,textAlign:"right"}}>{fmtCurrency(e.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={S.btnRow}>
            <button style={S.btnPrimary} onClick={saveAnalysis}>Salvar Análise</button>
            <button style={S.btnGhost} onClick={()=>setResult(null)}>Descartar</button>
          </div>
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h3 style={S.sectionTitle}>Histórico de Análises</h3>
        {creditAnalyses.length>0&&<button style={S.btnGhost} onClick={exportAnalysesCSV}>⬇ Exportar Histórico CSV</button>}
      </div>
      {creditAnalyses.length===0?<p style={S.empty}>Nenhuma análise salva.</p>:(
        <table style={S.table}>
          <thead><tr><th style={S.th}>Cartão</th><th style={S.th}>Vencimento</th><th style={S.th}>Total</th><th style={S.th}>Analisado em</th><th style={S.th}>Status</th><th style={S.th}>Ações</th></tr></thead>
          <tbody>
            {creditAnalyses.map(a=>(
              <tr key={a.id} style={S.tr}>
                <td style={S.td}>{a.cardName}</td>
                <td style={S.td}>{fmtDate(a.dueDate)}</td>
                <td style={{...S.td,textAlign:"right"}}>{fmtCurrency(a.totalValue)}</td>
                <td style={S.td}>{fmtDate(a.analyzedAt)}</td>
                <td style={S.td}><span style={{...S.badge,background:a.addedToCashFlow?"#16a34a":"#64748b"}}>{a.addedToCashFlow?"No Fluxo":"Pendente"}</span></td>
                <td style={S.td}>
                  <button style={S.btnSm} onClick={()=>setSelected(selected?.id===a.id?null:a)}>👁</button>
                  {!a.addedToCashFlow&&<button style={{...S.btnSm,background:"#2563eb",color:"#fff"}} onClick={()=>addToCashFlow(a)}>→ Fluxo</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {selected&&(
        <div style={{...S.card,marginTop:16,border:"2px solid #2563eb"}}>
          <h4 style={{color:"#1e3a5f",marginBottom:12}}>Top Gastos — {selected.cardName} ({fmtDate(selected.dueDate)})</h4>
          <table style={S.table}>
            <thead><tr><th style={S.th}>#</th><th style={S.th}>Descrição</th><th style={S.th}>Data</th><th style={S.th}>Valor</th></tr></thead>
            <tbody>
              {selected.topExpenses.map((e,i)=>(
                <tr key={i} style={S.tr}>
                  <td style={S.td}>{i+1}</td><td style={S.td}>{e.description}</td>
                  <td style={S.td}>{e.date}</td><td style={{...S.td,textAlign:"right"}}>{fmtCurrency(e.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Shared components ─────────────────────────────────────────────────────
function Field({ label, value, onChange, type="text", placeholder="", style={} }) {
  return (
    <div style={{...S.fieldWrap,...style}}>
      <label style={S.label}>{label}</label>
      <input type={type} style={S.input} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
function SelectField({ label, value, onChange, options }) {
  return (
    <div style={S.fieldWrap}>
      <label style={S.label}>{label}</label>
      <select style={S.input} value={value} onChange={e=>onChange(e.target.value)}>
        {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

// ─── Styles — Light Blue Theme ─────────────────────────────────────────────
const S = {
  // Login
  loginWrap: { minHeight:"100vh", background:"linear-gradient(135deg,#dbeafe 0%,#bfdbfe 50%,#93c5fd 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" },
  loginBox: { background:"#fff", borderRadius:16, padding:40, width:"90%", maxWidth:400, boxShadow:"0 20px 60px rgba(37,99,235,0.15)", display:"flex", flexDirection:"column", alignItems:"center" },
  loginLogo: { width:64, height:64, borderRadius:16, background:"#2563eb", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, fontWeight:900, marginBottom:16 },
  loginTitle: { fontSize:20, fontWeight:800, color:"#1e3a5f", textAlign:"center", marginBottom:6 },
  loginSub: { fontSize:13, color:"#64748b", marginBottom:24, textAlign:"center" },
  // Root
  root: { fontFamily:"'Segoe UI',system-ui,sans-serif", background:"#e0f2fe", minHeight:"100vh", color:"#1e3a5f" },
  // Header
  header: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 24px", background:"#fff", borderBottom:"1px solid #bfdbfe", boxShadow:"0 2px 8px rgba(37,99,235,0.08)", flexWrap:"wrap", gap:12 },
  headerLeft: { display:"flex", alignItems:"center", gap:14 },
  logoWrap: { display:"flex", alignItems:"center", gap:12 },
  logoIcon: { fontSize:28 },
  logoTitle: { fontSize:17, fontWeight:800, color:"#1e3a5f", letterSpacing:-0.3 },
  logoSub: { fontSize:11, color:"#64748b", letterSpacing:0.3 },
  envToggle: { display:"flex", gap:4 },
  envBtn: { background:"#f0f9ff", border:"1px solid #bfdbfe", color:"#3b82f6", padding:"6px 10px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", maxWidth:120 },
  envBtnActive: { background:"#2563eb", border:"1px solid #2563eb", color:"#fff" },
  btnLogout: { background:"transparent", border:"1px solid #bfdbfe", color:"#64748b", padding:"6px 14px", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:600 },
  alertBell: { position:"relative", fontSize:20, cursor:"pointer" },
  alertCount: { position:"absolute", top:-4, right:-6, background:"#dc2626", color:"#fff", borderRadius:10, fontSize:10, fontWeight:700, padding:"0 5px", minWidth:16, textAlign:"center" },
  alertBar: { background:"#fff", borderBottom:"1px solid #bfdbfe", padding:"8px 24px", display:"flex", gap:24, flexWrap:"wrap" },
  alertRed: { color:"#dc2626", fontWeight:600, fontSize:13 },
  alertYellow: { color:"#d97706", fontWeight:600, fontSize:13 },
  // Nav
  nav: { display:"flex", gap:2, padding:"8px 16px", background:"#fff", borderBottom:"1px solid #bfdbfe", overflowX:"auto" },
  navBtn: { display:"flex", flexDirection:"column", alignItems:"center", gap:2, background:"transparent", border:"none", color:"#94a3b8", padding:"8px 14px", borderRadius:8, cursor:"pointer", minWidth:72, fontFamily:"inherit" },
  navBtnActive: { background:"#eff6ff", color:"#2563eb", borderBottom:"2px solid #2563eb" },
  navIcon: { fontSize:18 },
  navLabel: { fontSize:11, fontWeight:600, letterSpacing:0.3 },
  // Main
  main: { padding:"24px", maxWidth:1400, margin:"0 auto" },
  pageTitle: { fontSize:22, fontWeight:800, color:"#1e3a5f", marginBottom:4, letterSpacing:-0.5 },
  subtitle: { color:"#64748b", fontSize:13, marginBottom:20 },
  sectionTitle: { fontSize:16, fontWeight:700, color:"#475569", margin:"24px 0 12px" },
  // Card
  card: { background:"#fff", border:"1px solid #bfdbfe", borderRadius:12, padding:20, marginBottom:20, boxShadow:"0 2px 8px rgba(37,99,235,0.05)" },
  cardTitle: { fontSize:15, fontWeight:700, color:"#1e3a5f", marginBottom:16 },
  // Form
  formRow: { display:"flex", gap:12, marginBottom:12, flexWrap:"wrap" },
  fieldWrap: { display:"flex", flexDirection:"column", gap:4, flex:1, minWidth:140 },
  label: { fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:1, textTransform:"uppercase" },
  input: { background:"#f8faff", border:"1px solid #bfdbfe", borderRadius:8, color:"#1e3a5f", padding:"9px 12px", fontSize:13, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit" },
  checkRow: { display:"flex", alignItems:"center", gap:8, marginBottom:12 },
  checkLabel: { color:"#475569", fontSize:13, cursor:"pointer" },
  btnRow: { display:"flex", gap:10, marginTop:12 },
  btnPrimary: { background:"#2563eb", color:"#fff", border:"none", padding:"9px 20px", borderRadius:8, fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"inherit", boxShadow:"0 2px 6px rgba(37,99,235,0.3)" },
  btnGhost: { background:"transparent", color:"#64748b", border:"1px solid #bfdbfe", padding:"9px 20px", borderRadius:8, fontWeight:700, cursor:"pointer", fontSize:13, fontFamily:"inherit" },
  btnSm: { background:"#f0f9ff", border:"1px solid #bfdbfe", padding:"4px 10px", borderRadius:6, cursor:"pointer", marginRight:4, fontSize:13, color:"#2563eb", fontFamily:"inherit" },
  // Table
  table: { width:"100%", borderCollapse:"collapse", fontSize:13, background:"#fff", borderRadius:8, overflow:"hidden" },
  th: { background:"#dbeafe", color:"#3b82f6", padding:"9px 12px", textAlign:"left", fontWeight:700, fontSize:11, letterSpacing:1, textTransform:"uppercase", borderBottom:"1px solid #bfdbfe" },
  tr: { borderBottom:"1px solid #f0f9ff" },
  trTitle: { background:"#f0f9ff" },
  trGroupHeader: { background:"#e0f2fe" },
  trSubtotal: { background:"#dbeafe", borderTop:"2px solid #bfdbfe", borderBottom:"2px solid #bfdbfe" },
  trTotal: { background:"#bfdbfe", borderTop:"3px solid #2563eb" },
  td: { padding:"9px 12px", color:"#1e3a5f", verticalAlign:"middle" },
  // KPI
  kpiRow: { display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 },
  kpi: { flex:1, minWidth:130, background:"#fff", border:"1px solid #bfdbfe", borderRadius:12, padding:"14px 18px", boxShadow:"0 2px 6px rgba(37,99,235,0.06)" },
  kpiLabel: { display:"block", fontSize:11, fontWeight:700, color:"#64748b", letterSpacing:1, textTransform:"uppercase", marginBottom:6 },
  kpiValue: { display:"block", fontSize:20, fontWeight:800, letterSpacing:-0.5 },
  // Misc
  badge: { padding:"3px 10px", borderRadius:6, fontSize:11, fontWeight:700, color:"#fff" },
  empty: { color:"#94a3b8", fontStyle:"italic", padding:"16px 0" },
  toast: { position:"fixed", bottom:24, right:24, color:"#fff", padding:"12px 22px", borderRadius:10, fontWeight:700, fontSize:14, zIndex:9999, boxShadow:"0 4px 24px rgba(0,0,0,0.2)" },
  modal: { position:"fixed", inset:0, background:"rgba(30,58,95,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 },
  modalBox: { background:"#fff", border:"1px solid #bfdbfe", borderRadius:14, padding:28, width:"90%", maxWidth:460, boxShadow:"0 20px 60px rgba(37,99,235,0.15)" },
};
