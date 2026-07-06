"use client";
import { useState, useEffect } from "react";

const COLORS = ["#6C63FF", "#FF6584", "#43C6AC", "#F7971E", "#a18cd1", "#fd7043"];

function Avatar({ name, color, size = 40 }) {
  const initials = name ? name.trim()[0].toUpperCase() : "?";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: color, display: "flex", alignItems: "center",
      justifyContent: "center", color: "#fff",
      fontWeight: 700, fontSize: size * 0.4,
      flexShrink: 0,
    }}>{initials}</div>
  );
}

function formatAmount(n) {
  return Number(n).toLocaleString("fa-IR");
}

export default function MftDong() {
  const [screen, setScreen] = useState("home");
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expPaidBy, setExpPaidBy] = useState("");
  const [expSplitWith, setExpSplitWith] = useState([]);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mft_dong_data");
      if (saved) {
        const data = JSON.parse(saved);
        setGroups(data.groups || []);
      }
    } catch {}
  }, []);

  const saveData = (updatedGroups) => {
    try {
      localStorage.setItem("mft_dong_data", JSON.stringify({ groups: updatedGroups }));
    } catch {}
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const openGroup = (group) => {
    setCurrentGroup(group);
    setMembers(group.members);
    setExpenses(group.expenses || []);
    setScreen("group");
  };

  const createGroup = () => {
    if (!newGroupName.trim()) return;
    const group = { id: Date.now(), name: newGroupName.trim(), members: [], expenses: [] };
    const updated = [...groups, group];
    setGroups(updated);
    saveData(updated);
    setNewGroupName("");
    openGroup(group);
  };

  const addMember = () => {
    if (!newMemberName.trim()) return;
    if (members.find(m => m.name === newMemberName.trim())) {
      showToast("این اسم قبلاً اضافه شده!");
      return;
    }
    const member = { id: Date.now(), name: newMemberName.trim(), color: COLORS[members.length % COLORS.length] };
    const updated = [...members, member];
    setMembers(updated);
    updateCurrentGroup({ members: updated });
    setNewMemberName("");
  };

  const updateCurrentGroup = (patch) => {
    const updated = groups.map(g => g.id === currentGroup.id ? { ...g, ...patch } : g);
    setGroups(updated);
    saveData(updated);
    setCurrentGroup(prev => ({ ...prev, ...patch }));
  };

  const addExpense = () => {
    if (!expDesc.trim() || !expAmount || !expPaidBy || expSplitWith.length === 0) {
      showToast("همه فیلدها رو پر کن!");
      return;
    }
    const expense = {
      id: Date.now(),
      desc: expDesc.trim(),
      amount: parseFloat(expAmount),
      paidBy: expPaidBy,
      splitWith: expSplitWith,
      date: new Date().toLocaleDateString("fa-IR"),
    };
    const updated = [...expenses, expense];
    setExpenses(updated);
    updateCurrentGroup({ expenses: updated });
    setExpDesc(""); setExpAmount(""); setExpPaidBy(""); setExpSplitWith([]);
    setScreen("group");
    showToast("✅ خرید ثبت شد!");
  };

  const deleteExpense = (id) => {
    const updated = expenses.filter(e => e.id !== id);
    setExpenses(updated);
    updateCurrentGroup({ expenses: updated });
    showToast("خرید حذف شد");
  };

  const deleteGroup = (id) => {
    const updated = groups.filter(g => g.id !== id);
    setGroups(updated);
    saveData(updated);
  };

  const calcBalances = () => {
    const bal = {};
    members.forEach(m => bal[m.name] = 0);
    expenses.forEach(exp => {
      const share = exp.amount / exp.splitWith.length;
      exp.splitWith.forEach(name => {
        if (name !== exp.paidBy) {
          bal[name] = (bal[name] || 0) - share;
          bal[exp.paidBy] = (bal[exp.paidBy] || 0) + share;
        }
      });
    });
    return bal;
  };

  const calcSettlements = () => {
    const bal = calcBalances();
    const creditors = [], debtors = [];
    Object.entries(bal).forEach(([name, amt]) => {
      if (amt > 0.01) creditors.push({ name, amt });
      else if (amt < -0.01) debtors.push({ name, amt: -amt });
    });
    const txns = [];
    let i = 0, j = 0;
    while (i < creditors.length && j < debtors.length) {
      const pay = Math.min(creditors[i].amt, debtors[j].amt);
      txns.push({ from: debtors[j].name, to: creditors[i].name, amount: Math.round(pay) });
      creditors[i].amt -= pay;
      debtors[j].amt -= pay;
      if (creditors[i].amt < 0.01) i++;
      if (debtors[j].amt < 0.01) j++;
    }
    return txns;
  };

  const toggleSplitMember = (name) => {
    setExpSplitWith(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

  const s = {
    root: { minHeight: "100dvh", background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)", direction: "rtl" },
    header: { background: "rgba(255,255,255,0.05)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 },
    logo: { fontSize: 20, fontWeight: 900, background: "linear-gradient(90deg, #6C63FF, #43C6AC)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    sub: { fontSize: 11, color: "#888", marginTop: 2 },
    body: { padding: "16px", maxWidth: 500, margin: "0 auto", paddingBottom: 40 },
    card: { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 14, marginBottom: 12 },
    input: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 15, width: "100%", outline: "none", direction: "rtl" },
    btn: (color = "#6C63FF") => ({ background: color, color: "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" }),
    btnGhost: { background: "rgba(255,255,255,0.08)", color: "#ccc", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 14px", fontSize: 13, cursor: "pointer" },
    label: { fontSize: 12, color: "#aaa", marginBottom: 6, display: "block" },
    sec: { marginBottom: 18 },
    chip: (active) => ({ display: "inline-flex", alignItems: "center", gap: 6, background: active ? "rgba(108,99,255,0.3)" : "rgba(255,255,255,0.07)", border: `1px solid ${active ? "#6C63FF" : "rgba(255,255,255,0.1)"}`, borderRadius: 20, padding: "6px 12px", cursor: "pointer", fontSize: 13, color: active ? "#a89fff" : "#ccc", margin: "3px" }),
    tag: (color) => ({ display: "inline-block", background: color + "33", color, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 }),
    toast: { position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)", background: "#222", color: "#fff", padding: "10px 24px", borderRadius: 24, fontSize: 14, zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", whiteSpace: "nowrap" },
  };

  if (screen === "home") return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <div style={s.logo}>💸 MFT Dong</div>
          <div style={s.sub}>تقسیم خرج با دوستات</div>
        </div>
      </div>
      <div style={s.body}>
        <div style={{ ...s.card, marginBottom: 20 }}>
          <label style={s.label}>اسم گروه جدید</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={s.input} placeholder="مثلاً: سفر شمال، خونه..." value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === "Enter" && createGroup()} />
            <button style={{ ...s.btn(), whiteSpace: "nowrap" }} onClick={createGroup}>+ گروه</button>
          </div>
        </div>

        {groups.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#555" }}>
            <div style={{ fontSize: 48 }}>👥</div>
            <div style={{ fontSize: 15, marginTop: 12 }}>یه گروه بساز و شروع کن!</div>
          </div>
        )}

        {groups.map(g => (
          <div key={g.id} style={{ ...s.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }} onClick={() => openGroup(g)}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>{g.name}</div>
              <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>{g.members.length} نفر · {g.expenses?.length || 0} خرید</div>
            </div>
            <div style={{ display: "flex" }}>
              {g.members.slice(0, 3).map((m, i) => (
                <div key={m.id} style={{ marginRight: i > 0 ? -8 : 0 }}><Avatar name={m.name} color={m.color} size={32} /></div>
              ))}
            </div>
            <button style={{ ...s.btnGhost, padding: "4px 10px", fontSize: 18, color: "#ff6584", border: "none" }}
              onClick={e => { e.stopPropagation(); deleteGroup(g.id); }}>×</button>
          </div>
        ))}
      </div>
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );

  if (screen === "group") {
    const balances = calcBalances();
    const settlements = calcSettlements();
    return (
      <div style={s.root}>
        <div style={s.header}>
          <button style={{ ...s.btnGhost, padding: "6px 12px", fontSize: 20 }} onClick={() => setScreen("home")}>→</button>
          <div>
            <div style={s.logo}>{currentGroup?.name}</div>
            <div style={s.sub}>مجموع: {formatAmount(totalSpent)} تومن</div>
          </div>
        </div>
        <div style={s.body}>
          <div style={s.sec}>
            <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10, fontWeight: 700 }}>👥 اعضا</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {members.map(m => <div key={m.id} style={s.chip(false)}><Avatar name={m.name} color={m.color} size={22} />{m.name}</div>)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={s.input} placeholder="اسم عضو جدید..." value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)} onKeyDown={e => e.key === "Enter" && addMember()} />
              <button style={{ ...s.btn("#43C6AC"), whiteSpace: "nowrap" }} onClick={addMember}>+ عضو</button>
            </div>
          </div>

          {members.length >= 2 && (
            <button style={{ ...s.btn(), width: "100%", padding: 14, fontSize: 15, marginBottom: 20 }}
              onClick={() => { setScreen("addExpense"); setExpSplitWith(members.map(m => m.name)); }}>
              + ثبت خرید جدید
            </button>
          )}

          {members.length > 0 && expenses.length > 0 && (
            <div style={{ ...s.card, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#aaa", marginBottom: 12 }}>💰 حساب هر نفر</div>
              {members.map(m => {
                const b = balances[m.name] || 0;
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <Avatar name={m.name} color={m.color} size={36} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: b > 0 ? "#43C6AC" : b < 0 ? "#ff6584" : "#888" }}>
                        {b > 0 ? `طلبکار: ${formatAmount(Math.round(b))} تومن` : b < 0 ? `بدهکار: ${formatAmount(Math.round(-b))} تومن` : "تسویه‌ست ✓"}
                      </div>
                    </div>
                    <div style={s.tag(b > 0 ? "#43C6AC" : b < 0 ? "#ff6584" : "#888")}>
                      {b > 0 ? "+" : ""}{formatAmount(Math.round(b))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {settlements.length > 0 && (
            <div style={{ ...s.card, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#aaa", marginBottom: 12 }}>🤝 برای تسویه</div>
              {settlements.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: "rgba(108,99,255,0.1)", borderRadius: 10, padding: "8px 12px", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, color: "#ff6584" }}>{t.from}</span>
                  <span style={{ color: "#777", fontSize: 12 }}>باید بده به</span>
                  <span style={{ fontWeight: 700, color: "#43C6AC" }}>{t.to}</span>
                  <span style={{ marginRight: "auto", fontWeight: 700, color: "#fff", fontSize: 13 }}>{formatAmount(t.amount)} تومن</span>
                </div>
              ))}
            </div>
          )}

          {expenses.length > 0 && (
            <div>
              <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10, fontWeight: 700 }}>🧾 خریدها</div>
              {[...expenses].reverse().map(exp => {
                const payer = members.find(m => m.name === exp.paidBy);
                return (
                  <div key={exp.id} style={{ ...s.card, display: "flex", gap: 12, alignItems: "flex-start" }}>
                    {payer && <Avatar name={payer.name} color={payer.color} size={38} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{exp.desc}</div>
                      <div style={{ fontSize: 12, color: "#aaa", marginTop: 3 }}>{exp.paidBy} پرداخت کرد · {exp.date}</div>
                      <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>تقسیم بین: {exp.splitWith.join("، ")}</div>
                    </div>
                    <div style={{ textAlign: "left", flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, color: "#6C63FF", fontSize: 15 }}>{formatAmount(exp.amount)}</div>
                      <div style={{ fontSize: 10, color: "#666" }}>تومن</div>
                      <button style={{ ...s.btnGhost, padding: "3px 8px", fontSize: 12, marginTop: 4, color: "#ff6584", borderColor: "#ff658440" }}
                        onClick={() => deleteExpense(exp.id)}>حذف</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {expenses.length === 0 && members.length >= 2 && (
            <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
              <div style={{ fontSize: 40 }}>🛒</div>
              <div style={{ marginTop: 8 }}>هنوز خریدی ثبت نشده</div>
            </div>
          )}
        </div>
        {toast && <div style={s.toast}>{toast}</div>}
      </div>
    );
  }

  if (screen === "addExpense") return (
    <div style={s.root}>
      <div style={s.header}>
        <button style={{ ...s.btnGhost, padding: "6px 12px", fontSize: 20 }} onClick={() => setScreen("group")}>→</button>
        <div style={s.logo}>+ ثبت خرید</div>
      </div>
      <div style={s.body}>
        <div style={s.sec}>
          <label style={s.label}>توضیح خرید</label>
          <input style={s.input} placeholder="مثلاً: پیتزا، بنزین، بازار..." value={expDesc} onChange={e => setExpDesc(e.target.value)} />
        </div>
        <div style={s.sec}>
          <label style={s.label}>مبلغ (تومن)</label>
          <input style={s.input} type="number" inputMode="numeric" placeholder="مثلاً: 250000" value={expAmount} onChange={e => setExpAmount(e.target.value)} />
        </div>
        <div style={s.sec}>
          <label style={s.label}>چه کسی پرداخت کرد؟</label>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {members.map(m => (
              <div key={m.id} style={s.chip(expPaidBy === m.name)} onClick={() => setExpPaidBy(m.name)}>
                <Avatar name={m.name} color={m.color} size={20} /> {m.name}
              </div>
            ))}
          </div>
        </div>
        <div style={s.sec}>
          <label style={s.label}>تقسیم بین چه کسایی؟</label>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {members.map(m => (
              <div key={m.id} style={s.chip(expSplitWith.includes(m.name))} onClick={() => toggleSplitMember(m.name)}>
                <Avatar name={m.name} color={m.color} size={20} /> {m.name}
              </div>
            ))}
          </div>
          {expSplitWith.length > 0 && expAmount && (
            <div style={{ fontSize: 12, color: "#888", marginTop: 8, padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
              سهم هر نفر: {formatAmount(Math.round(parseFloat(expAmount || 0) / expSplitWith.length))} تومن
            </div>
          )}
        </div>
        <button style={{ ...s.btn(), width: "100%", padding: 14, fontSize: 16 }} onClick={addExpense}>✅ ثبت خرید</button>
      </div>
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}
