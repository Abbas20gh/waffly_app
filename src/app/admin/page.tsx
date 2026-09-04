"use client";

// ===== پنل مدیریت فروشگاه آرتا =====
// ورود با رمز (ADMIN_PASSWORD) — کوکی امضاشده؛ سپس ۴ بخش:
// سفارش‌ها / محصولات / هزینه ارسال / تنظیمات

import { useCallback, useEffect, useState } from "react";
import { Loader2, LogOut, Lock, RefreshCcw, Save } from "lucide-react";
import { ORDER_STATUSES, statusLabel } from "@/lib/arta/constants";
import type { OrderDTO, ProductDTO, ProvinceDTO } from "@/lib/arta/types";
import { faDateTime, faNumber, faToman, toEn, toFa } from "@/lib/arta/format";
import { toast } from "@/hooks/use-toast";

type Tab = "orders" | "products" | "provinces" | "settings";

interface AdminOrder extends Omit<OrderDTO, "createdAt"> {
  id: string;
  createdAt: string;
}

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("orders");

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d) => setAuthed(!!d.authed))
      .catch(() => setAuthed(false));
  }, []);

  async function login() {
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const d = await res.json();
    if (d.ok) {
      setAuthed(true);
      toast({ title: "خوش آمدید" });
    } else {
      toast({ title: d.error || "ورود ناموفق", variant: "destructive" });
    }
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthed(false);
    setPassword("");
  }

  if (authed === null) {
    return <main className="grid min-h-screen place-items-center bg-background"><Loader2 className="size-6 animate-spin text-muted-foreground" /></main>;
  }

  if (!authed) {
    return (
      <main className="grid min-h-screen place-items-center bg-brand-soft px-4">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-accent text-pistachio-deep">
            <Lock className="size-7" />
          </span>
          <h1 className="mt-4 text-lg font-bold text-choco-deep">پنل مدیریت آرتا</h1>
          <p className="mt-1.5 text-xs text-muted-foreground">برای ورود، رمز مدیریت را وارد کنید</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="رمز عبور"
            className="mt-5 h-12 w-full rounded-2xl border border-input bg-background px-4 text-center outline-none focus:ring-2 focus:ring-ring"
            dir="ltr"
          />
          <button
            onClick={login}
            className="mt-4 h-12 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground"
          >
            ورود
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-soft">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <h1 className="text-sm font-bold text-choco">پنل مدیریت نان بستنی آرتا</h1>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            <LogOut className="size-3.5" />
            خروج
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2" aria-label="بخش‌های مدیریت">
          {(
            [
              ["orders", "سفارش‌ها"],
              ["products", "محصولات"],
              ["provinces", "هزینه ارسال"],
              ["settings", "تنظیمات"],
            ] as Array<[Tab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                tab === id ? "bg-choco text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        {tab === "orders" && <OrdersTab />}
        {tab === "products" && <ProductsTab />}
        {tab === "provinces" && <ProvincesTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </main>
  );
}

/* ---------- سفارش‌ها ---------- */
function OrdersTab() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (q) sp.set("q", q);
    sp.set("page", String(page));
    const res = await fetch(`/api/admin/orders?${sp}`);
    const d = await res.json();
    if (d.ok) {
      setOrders(d.orders);
      setPages(d.pages);
    }
    setLoading(false);
  }, [status, q, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatusOf(id: string, s: string) {
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: s }),
    });
    const d = await res.json();
    if (d.ok) {
      setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: s } : o)));
      toast({ title: "وضعیت بروزرسانی شد" });
    } else {
      toast({ title: d.error || "خطا", variant: "destructive" });
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-10 rounded-full border border-input bg-card px-3 text-xs outline-none"
          aria-label="فیلتر وضعیت"
        >
          <option value="">همه وضعیت‌ها</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          placeholder="جستجوی نام/موبایل/شماره سفارش"
          className="h-10 flex-1 rounded-full border border-input bg-card px-4 text-xs outline-none"
        />
        <button onClick={load} className="grid size-10 place-items-center rounded-full border border-border bg-card" aria-label="بارگذاری مجدد">
          <RefreshCcw className="size-4" />
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : orders.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">سفارشی یافت نشد.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="rounded-3xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-choco">
                    سفارش {toFa(o.serial)} — {o.customerName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">
                    {toFa(o.phone)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{faDateTime(o.createdAt)}</span>
                  <select
                    value={o.status}
                    onChange={(e) => setStatusOf(o.id, e.target.value)}
                    className="h-9 rounded-full border border-input bg-background px-3 text-xs font-bold outline-none"
                    aria-label="تغییر وضعیت"
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 rounded-2xl bg-muted/50 p-3 text-[11px] leading-5">
                {o.items.map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{faNumber(it.boxCount)} جعبه {it.name}{it.essence && " (اسانس پرتقال)"}{it.wholesale && " · عمده"}</span>
                    <span>{faToman(it.lineTotal)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t border-dashed border-border pt-1.5 text-muted-foreground">
                  <span>{o.provinceName}، {o.cityName} — ارسال: {o.shippingCost === 0 ? "رایگان" : faToman(o.shippingCost)} — پرداخت: {o.paymentMethod === "CARD_TRANSFER" ? "کارت به کارت" : "در محل"}</span>
                  <b className="text-choco">{faToman(o.total)}</b>
                </div>
                {o.address && <p className="text-muted-foreground">نشانی: {o.address}{o.postalCode ? ` — کدپستی ${toFa(o.postalCode)}` : ""}</p>}
                {o.note && <p className="text-muted-foreground">توضیح مشتری: {o.note}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="h-9 rounded-full border border-border px-4 text-xs disabled:opacity-40">قبلی</button>
          <span className="text-xs text-muted-foreground">صفحه {toFa(page)} از {toFa(pages)}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="h-9 rounded-full border border-border px-4 text-xs disabled:opacity-40">بعدی</button>
        </div>
      )}
    </div>
  );
}

/* ---------- محصولات ---------- */
function ProductsTab() {
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetch("/api/admin/products").then((r) => r.json());
    if (d.ok) setProducts(d.products);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function patch(id: string, data: Record<string, unknown>) {
    setSavingId(id);
    const res = await fetch("/api/admin/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    const d = await res.json();
    setSavingId("");
    if (d.ok) {
      setProducts((ps) => ps.map((p) => (p.id === id ? d.product : p)));
      toast({ title: "ذخیره شد" });
    } else {
      toast({ title: d.error || "خطا", variant: "destructive" });
    }
  }

  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      {products.map((p) => (
        <ProductRow key={p.id} product={p} saving={savingId === p.id} onSave={patch} />
      ))}
    </div>
  );
}

function ProductRow({
  product,
  saving,
  onSave,
}: {
  product: ProductDTO;
  saving: boolean;
  onSave: (id: string, data: Record<string, unknown>) => void;
}) {
  const [price, setPrice] = useState(String(product.pricePerUnit));
  useEffect(() => setPrice(String(product.pricePerUnit)), [product.pricePerUnit]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-card p-4">
      <div className="min-w-40 flex-1">
        <p className="text-sm font-bold text-choco">{product.name}</p>
        <p className="text-[11px] text-muted-foreground">
          جعبه خرده: {faToman(product.pricePerUnit * product.unitsPerBox)} — عمده: {faToman((product.pricePerUnit - 200) * product.unitsPerBox)}
        </p>
      </div>
      <label className="text-[11px] text-muted-foreground">
        قیمت هر عدد
        <input
          value={price}
          onChange={(e) => setPrice(toEn(e.target.value).replace(/\D/g, ""))}
          className="mt-1 block h-10 w-32 rounded-xl border border-input bg-background px-3 text-center text-sm font-bold outline-none"
          dir="ltr"
        />
      </label>
      <button
        onClick={() => onSave(product.id, { pricePerUnit: price })}
        disabled={saving || price === String(product.pricePerUnit)}
        className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-40"
      >
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
        ذخیره قیمت
      </button>
      <label className="flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={product.essenceEnabled}
          onChange={(e) => onSave(product.id, { essenceEnabled: e.target.checked })}
          className="size-4 accent-[#7fb069]"
        />
        اسانس پرتقال
      </label>
      <label className="flex items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={product.active}
          onChange={(e) => onSave(product.id, { active: e.target.checked })}
          className="size-4 accent-[#7fb069]"
        />
        فعال
      </label>
    </div>
  );
}

/* ---------- هزینه ارسال ---------- */
function ProvincesTab() {
  const [provinces, setProvinces] = useState<ProvinceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetch("/api/admin/provinces").then((r) => r.json());
    if (d.ok) setProvinces(d.provinces);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveAll() {
    setSaving(true);
    const res = await fetch("/api/admin/provinces", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: provinces.map((p) => ({ id: p.id, shippingCost: p.shippingCost })),
      }),
    });
    const d = await res.json();
    setSaving(false);
    if (d.ok) toast({ title: `جدول ارسال ذخیره شد (${faNumber(d.updated)} استان)` });
    else toast({ title: d.error || "خطا", variant: "destructive" });
  }

  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div>
      <p className="mb-3 text-xs leading-6 text-muted-foreground">
        هزینه ارسال هر استان از مبدأ تولید محاسبه می‌شود. خرید بالای سقف تعیین‌شده در
        تنظیمات، به‌صورت خودکار ارسال رایگان می‌گیرد.
      </p>
      <div className="nice-scroll max-h-[60vh] space-y-2 overflow-y-auto pl-1">
        {provinces.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5">
            <span className="flex-1 text-xs font-medium">{p.name}</span>
            <input
              value={p.shippingCost}
              onChange={(e) => {
                const v = toEn(e.target.value).replace(/\D/g, "");
                setProvinces((ps) => ps.map((x) => (x.id === p.id ? { ...x, shippingCost: Number(v || 0) } : x)));
              }}
              className="h-9 w-32 rounded-xl border border-input bg-background px-3 text-center text-xs font-bold outline-none"
              dir="ltr"
              aria-label={`هزینه ارسال ${p.name}`}
            />
            <span className="w-14 text-[10px] text-muted-foreground">تومان</span>
          </div>
        ))}
      </div>
      <button
        onClick={saveAll}
        disabled={saving}
        className="mt-4 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        ذخیره کل جدول
      </button>
    </div>
  );
}

