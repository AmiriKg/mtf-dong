"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

const COLORS = ["#6C63FF", "#FF6584", "#43C6AC", "#F7971E", "#a18cd1", "#fd7043"];

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function Avatar({ name, size = 40 }) {
  const initials = name ? name.trim()[0].toUpperCase() : "?";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: colorForName(name || "?"), display: "flex", alignItems: "center",
      justifyContent: "center", color: "#fff",
      fontWeight: 700, fontSize: size * 0.4,
      flexShrink: 0,
    }}>{initials}</div>
  );
}

function formatAmount(n) {
  return Number(n).toLocaleString("fa-IR");
}

function genInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function MTFDong() {
  const [myName, setMyName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [screen, setScreen] = useState("login"); // login | home | group | addExpense
  const [myGroups, setMyGroups] = useState([]); // [{group_id, name, invite_code}]
  const [currentGroup, setCurrentGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expPaidBy, setExpPaidBy] = useState("");
  const [expSplitWith, setExpSplitWith] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  // Load identity from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mtfdong_name");
      if (saved) {
        setMyName(saved);
        setScreen("home");
      }
    } catch {}
  }, []);

  // Load groups this user belongs to
  const loadMyGroups = useCallback(async (name) => {
    if (!name) return;
    const { data: memberRows } = await supabase
      .from("members")
      .select("group_id, name")
      .eq("name", name);
    if (!memberRows || memberRows.length === 0) {
      setMyGroups([]);
      return;
    }
    const groupIds = [...new Set(memberRows.map(m => m.group_id))];
    const { data: groups } = await supabase
      .from("groups")
      .select("id, name, invite_code")
      .in("id", groupIds);
    setMyGroups(groups || []);
  }, []);

  useEffect(() => {
    if (myName) loadMyGroups(myName);
  }, [myName, loadMyGroups]);

  const loginWithName = () => {
    if (!nameInput.trim()) return;
    const name = nameInput.trim();
    localStorage.setItem("mtfdong_name", name);
    setMyName(name);
    setScreen("home");
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setLoading(true);
    const invite_code = genInviteCode();
    const { data: group, error } = await supabase
      .from("groups")
      .insert({ name: newGroupName.trim(), invite_code })
      .select()
      .single();
    if (error) { showToast("خطا در ساخت گروه"); setLoading(false); return; }
    await supabase.from("members").insert({ group_id: group.id, name: myName });
    setNewGroupName("");
    await loadMyGroups(myName);
    setLoading(false);
    openGroup(group.id);
  };

  const joinGroup = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    const code = joinCode.trim().toUpperCase();
    const { data: group } = await supabase
      .from("groups")
      .select("*")
      .eq("invite_code", code)
      .single();
    if (!group) { showToast("کد اشتباهه!"); setLoading(false); return; }
    const { data: existing } = await supabase
      .from("members")
      .select("*")
      .eq("group_id", group.id)
      .eq("name", myName);
    if (!existing || existing.length === 0) {
      await supabase.from("members").insert({ group_id: group.id, name: myName });
    }
    setJoinCode("");
    await loadMyGroups(myName);
    setLoading(false);
    showToast("✅ به گروه پیوستی!");
    openGroup(group.id);
  };

  const openGroup = async (groupId) => {
    setLoading(true);
    const { data: group } = await supabase.from("groups").select("*").eq("id", groupId).single();
    const { data: memberRows } = await supabase.from("members").select("*").eq("group_id", groupId).order("created_at");
    const { data: expenseRows } = await supabase.from("expenses").select("*").eq("group_id", groupId).order("created_at");
    setCurrentGroup(group);
    setMembers(memberRows || []);
    setExpenses(expenseRows || []);
    setScreen("group");
    setLoading(false);
  };

  // Real-time subscription for current group
  useEffect(() => {
    if (!currentGroup) return;
    const channel = supabase
      .channel(`group-${currentGroup.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `group_id=eq.${currentGroup.id}` },
        () => refreshGroupData(currentGroup.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "members", filter: `group_id=eq.${currentGroup.id}` },
        () => refreshGroupData(currentGroup.id))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentGroup]);

  const refreshGroupData = async (groupId) => {
    const { data: memberRows } = await supabase.from("members").select("*").eq("group_id", groupId).order("created_at");
    const { data: expenseRows } = await supabase.from("expenses").select("*").eq("group_id", groupId).order("created_at");
    setMembers(memberRows || []);
    setExpenses(expenseRows || []);
  };

  const addExpense = async () => {
    if (!expDesc.trim() || !expAmount || !expPaidBy || expSplitWith.length === 0) {
      showToast("همه فیلدها رو پر کن!");
      return;
    }
    setLoading(true);
    await supabase.from("expenses").insert({
      group_id: currentGroup.id,
      description: expDesc.trim(),
      amount: parseFloat(expAmount),
      paid_by: expPaidBy,
      split_with: expSplitWith,
    });
    setExpDesc(""); setExpAmount(""); setExpPaidBy(""); setExpSplitWith([]);
    setScreen("group");
    showToast("✅ خرید ثبت شد!");
    setLoading(false);
  };

  const deleteExpense = async (id) => {
    await supabase.from("expenses").delete().eq("id", id);
    showToast("خرید حذف شد");
  };

  const toggleSplitMember = (name) => {
    setExpSplitWith(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const calcBalances = () => {
    const bal = {};
    members.forEach(m => bal[m.name] = 0);
    expenses.forEach(exp => {
      const share = exp.amount / exp.split_with.length;
      exp.split_with.forEach(name => {
        if (name !== exp.paid_by) {
          bal[name] = (bal[name] || 0) - share;
          bal[exp.paid_by] = (bal[exp.paid_by] || 0) + share;
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

  const totalSpent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const myBalance = calcBalances()[myName] || 0;

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

  if (screen === "login") return (
    <div style={s.root}>
      <div style={{ ...s.body, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100dvh" }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>💸</div>
          <div style={{ ...s.logo, fontSize: 28 }}>MTFDong</div>
          <div style={s.sub}>تقسیم خرج با دوستات</div>
        </div>
        <div style={s.card}>
          <label style={s.label}>اسمت چیه؟</label>
          <input style={s.input} placeholder="مثلاً: امیر" value={nameInput}
            onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === "Enter" && loginWithName()} />
          <button style={{ ...s.btn(), width: "100%", padding: 12, marginTop: 12 }} onClick={loginWithName}>ورود</button>
        </div>
      </div>
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );

  if (screen === "home") return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={{ flex: 1 }}>
          <div style={s.logo}>💸 MTFDong</div>
          <div style={s.sub}>سلام {myName} 👋</div>
        </div>
        <button style={s.btnGhost} onClick={() => { localStorage.removeItem("mtfdong_name"); setMyName(""); setScreen("login"); }}>خروج</button>
      </div>
      <div style={s.body}>
        <div style={{ ...s.card, marginBottom: 14 }}>
          <label style={s.label}>ساخت گروه جدید</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={s.input} placeholder="مثلاً: سفر شمال" value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)} onKeyDown={e => e.key === "Enter" && createGroup()} />
            <button style={{ ...s.btn(), whiteSpace: "nowrap" }} onClick={createGroup} disabled={loading}>+ گروه</button>
          </div>
        </div>

        <div style={{ ...s.card, marginBottom: 20 }}>
          <label style={s.label}>پیوستن با کد دعوت</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={{ ...s.input, textTransform: "uppercase" }} placeholder="مثلاً: AB12CD" value={joinCode}
              onChange={e => setJoinCode(e.target.value)} onKeyDown={e => e.key === "Enter" && joinGroup()} />
            <button style={{ ...s.btn("#43C6AC"), whiteSpace: "nowrap" }} onClick={joinGroup} disabled={loading}>پیوستن</button>
          </div>
        </div>

        {myGroups.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#555" }}>
            <div style={{ fontSize: 48 }}>👥</div>
            <div style={{ fontSize: 15, marginTop: 12 }}>یه گروه بساز یا با کد بپیوند!</div>
          </div>
        )}

        {myGroups.map(g => (
          <div key={g.id} style={{ ...s.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }} onClick={() => openGroup(g.id)}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>{g.name}</div>
              <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>کد دعوت: {g.invite_code}</div>
            </div>
            <div style={{ fontSize: 20, color: "#666" }}>‹</div>
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
          <div style={{ flex: 1 }}>
            <div style={s.logo}>{currentGroup?.name}</div>
            <div style={s.sub}>مجموع: {formatAmount(totalSpent)} تومن · کد: {currentGroup?.invite_code}</div>
          </div>
        </div>
        <div style={s.body}>
          <div style={{ ...s.card, marginBottom: 14, background: myBalance > 0 ? "rgba(67,198,172,0.15)" : myBalance < 0 ? "rgba(255,101,132,0.15)" : "rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: 12, color: "#aaa" }}>حساب تو ({myName})</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: myBalance > 0 ? "#43C6AC" : myBalance < 0 ? "#ff6584" : "#ccc" }}>
              {myBalance > 0 ? `+${formatAmount(Math.round(myBalance))}` : myBalance < 0 ? `${formatAmount(Math.round(myBalance))}` : "0"} تومن
            </div>
            <div style={{ fontSize: 12, color: "#888" }}>
              {myBalance > 0 ? "بقیه بهت بدهکارن" : myBalance < 0 ? "تو بدهکاری" : "تسویه‌ای"}
            </div>
          </div>

          <div style={s.sec}>
            <div style={{ fontSize: 13, color: "#aaa", marginBottom: 10, fontWeight: 700 }}>👥 اعضا ({members.length})</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {members.map(m => <div key={m.id} style={s.chip(false)}><Avatar name={m.name} size={22} />{m.name}</div>)}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
              برای اضافه کردن دوست، کد <b style={{ color: "#a89fff" }}>{currentGroup?.invite_code}</b> رو بهش بده
            </div>
          </div>

          {members.length >= 2 && (
            <button style={{ ...s.btn(), width: "100%", padding: 14, fontSize: 15, marginBottom: 20 }}
              onClick={() => { setScreen("addExpense"); setExpSplitWith(members.map(m => m.name)); setExpPaidBy(myName); }}>
              + ثبت خرید جدید
            </button>
          )}

          {members.length > 0 && expenses.length > 0 && (
            <div style={{ ...s.card, marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#aaa", marginBottom: 12 }}>💰 حساب همه</div>
              {members.map(m => {
                const b = balances[m.name] || 0;
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <Avatar name={m.name} size={36} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{m.name}{m.name === myName ? " (تو)" : ""}</div>
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
              {[...expenses].reverse().map(exp => (
                <div key={exp.id} style={{ ...s.card, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Avatar name={exp.paid_by} size={38} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{exp.description}</div>
                    <div style={{ fontSize: 12, color: "#aaa", marginTop: 3 }}>{exp.paid_by} پرداخت کرد</div>
                    <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>تقسیم بین: {exp.split_with.join("، ")}</div>
                  </div>
                  <div style={{ textAlign: "left", flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, color: "#6C63FF", fontSize: 15 }}>{formatAmount(exp.amount)}</div>
                    <div style={{ fontSize: 10, color: "#666" }}>تومن</div>
                    {exp.paid_by === myName && (
                      <button style={{ ...s.btnGhost, padding: "3px 8px", fontSize: 12, marginTop: 4, color: "#ff6584", borderColor: "#ff658440" }}
                        onClick={() => deleteExpense(exp.id)}>حذف</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {expenses.length === 0 && members.length >= 2 && (
            <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
              <div style={{ fontSize: 40 }}>🛒</div>
              <div style={{ marginTop: 8 }}>هنوز خریدی ثبت نشده</div>
            </div>
          )}

          {members.length < 2 && (
            <div style={{ textAlign: "center", padding: 40, color: "#444" }}>
              <div style={{ fontSize: 40 }}>👋</div>
              <div style={{ marginTop: 8 }}>منتظر بمون تا یه دوست دیگه با کد بپیونده</div>
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
                <Avatar name={m.name} size={20} /> {m.name}
              </div>
            ))}
          </div>
        </div>
        <div style={s.sec}>
          <label style={s.label}>تقسیم بین چه کسایی؟</label>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {members.map(m => (
              <div key={m.id} style={s.chip(expSplitWith.includes(m.name))} onClick={() => toggleSplitMember(m.name)}>
                <Avatar name={m.name} size={20} /> {m.name}
              </div>
            ))}
          </div>
          {expSplitWith.length > 0 && expAmount && (
            <div style={{ fontSize: 12, color: "#888", marginTop: 8, padding: "8px 12px", background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
              سهم هر نفر: {formatAmount(Math.round(parseFloat(expAmount || 0) / expSplitWith.length))} تومن
            </div>
          )}
        </div>
        <button style={{ ...s.btn(), width: "100%", padding: 14, fontSize: 16 }} onClick={addExpense} disabled={loading}>✅ ثبت خرید</button>
      </div>
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}
