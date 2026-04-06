import { useState, useEffect, useRef, useCallback } from "react";

// ─── Supabase config ───────────────────────────────────────────────────────
const SUPABASE_URL = "https://vwgumwnpgbybcocpzygq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3Z3Vtd25wZ2J5YmNvY3B6eWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0ODI3NzYsImV4cCI6MjA5MTA1ODc3Nn0.7JeR226bGW9mGvbKUeboFNcmwp4NA9SF4DdRJDxD11k";

const sb = async (path, opts = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": opts.prefer || "return=representation",
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const db = {
  // Categories
  getCategories: () => sb("categories?order=code"),
  upsertCategory: (cat) => sb("categories", { method: "POST", body: JSON.stringify(cat), headers: { "Prefer": "resolution=merge-duplicates,return=representation" } }),
  deleteCategory: (id) => sb(`categories?id=eq.${id}`, { method: "DELETE", prefer: "" }),

  // Transactions
  getTransactions: () => sb("transactions?order=due_date.desc"),
  insertTransactions: (txs) => sb("transactions", { method: "POST", body: JSON.stringify(txs) }),
  updateTransaction: (id, data) => sb(`transactions?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  updateTransactionsBulk: (ids, data) => sb(`transactions?id=in.(${ids.join(",")})`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTransaction: (id) => sb(`transactions?id=eq.${id}`, { method: "DELETE", prefer: "" }),

  // Credit analyses
  getCreditAnalyses: () => sb("credit_analyses?order=created_at.desc"),
  insertCreditAnalysis: (a) => sb("credit_analyses", { method: "POST", body: JSON.stringify(a) }),
  updateCreditAnalysis: (id, data) => sb(`credit_analyses?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// ─── Helpers ───────────────────────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const fmtCurrency = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseCurrency = (s) => parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0;
const nowISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (iso) => String(iso).slice(0, 7);
const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// Map DB snake_case → camelCase
const mapTx = (t) => ({
  id: t.id, description: t.description, categoryId: t.category_id,
  env: t.env, dueDate: t.due_date, plannedValue: Number(t.planned_value),
  settled: t.settled, settledDate: t.settled_date, settledValue: Number(t.settled_value || 0),
  recurGroup: t.recur_group,
});
const mapCat = (c) => ({ id: c.id, code: c.code, name: c.name, type: c.type, env: c.env });
const mapAnalysis = (a) => ({
  id: a.id, cardName: a.card_name, dueDate: a.due_date, fileName: a.file_name,
  analyzedAt: a.analyzed_at, totalValue: Number(a.total_value),
  topExpenses: a.top_expenses || [], summary: a.summary || "",
  addedToCashFlow: a.added_to_cash_flow,
});

// ─── App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [env, setEnv] = useState("casa");
  const [screen, setScreen] = useState("dashboard");
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [creditAnalyses, setCreditAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, txs, analyses] = await Promise.all([
        db.getCategories(),
        db.getTransactions(),
        db.getCreditAnalyses(),
      ]);
      setCategories(cats.map(mapCat));
      setTransactions(txs.map(mapTx));
      setCreditAnalyses(analyses.map(mapAnalysis));
    } catch (e) {
      showToast("Erro ao carregar dados. Verifique a conexão.", "error");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "⬛" },
    { id: "categories", label: "Categorias", icon: "🗂" },
    { id: "launch", label: "Lançamentos", icon: "➕" },
    { id: "settle", label: "Baixas", icon: "✅" },
    { id: "dre", label: "DRE", icon: "📊" },
    { id: "cashflow", label: "Fluxo de Caixa", icon: "📅" },
    ...(env === "casa" ? [{ id: "credit", label: "Cartão", icon: "💳" }] : []),
  ];

  if (loading) return (
    <div style={{ ...styles.root, display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>⟳</div>
        <p style={{ color: "#6366f1", fontWeight: 700, letterSpacing: 3 }}>CARREGANDO...</p>
      </div>
    </div>
  );

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>FINCTRL</span>
          <span style={styles.envBadge}>{env.toUpperCase()}</span>
        </div>
        <div style={styles.envToggle}>
          {["casa", "escritorio"].map(e => (
            <button key={e} style={{ ...styles.envBtn, ...(env === e ? styles.envBtnActive : {}) }}
              onClick={() => { setEnv(e); setScreen("dashboard"); }}>
              {e === "casa" ? "🏠 Casa" : "💼 Escritório"}
            </button>
          ))}
        </div>
      </header>

      <nav style={styles.nav}>
        {navItems.map(n => (
          <button key={n.id}
            style={{ ...styles.navBtn, ...(screen === n.id ? styles.navBtnActive : {}) }}
            onClick={() => setScreen(n.id)}>
            <span style={styles.navIcon}>{n.icon}</span>
            <span style={styles.navLabel}>{n.label}</span>
          </button>
        ))}
        <button style={{ ...styles.navBtn, marginLeft: "auto" }} onClick={loadAll} title="Recarregar dados">
          <span style={styles.navIcon}>🔄</span>
          <span style={styles.navLabel}>Sync</span>
        </button>
      </nav>

      <main style={styles.main}>
        {screen === "dashboard" && <Dashboard transactions={transactions} categories={categories} env={env} />}
        {screen === "categories" && <Categories categories={categories} setCategories={setCategories} env={env} showToast={showToast} />}
        {screen === "launch" && <Launch categories={categories} transactions={transactions} setTransactions={setTransactions} env={env} showToast={showToast} />}
        {screen === "settle" && <Settle transactions={transactions} setTransactions={setTransactions} categories={categories} env={env} showToast={showToast} />}
        {screen === "dre" && <DRE transactions={transactions} categories={categories} env={env} />}
        {screen === "cashflow" && <CashFlow transactions={transactions} categories={categories} env={env} />}
        {screen === "credit" && env === "casa" && <CreditCard creditAnalyses={creditAnalyses} setCreditAnalyses={setCreditAnalyses} transactions={transactions} setTransactions={setTransactions} categories={categories} showToast={showToast} />}
      </main>

      {toast && (
        <div style={{ ...styles.toast, background: toast.type === "error" ? "#dc2626" : "#16a34a" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────
function Dashboard({ transactions, categories, env }) {
  const curMonth = nowISO().slice(0, 7);
  const settled = transactions.filter(t => t.env === env && monthKey(t.dueDate) === curMonth && t.settled);
  const revenue = settled.filter(t => getCatType(t.categoryId, categories) === "revenue").reduce((s, t) => s + t.settledValue, 0);
  const expense = settled.filter(t => getCatType(t.categoryId, categories) === "expense").reduce((s, t) => s + t.settledValue, 0);
  const investment = settled.filter(t => getCatType(t.categoryId, categories) === "investment").reduce((s, t) => s + t.settledValue, 0);
  const balance = revenue - expense - investment;
  const pending = transactions.filter(t => t.env === env && !t.settled && monthKey(t.dueDate) === curMonth);

  return (
    <div>
      <h2 style={styles.pageTitle}>Dashboard — {env === "casa" ? "🏠 Casa" : "💼 Escritório"}</h2>
      <p style={styles.subtitle}>{MONTHS[parseInt(curMonth.slice(5, 7)) - 1]} / {curMonth.slice(0, 4)}</p>
      <div style={styles.kpiRow}>
        <KPI label="Receitas" value={revenue} color="#22c55e" />
        <KPI label="Despesas" value={expense} color="#ef4444" />
        <KPI label="Investimentos" value={investment} color="#6366f1" />
        <KPI label="Saldo" value={balance} color={balance >= 0 ? "#22c55e" : "#ef4444"} />
      </div>
      <h3 style={styles.sectionTitle}>Pendentes no mês ({pending.length})</h3>
      {pending.length === 0
        ? <p style={styles.empty}>Nenhum lançamento pendente.</p>
        : (
          <table style={styles.table}>
            <thead><tr>
              <th style={styles.th}>Vencimento</th><th style={styles.th}>Descrição</th>
              <th style={styles.th}>Categoria</th><th style={styles.th}>Valor Prev.</th>
            </tr></thead>
            <tbody>
              {pending.map(t => (
                <tr key={t.id} style={styles.tr}>
                  <td style={styles.td}>{fmtDate(t.dueDate)}</td>
                  <td style={styles.td}>{t.description}</td>
                  <td style={styles.td}>{getCatName(t.categoryId, categories)}</td>
                  <td style={{ ...styles.td, textAlign: "right" }}>{fmtCurrency(t.plannedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
    </div>
  );
}

function KPI({ label, value, color }) {
  return (
    <div style={styles.kpi}>
      <span style={styles.kpiLabel}>{label}</span>
      <span style={{ ...styles.kpiValue, color }}>
        {typeof value === "number" ? fmtCurrency(value) : value}
      </span>
    </div>
  );
}

// ─── Categories ────────────────────────────────────────────────────────────
function Categories({ categories, setCategories, env, showToast }) {
  const empty = { code: "", name: "", type: "expense", env: "both" };
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const catTypes = [
    { v: "title", l: "Título" }, { v: "revenue", l: "Receita" },
    { v: "expense", l: "Despesa" }, { v: "investment", l: "Investimento" },
  ];
  const envOpts = [
    { v: "both", l: "Ambos" }, { v: "casa", l: "Casa" }, { v: "escritorio", l: "Escritório" },
  ];

  const handleSave = async () => {
    if (!form.code || !form.name) { showToast("Preencha código e nome.", "error"); return; }
    setSaving(true);
    try {
      const record = { id: editing || form.code, code: form.code, name: form.name, type: form.type, env: form.env };
      await db.upsertCategory(record);
      if (editing) {
        setCategories(cs => cs.map(c => c.id === editing ? mapCat(record) : c));
        showToast("Categoria atualizada.");
      } else {
        setCategories(cs => [...cs, mapCat(record)].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
        showToast("Categoria criada.");
      }
      setForm(empty); setEditing(null);
    } catch { showToast("Erro ao salvar categoria.", "error"); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await db.deleteCategory(id);
      setCategories(cs => cs.filter(c => c.id !== id));
      showToast("Categoria removida.");
    } catch { showToast("Erro ao remover.", "error"); }
  };

  const filtered = categories
    .filter(c => c.env === "both" || c.env === env)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  return (
    <div>
      <h2 style={styles.pageTitle}>Plano de Contas</h2>
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>{editing ? "Editar Categoria" : "Nova Categoria"}</h3>
        <div style={styles.formRow}>
          <Field label="Código" value={form.code} onChange={v => setForm(f => ({ ...f, code: v }))} placeholder="Ex: 2.1.1" />
          <Field label="Nome" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Nome da conta" style={{ flex: 2 }} />
        </div>
        <div style={styles.formRow}>
          <SelectField label="Tipo" value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))} options={catTypes} />
          <SelectField label="Ambiente" value={form.env} onChange={v => setForm(f => ({ ...f, env: v }))} options={envOpts} />
        </div>
        <div style={styles.btnRow}>
          <button style={styles.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : (editing ? "Salvar Edição" : "Adicionar")}
          </button>
          {editing && <button style={styles.btnGhost} onClick={() => { setForm(empty); setEditing(null); }}>Cancelar</button>}
        </div>
      </div>

      <table style={styles.table}>
        <thead><tr>
          <th style={styles.th}>Código</th><th style={styles.th}>Nome</th>
          <th style={styles.th}>Tipo</th><th style={styles.th}>Ambiente</th><th style={styles.th}>Ações</th>
        </tr></thead>
        <tbody>
          {filtered.map(c => (
            <tr key={c.id} style={{ ...styles.tr, ...(c.type === "title" ? styles.trTitle : {}) }}>
              <td style={styles.td}>{c.code}</td>
              <td style={{ ...styles.td, fontWeight: c.type === "title" ? 700 : 400 }}>{c.name}</td>
              <td style={styles.td}>{catTypes.find(t => t.v === c.type)?.l}</td>
              <td style={styles.td}>{envOpts.find(e => e.v === c.env)?.l}</td>
              <td style={styles.td}>
                <button style={styles.btnSm} onClick={() => { setForm({ code: c.code, name: c.name, type: c.type, env: c.env }); setEditing(c.id); }}>✏️</button>
                <button style={{ ...styles.btnSm, color: "#ef4444" }} onClick={() => handleDelete(c.id)}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Launch ────────────────────────────────────────────────────────────────
function Launch({ categories, transactions, setTransactions, env, showToast }) {
  const [form, setForm] = useState({ description: "", categoryId: "", dueDate: nowISO(), plannedValue: "", recurring: false, recurMonths: 1 });
  const [saving, setSaving] = useState(false);

  const validCats = categories
    .filter(c => c.type !== "title" && (c.env === "both" || c.env === env))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const handleSave = async () => {
    if (!form.description || !form.categoryId || !form.dueDate || !form.plannedValue) {
      showToast("Preencha todos os campos.", "error"); return;
    }
    setSaving(true);
    try {
      const val = parseCurrency(form.plannedValue);
      const months = form.recurring ? parseInt(form.recurMonths) || 1 : 1;
      const recurGroup = form.recurring ? uid() : null;
      const newTxs = Array.from({ length: months }, (_, i) => {
        const d = new Date(form.dueDate + "T12:00:00");
        d.setMonth(d.getMonth() + i);
        return {
          id: uid(),
          description: form.description,
          category_id: form.categoryId,
          env,
          due_date: d.toISOString().slice(0, 10),
          planned_value: val,
          settled: false,
          settled_date: null,
          settled_value: 0,
          recur_group: recurGroup,
        };
      });
      const inserted = await db.insertTransactions(newTxs);
      setTransactions(ts => [...ts, ...inserted.map(mapTx)]);
      showToast(`${months} lançamento(s) criado(s)!`);
      setForm({ description: "", categoryId: "", dueDate: nowISO(), plannedValue: "", recurring: false, recurMonths: 1 });
    } catch { showToast("Erro ao salvar lançamento.", "error"); }
    setSaving(false);
  };

  return (
    <div>
      <h2 style={styles.pageTitle}>Novo Lançamento</h2>
      <div style={styles.card}>
        <div style={styles.formRow}>
          <Field label="Descrição" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Ex: Aluguel Janeiro" style={{ flex: 2 }} />
          <div style={styles.fieldWrap}>
            <label style={styles.label}>Categoria</label>
            <select style={styles.input} value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
              <option value="">Selecione...</option>
              {validCats.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </div>
        </div>
        <div style={styles.formRow}>
          <Field label="Data de Vencimento" type="date" value={form.dueDate} onChange={v => setForm(f => ({ ...f, dueDate: v }))} />
          <Field label="Valor Previsto" value={form.plannedValue} onChange={v => setForm(f => ({ ...f, plannedValue: v }))} placeholder="0,00" />
        </div>
        <div style={styles.checkRow}>
          <input type="checkbox" id="recur" checked={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.checked }))} />
          <label htmlFor="recur" style={styles.checkLabel}>Lançamento recorrente?</label>
        </div>
        {form.recurring && (
          <div style={{ ...styles.card, background: "#1e293b", marginTop: 8 }}>
            <Field label="Repetir por quantos meses?" type="number" value={form.recurMonths} onChange={v => setForm(f => ({ ...f, recurMonths: v }))} placeholder="1" />
            <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>
              Serão criados {form.recurMonths || 1} lançamentos a partir da data informada.
            </p>
          </div>
        )}
        <div style={styles.btnRow}>
          <button style={styles.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Lançar"}
          </button>
        </div>
      </div>

      <h3 style={styles.sectionTitle}>Últimos Lançamentos</h3>
      <table style={styles.table}>
        <thead><tr>
          <th style={styles.th}>Vencimento</th><th style={styles.th}>Descrição</th>
          <th style={styles.th}>Categoria</th><th style={styles.th}>Valor Prev.</th><th style={styles.th}>Status</th>
        </tr></thead>
        <tbody>
          {[...transactions].filter(t => t.env === env)
            .sort((a, b) => b.dueDate.localeCompare(a.dueDate)).slice(0, 25).map(t => (
            <tr key={t.id} style={styles.tr}>
              <td style={styles.td}>{fmtDate(t.dueDate)}</td>
              <td style={styles.td}>{t.description}</td>
              <td style={styles.td}>{getCatName(t.categoryId, categories)}</td>
              <td style={{ ...styles.td, textAlign: "right" }}>{fmtCurrency(t.plannedValue)}</td>
              <td style={styles.td}>
                <span style={{ ...styles.badge, background: t.settled ? "#16a34a" : "#d97706" }}>
                  {t.settled ? "Pago" : "Pendente"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Settle ────────────────────────────────────────────────────────────────
function Settle({ transactions, setTransactions, categories, env, showToast }) {
  const [month, setMonth] = useState(nowISO().slice(0, 7));
  const [editing, setEditing] = useState(null);
  const [settleForm, setSettleForm] = useState({ settledDate: nowISO(), settledValue: "", updateFuture: false });
  const [saving, setSaving] = useState(false);

  const pending = transactions
    .filter(t => t.env === env && !t.settled && monthKey(t.dueDate) === month)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const startSettle = (t) => {
    setEditing(t);
    setSettleForm({ settledDate: nowISO(), settledValue: fmtCurrency(t.plannedValue), updateFuture: false });
  };

  const confirmSettle = async () => {
    setSaving(true);
    try {
      const val = parseCurrency(settleForm.settledValue);
      await db.updateTransaction(editing.id, {
        settled: true, settled_date: settleForm.settledDate, settled_value: val,
      });
      setTransactions(ts => ts.map(t => t.id === editing.id
        ? { ...t, settled: true, settledDate: settleForm.settledDate, settledValue: val }
        : t));

      if (settleForm.updateFuture && editing.recurGroup) {
        const diff = val - editing.plannedValue;
        if (diff !== 0) {
          const future = transactions.filter(t =>
            t.recurGroup === editing.recurGroup && !t.settled && t.dueDate > editing.dueDate
          );
          for (const ft of future) {
            const newVal = ft.plannedValue + diff;
            await db.updateTransaction(ft.id, { planned_value: newVal });
            setTransactions(ts => ts.map(t => t.id === ft.id ? { ...t, plannedValue: newVal } : t));
          }
        }
      }
      showToast("Baixa efetuada!");
      setEditing(null);
    } catch { showToast("Erro ao dar baixa.", "error"); }
    setSaving(false);
  };

  return (
    <div>
      <h2 style={styles.pageTitle}>Baixas — {env === "casa" ? "🏠 Casa" : "💼 Escritório"}</h2>
      <div style={styles.formRow}>
        <div style={styles.fieldWrap}>
          <label style={styles.label}>Mês de referência</label>
          <input type="month" style={styles.input} value={month} onChange={e => setMonth(e.target.value)} />
        </div>
      </div>

      {pending.length === 0
        ? <p style={styles.empty}>Nenhum lançamento pendente neste mês.</p>
        : (
          <table style={styles.table}>
            <thead><tr>
              <th style={styles.th}>Vencimento</th><th style={styles.th}>Descrição</th>
              <th style={styles.th}>Categoria</th><th style={styles.th}>Valor Prev.</th><th style={styles.th}>Ação</th>
            </tr></thead>
            <tbody>
              {pending.map(t => (
                <tr key={t.id} style={styles.tr}>
                  <td style={styles.td}>{fmtDate(t.dueDate)}</td>
                  <td style={styles.td}>{t.description}</td>
                  <td style={styles.td}>{getCatName(t.categoryId, categories)}</td>
                  <td style={{ ...styles.td, textAlign: "right" }}>{fmtCurrency(t.plannedValue)}</td>
                  <td style={styles.td}>
                    <button style={styles.btnPrimary} onClick={() => startSettle(t)}>Dar Baixa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

      {editing && (
        <div style={styles.modal}>
          <div style={styles.modalBox}>
            <h3 style={{ color: "#f1f5f9", marginBottom: 12 }}>Confirmar Baixa</h3>
            <p style={{ color: "#94a3b8", marginBottom: 16 }}>{editing.description} — Venc. {fmtDate(editing.dueDate)}</p>
            <Field label="Data do Pagamento" type="date" value={settleForm.settledDate} onChange={v => setSettleForm(f => ({ ...f, settledDate: v }))} />
            <Field label="Valor Pago" value={settleForm.settledValue} onChange={v => setSettleForm(f => ({ ...f, settledValue: v }))} placeholder="0,00" />
            {editing.recurGroup && (
              <div style={{ ...styles.checkRow, marginTop: 12 }}>
                <input type="checkbox" id="uf" checked={settleForm.updateFuture} onChange={e => setSettleForm(f => ({ ...f, updateFuture: e.target.checked }))} />
                <label htmlFor="uf" style={styles.checkLabel}>Atualizar meses seguintes com a diferença?</label>
              </div>
            )}
            <div style={styles.btnRow}>
              <button style={styles.btnPrimary} onClick={confirmSettle} disabled={saving}>{saving ? "Salvando..." : "Confirmar"}</button>
              <button style={styles.btnGhost} onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DRE ───────────────────────────────────────────────────────────────────
function DRE({ transactions, categories, env }) {
  const [year, setYear] = useState(new Date().getFullYear());
  return <FinancialReport title="DRE — Realizado" transactions={transactions} categories={categories} env={env} year={year} setYear={setYear} onlySettled={true} />;
}

function CashFlow({ transactions, categories, env }) {
  const [year, setYear] = useState(new Date().getFullYear());
  return <FinancialReport title="Fluxo de Caixa — Programado" transactions={transactions} categories={categories} env={env} year={year} setYear={setYear} onlySettled={false} />;
}

function FinancialReport({ title, transactions, categories, env, year, setYear, onlySettled }) {
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const getValue = (catId, monthIdx) => {
    const mk = `${year}-${String(monthIdx).padStart(2, "0")}`;
    return transactions
      .filter(t => t.env === env && t.categoryId === catId && monthKey(t.dueDate) === mk && (onlySettled ? t.settled : true))
      .reduce((s, t) => s + (onlySettled ? t.settledValue : t.plannedValue), 0);
  };

  const catGroups = [
    { key: "revenue", label: "RECEITAS", color: "#22c55e" },
    { key: "expense", label: "DESPESAS", color: "#ef4444" },
    { key: "investment", label: "INVESTIMENTOS", color: "#6366f1" },
  ];

  const sortedCats = [...categories]
    .filter(c => c.env === "both" || c.env === env)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  const subtotals = {};
  catGroups.forEach(g => {
    subtotals[g.key] = months.map(m =>
      sortedCats.filter(c => c.type === g.key).reduce((s, c) => s + getValue(c.id, m), 0)
    );
  });
  const totals = months.map((_, i) => subtotals.revenue[i] - subtotals.expense[i] - subtotals.investment[i]);

  const titleCodeMap = { revenue: "1", expense: "2", investment: "3" };

  return (
    <div>
      <h2 style={styles.pageTitle}>{title}</h2>
      <div style={{ ...styles.formRow, marginBottom: 16 }}>
        <div style={styles.fieldWrap}>
          <label style={styles.label}>Ano</label>
          <input type="number" style={{ ...styles.input, width: 100 }} value={year} onChange={e => setYear(parseInt(e.target.value))} />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ ...styles.table, minWidth: 1100 }}>
          <thead>
            <tr>
              <th style={{ ...styles.th, minWidth: 220, position: "sticky", left: 0, background: "#1e293b" }}>Conta</th>
              {months.map(m => <th key={m} style={{ ...styles.th, width: 80, textAlign: "right" }}>{MONTHS[m - 1]}</th>)}
            </tr>
          </thead>
          <tbody>
            {catGroups.map(g => {
              const titleCat = sortedCats.find(c => c.type === "title" && c.code === titleCodeMap[g.key]);
              const leafCats = sortedCats.filter(c => c.type === g.key);
              return [
                titleCat && (
                  <tr key={`h-${g.key}`} style={styles.trGroupHeader}>
                    <td style={{ ...styles.td, fontWeight: 800, color: g.color, fontSize: 13, position: "sticky", left: 0, background: "#131d2e" }} colSpan={13}>
                      {titleCat.code} — {titleCat.name}
                    </td>
                  </tr>
                ),
                ...leafCats.map(c => (
                  <tr key={c.id} style={styles.tr}>
                    <td style={{ ...styles.td, paddingLeft: 24, position: "sticky", left: 0, background: "#1a2540" }}>{c.code} — {c.name}</td>
                    {months.map(m => {
                      const v = getValue(c.id, m);
                      return <td key={m} style={{ ...styles.td, textAlign: "right", color: v === 0 ? "#475569" : "#f1f5f9" }}>{fmtCurrency(v)}</td>;
                    })}
                  </tr>
                )),
                <tr key={`sub-${g.key}`} style={styles.trSubtotal}>
                  <td style={{ ...styles.td, fontWeight: 700, color: g.color, position: "sticky", left: 0, background: "#1e293b" }}>Subtotal {g.label}</td>
                  {subtotals[g.key].map((v, i) => (
                    <td key={i} style={{ ...styles.td, textAlign: "right", fontWeight: 700, color: g.color }}>{fmtCurrency(v)}</td>
                  ))}
                </tr>
              ];
            })}
            <tr style={styles.trTotal}>
              <td style={{ ...styles.td, fontWeight: 800, fontSize: 13, position: "sticky", left: 0, background: "#0f172a" }}>TOTAL (REC − DESP − INV)</td>
              {totals.map((v, i) => (
                <td key={i} style={{ ...styles.td, textAlign: "right", fontWeight: 800, fontSize: 13, color: v >= 0 ? "#22c55e" : "#ef4444" }}>{fmtCurrency(v)}</td>
              ))}
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
    if (!file || !cardName) { showToast("Informe o nome do cartão e selecione o arquivo.", "error"); return; }
    setAnalyzing(true);
    try {
      const base64 = await fileToBase64(file);
      const isPdf = file.type === "application/pdf";
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          messages: [{
            role: "user",
            content: [
              isPdf
                ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
                : { type: "image", source: { type: "base64", media_type: file.type, data: base64 } },
              {
                type: "text",
                text: `Analise esta fatura de cartão de crédito e retorne SOMENTE um JSON válido sem markdown, no formato:
{"totalValue":<número>,"topExpenses":[{"description":"nome","value":<número>,"date":"dd/mm/aaaa"}],"summary":"resumo"}
Liste os 10 maiores gastos individuais em topExpenses, do maior para o menor. Valores como números sem formatação.`
              }
            ]
          }]
        })
      });
      const data = await resp.json();
      const raw = data.content?.map(b => b.text || "").join("") || "";
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setResult({ id: uid(), cardName, dueDate, fileName: file.name, analyzedAt: nowISO(), totalValue: parsed.totalValue, topExpenses: parsed.topExpenses || [], summary: parsed.summary || "", addedToCashFlow: false });
    } catch (e) {
      showToast("Erro ao analisar. Verifique o arquivo.", "error");
    }
    setAnalyzing(false);
  };

  const saveAnalysis = async () => {
    if (!result) return;
    try {
      await db.insertCreditAnalysis({
        id: result.id, card_name: result.cardName, due_date: result.dueDate,
        file_name: result.fileName, analyzed_at: result.analyzedAt,
        total_value: result.totalValue, top_expenses: result.topExpenses,
        summary: result.summary, added_to_cash_flow: false,
      });
      setCreditAnalyses(a => [result, ...a]);
      showToast("Análise salva!");
      setResult(null); setFile(null); setCardName(""); setDueDate(nowISO());
      if (fileRef.current) fileRef.current.value = "";
    } catch { showToast("Erro ao salvar análise.", "error"); }
  };

  const addToCashFlow = async (analysis) => {
    const cat = categories.find(c => c.type === "expense" && (c.env === "both" || c.env === "casa"));
    const tx = {
      id: uid(), description: `Fatura ${analysis.cardName}`,
      category_id: cat?.id || null, env: "casa",
      due_date: analysis.dueDate, planned_value: analysis.totalValue,
      settled: false, settled_date: null, settled_value: 0, recur_group: null,
    };
    try {
      const inserted = await db.insertTransactions([tx]);
      setTransactions(ts => [...ts, ...inserted.map(mapTx)]);
      await db.updateCreditAnalysis(analysis.id, { added_to_cash_flow: true });
      setCreditAnalyses(as => as.map(a => a.id === analysis.id ? { ...a, addedToCashFlow: true } : a));
      showToast("Fatura adicionada ao Fluxo de Caixa!");
    } catch { showToast("Erro ao adicionar ao fluxo.", "error"); }
  };

  return (
    <div>
      <h2 style={styles.pageTitle}>💳 Análise de Cartão de Crédito</h2>
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Analisar Nova Fatura</h3>
        <div style={styles.formRow}>
          <Field label="Nome do Cartão" value={cardName} onChange={setCardName} placeholder="Ex: Nubank, Itaú Visa" />
          <Field label="Data de Vencimento" type="date" value={dueDate} onChange={setDueDate} />
        </div>
        <div style={styles.fieldWrap}>
          <label style={styles.label}>Arquivo da Fatura (PDF ou imagem)</label>
          <input ref={fileRef} type="file" accept=".pdf,image/*" style={styles.input} onChange={e => setFile(e.target.files[0])} />
        </div>
        <div style={styles.btnRow}>
          <button style={styles.btnPrimary} onClick={analyze} disabled={analyzing}>
            {analyzing ? "Analisando com IA..." : "Analisar Fatura"}
          </button>
        </div>
      </div>

      {result && (
        <div style={{ ...styles.card, borderColor: "#6366f1" }}>
          <h3 style={styles.cardTitle}>Resultado — {result.cardName}</h3>
          <p style={{ color: "#94a3b8", marginBottom: 12 }}>{result.summary}</p>
          <div style={styles.kpiRow}>
            <KPI label="Total da Fatura" value={result.totalValue} color="#6366f1" />
            <KPI label="Vencimento" value={fmtDate(result.dueDate)} color="#f1f5f9" />
          </div>
          <h4 style={{ color: "#f1f5f9", marginTop: 16, marginBottom: 8 }}>Top 10 Maiores Gastos</h4>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>#</th><th style={styles.th}>Descrição</th><th style={styles.th}>Data</th><th style={styles.th}>Valor</th></tr></thead>
            <tbody>
              {result.topExpenses.map((e, i) => (
                <tr key={i} style={styles.tr}>
                  <td style={styles.td}>{i + 1}</td><td style={styles.td}>{e.description}</td>
                  <td style={styles.td}>{e.date}</td>
                  <td style={{ ...styles.td, textAlign: "right" }}>{fmtCurrency(e.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={styles.btnRow}>
            <button style={styles.btnPrimary} onClick={saveAnalysis}>Salvar Análise</button>
            <button style={styles.btnGhost} onClick={() => setResult(null)}>Descartar</button>
          </div>
        </div>
      )}

      <h3 style={styles.sectionTitle}>Histórico de Análises</h3>
      {creditAnalyses.length === 0 ? <p style={styles.empty}>Nenhuma análise salva.</p> : (
        <table style={styles.table}>
          <thead><tr>
            <th style={styles.th}>Cartão</th><th style={styles.th}>Vencimento</th>
            <th style={styles.th}>Total</th><th style={styles.th}>Analisado em</th>
            <th style={styles.th}>Status</th><th style={styles.th}>Ações</th>
          </tr></thead>
          <tbody>
            {creditAnalyses.map(a => (
              <tr key={a.id} style={styles.tr}>
                <td style={styles.td}>{a.cardName}</td>
                <td style={styles.td}>{fmtDate(a.dueDate)}</td>
                <td style={{ ...styles.td, textAlign: "right" }}>{fmtCurrency(a.totalValue)}</td>
                <td style={styles.td}>{fmtDate(a.analyzedAt)}</td>
                <td style={styles.td}><span style={{ ...styles.badge, background: a.addedToCashFlow ? "#16a34a" : "#475569" }}>{a.addedToCashFlow ? "No Fluxo" : "Pendente"}</span></td>
                <td style={styles.td}>
                  <button style={styles.btnSm} onClick={() => setSelected(selected?.id === a.id ? null : a)}>👁</button>
                  {!a.addedToCashFlow && <button style={{ ...styles.btnSm, background: "#6366f1" }} onClick={() => addToCashFlow(a)}>→ Fluxo</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {selected && (
        <div style={{ ...styles.card, marginTop: 16, borderColor: "#6366f1" }}>
          <h4 style={{ color: "#f1f5f9", marginBottom: 12 }}>Top Gastos — {selected.cardName} ({fmtDate(selected.dueDate)})</h4>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>#</th><th style={styles.th}>Descrição</th><th style={styles.th}>Data</th><th style={styles.th}>Valor</th></tr></thead>
            <tbody>
              {selected.topExpenses.map((e, i) => (
                <tr key={i} style={styles.tr}>
                  <td style={styles.td}>{i + 1}</td><td style={styles.td}>{e.description}</td>
                  <td style={styles.td}>{e.date}</td>
                  <td style={{ ...styles.td, textAlign: "right" }}>{fmtCurrency(e.value)}</td>
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
function Field({ label, value, onChange, type = "text", placeholder = "", style = {} }) {
  return (
    <div style={{ ...styles.fieldWrap, ...style }}>
      <label style={styles.label}>{label}</label>
      <input type={type} style={styles.input} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
function SelectField({ label, value, onChange, options }) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <select style={styles.input} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

// ─── Utils ─────────────────────────────────────────────────────────────────
function getCatName(id, cats) { return cats.find(c => c.id === id)?.name || "—"; }
function getCatType(id, cats) { return cats.find(c => c.id === id)?.type || ""; }
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file);
  });
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = {
  root: { fontFamily: "'IBM Plex Mono','Courier New',monospace", background: "#0d1117", minHeight: "100vh", color: "#f1f5f9" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", background: "#0f172a", borderBottom: "1px solid #1e293b" },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontSize: 20, fontWeight: 900, letterSpacing: 4, color: "#6366f1" },
  envBadge: { background: "#1e293b", color: "#94a3b8", padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 2 },
  envToggle: { display: "flex", gap: 8 },
  envBtn: { background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 },
  envBtnActive: { background: "#6366f1", border: "1px solid #6366f1", color: "#fff" },
  nav: { display: "flex", gap: 4, padding: "10px 16px", background: "#0f172a", borderBottom: "1px solid #1e293b", overflowX: "auto" },
  navBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "transparent", border: "none", color: "#64748b", padding: "8px 14px", borderRadius: 8, cursor: "pointer", minWidth: 72, fontSize: 11, fontFamily: "inherit" },
  navBtnActive: { background: "#1e293b", color: "#f1f5f9", borderBottom: "2px solid #6366f1" },
  navIcon: { fontSize: 18 },
  navLabel: { fontSize: 11, fontWeight: 600, letterSpacing: 0.5 },
  main: { padding: "24px", maxWidth: 1400, margin: "0 auto" },
  pageTitle: { fontSize: 22, fontWeight: 800, color: "#f1f5f9", marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { color: "#64748b", fontSize: 13, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: "#94a3b8", margin: "24px 0 12px" },
  card: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: 20, marginBottom: 20 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 16 },
  formRow: { display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 140 },
  label: { fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 1, textTransform: "uppercase" },
  input: { background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#f1f5f9", padding: "8px 12px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
  checkRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 },
  checkLabel: { color: "#94a3b8", fontSize: 13, cursor: "pointer" },
  btnRow: { display: "flex", gap: 10, marginTop: 12 },
  btnPrimary: { background: "#6366f1", color: "#fff", border: "none", padding: "9px 20px", borderRadius: 7, fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  btnGhost: { background: "transparent", color: "#94a3b8", border: "1px solid #334155", padding: "9px 20px", borderRadius: 7, fontWeight: 700, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  btnSm: { background: "#1e293b", border: "none", padding: "4px 10px", borderRadius: 5, cursor: "pointer", marginRight: 4, fontSize: 13, color: "#f1f5f9", fontFamily: "inherit" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { background: "#1e293b", color: "#64748b", padding: "8px 12px", textAlign: "left", fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", borderBottom: "1px solid #334155" },
  tr: { borderBottom: "1px solid #1e293b" },
  trTitle: { background: "#131d2e" },
  trGroupHeader: { background: "#131d2e" },
  trSubtotal: { background: "#1e293b", borderTop: "2px solid #334155", borderBottom: "2px solid #334155" },
  trTotal: { background: "#0f172a", borderTop: "3px solid #6366f1" },
  td: { padding: "9px 12px", color: "#e2e8f0", verticalAlign: "middle" },
  kpiRow: { display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 },
  kpi: { flex: 1, minWidth: 140, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "16px 20px" },
  kpiLabel: { display: "block", fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  kpiValue: { display: "block", fontSize: 22, fontWeight: 800, letterSpacing: -1 },
  badge: { padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, color: "#fff" },
  empty: { color: "#475569", fontStyle: "italic", padding: "16px 0" },
  toast: { position: "fixed", bottom: 24, right: 24, color: "#fff", padding: "12px 22px", borderRadius: 8, fontWeight: 700, fontSize: 14, zIndex: 9999, boxShadow: "0 4px 24px rgba(0,0,0,0.4)" },
  modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 },
  modalBox: { background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: 28, width: "90%", maxWidth: 460 },
};