/* ---------- تنظیمات ---------- */
function SettingsTab() {
  const [s, setS] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setS(d.settings); })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    const d = await res.json();
    setSaving(false);
    if (d.ok) {
      setS(d.settings);
      toast({ title: "تنظیمات ذخیره شد" });
    } else {
      toast({ title: d.error || "خطا", variant: "destructive" });
    }
  }

  if (loading) return <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  const fields: Array<[string, string, string]> = [
    ["originCity", "شهر مبدأ تولید/ارسال", "مثلاً تهران"],
    ["freeShippingThreshold", "سقف ارسال رایگان (تومان)", "۱۰۰۰۰۰۰۰"],
    ["cardNumber", "شماره کارت برای پرداخت کارت‌به‌کارت", "۶۰۳۷-۹۹xx-xxxx-xxxx"],
    ["cardOwner", "نام صاحب کارت", "گروه صنعتی آرتا"],
  ];

  return (
    <div className="max-w-xl space-y-4">
      {fields.map(([key, label, ph]) => (
        <div key={key}>
          <label className="mb-1.5 block text-xs font-bold text-choco" htmlFor={`st-${key}`}>{label}</label>
          <input
            id={`st-${key}`}
            value={s[key] || ""}
            onChange={(e) => setS((prev) => ({ ...prev, [key]: e.target.value }))}
            placeholder={ph}
            className="h-12 w-full rounded-2xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      ))}
      <button
        onClick={save}
        disabled={saving}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-8 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        ذخیره تنظیمات
      </button>
    </div>
  );
}
