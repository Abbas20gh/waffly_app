'use client'

// v2.8 — طراحی بصری فاکتور (HTML/CSS) — منبع مشترک پیش‌نمایش دیالوگ و خروجی PNG
// پالت بستنی: کرم روشن + پسته‌ای (تأکید) + قهوه‌ای گرم (عنوان‌ها) — در چاپ سیاه‌وسفید هم خوانا (وزن/کنتراست)
import { forwardRef } from 'react'
import type { InvoiceModel } from '@/lib/invoice'
import { SETTLE_LABEL, METHOD_LABEL } from '@/lib/invoice'
import { faDigits, faMoney, prettyJalali } from '@/lib/jalali'

// آیکون ساده بستنی — SVG خالص (بدون تصویر خارجی تا در خروجی PNG هم قابل‌اتکا باشد)
function IceCreamIcon({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="7.2" r="3.4" fill="#8FBF6A" />
      <circle cx="15" cy="7.2" r="3.4" fill="#C98A5B" />
      <circle cx="12" cy="5.4" r="3.6" fill="#E8B4B8" />
      <path d="M8.2 10.5h7.6L12 21z" fill="#D9A066" />
      <path d="M9.6 12.6h4.8M9 14.8h6" stroke="#B07B45" strokeWidth="0.7" />
    </svg>
  )
}

const C = {
  bg: '#FDF7EC',
  bgAlt: '#F6EBD8',
  ink: '#3E2E20',
  brown: '#7A5230',
  green: '#5F8D3E',
  greenSoft: '#EAF2DF',
  line: '#E3D2B8',
  muted: '#8A7458',
  red: '#B04A3A',
}

/**
 * عرض ثابت ۷۹۴px (A4 در ۹۶dpi) — در دیالوگ با transform کوچک می‌شود؛
 * خروجی PNG با همان اندازهٔ اصلی و pixelRatio=۲ گرفته می‌شود.
 */
export const InvoiceVisual = forwardRef<HTMLDivElement, { model: InvoiceModel; draftHint?: boolean }>(
  function InvoiceVisual({ model, draftHint }, ref) {
    const m = model
    const ctx = m.ctx
    return (
      <div ref={ref} dir="rtl" style={{
        width: 794, minHeight: 1000, background: C.bg, color: C.ink,
        fontFamily: 'Vazirmatn, sans-serif', padding: '40px 44px 30px', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
      }}>
        {/* نوار بالای پسته‌ای */}
        <div style={{ position: 'absolute', top: 0, right: 0, left: 0, height: 10, background: C.green }} />

        {/* سربرگ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <IceCreamIcon size={52} />
            <div>
              <div style={{ fontSize: 34, fontWeight: 800, color: C.brown, lineHeight: 1.25 }}>{ctx.businessName}</div>
              <div style={{ fontSize: 14, color: C.muted, marginTop: 4, direction: 'rtl' }}>
                {ctx.phones.join('  |  ')}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'left', minWidth: 190 }}>
            <div style={{
              display: 'inline-block', background: C.greenSoft, border: `1.5px solid ${C.green}`,
              borderRadius: 10, padding: '8px 16px', fontSize: 18, fontWeight: 800, color: C.green,
            }}>
              {m.number ? `فاکتور ${faDigits(m.number)}` : 'فاکتور پیش‌نویس'}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>تاریخ صدور: {prettyJalali(m.issueDate)}</div>
            {m.kind === 'combined' && (
              <div style={{ fontSize: 13, color: C.muted }}>{faDigits(m.sections.length)} فروش — صورت‌حساب ترکیبی</div>
            )}
          </div>
        </div>

        {draftHint && !m.number && (
          <div style={{
            marginTop: 14, border: `1.5px dashed ${C.red}`, color: C.red, borderRadius: 8,
            padding: '8px 14px', fontSize: 13, fontWeight: 600, background: '#FBEDE9',
          }}>
            پیش‌نویس — برای شماره‌گذاری فاکتور نیاز به اینترنت است؛ بعد از اتصال دوباره صادر کنید تا شمارهٔ نهایی بخورد.
          </div>
        )}

        {/* مشتری */}
        <div style={{ marginTop: 18, fontSize: 15 }}>
          <span style={{ color: C.muted }}>مشتری: </span>
          <span style={{ fontWeight: 800, fontSize: 17 }}>{m.customerName}</span>
          {m.customerPhone && <span style={{ color: C.muted }} dir="ltr"> — {m.customerPhone}</span>}
        </div>

        {/* جدول اقلام */}
        <div style={{ marginTop: 14, border: `1.5px solid ${C.line}`, borderRadius: 10, overflow: 'hidden', background: '#FFFDF8' }}>
          <div style={{ display: 'flex', background: C.brown, color: '#FFF6E9', fontWeight: 700, fontSize: 13.5 }}>
            <Cell w="34%">نوع</Cell>
            <Cell w="16%">تعداد</Cell>
            <Cell w="20%">قیمت واحد (تومان)</Cell>
            <Cell w="18%">جمع ردیف (تومان)</Cell>
            <Cell w="12%">برگشتی</Cell>
          </div>
          {m.sections.map((s, si) => (
            <div key={si}>
              {s.title && (
                <div style={{ display: 'flex', background: C.bgAlt, padding: '6px 12px', fontSize: 13, fontWeight: 800, color: C.brown }}>
                  {s.title} — جمع: {faMoney(s.total)} تومان
                </div>
              )}
              {s.items.map((it, i) => {
                const zebra = i % 2 === 1
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'stretch', fontSize: 13.5, background: zebra ? C.bgAlt : 'transparent', borderBottom: `1px solid ${C.line}` }}>
                    <Cell w="34%" style={{ fontWeight: 700 }}>{it.name}</Cell>
                    <Cell w="16%">{faDigits(it.qty)} {it.unit}</Cell>
                    <Cell w="20%">{faMoney(it.unitPrice)}</Cell>
                    <Cell w="18%" style={{ fontWeight: 700 }}>{faMoney(it.total)}</Cell>
                    <Cell w="12%" style={{ color: (it.returnedQty || 0) > 0 ? C.red : C.muted }}>
                      {(it.returnedQty || 0) > 0 ? `${faDigits(it.returnedQty || 0)} (${faMoney(it.returnedCost || 0)}−)` : '—'}
                    </Cell>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* جمع‌بندی — گوشهٔ پایین چپ */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 16 }}>
          <div dir="rtl" style={{ width: 320, border: `2px solid ${C.green}`, borderRadius: 12, background: C.greenSoft, padding: '12px 18px' }}>
            <Row label="جمع اقلام" value={faMoney(m.itemsTotal)} />
            {m.returnTotal > 0 && <Row label="کسر برگشتی" value={`${faMoney(m.returnTotal)}−`} />}
            {m.discountTotal > 0 && <Row label="تخفیف" value={`${faMoney(m.discountTotal)}−`} strong />}
            <div style={{ borderTop: `1.5px dashed ${C.green}`, margin: '8px 0' }} />
            <Row label="جمع نهایی" value={`${faMoney(m.grandTotal)} تومان`} big />
            {m.paidTotal > 0.5 && <Row label="پرداخت‌شده" value={faMoney(m.paidTotal)} />}
            {m.dueTotal > 0.5 && <Row label="مانده" value={faMoney(m.dueTotal)} strong />}
            {m.kind === 'single' && m.settledStatus && (
              <div style={{ marginTop: 6, fontSize: 12.5, color: C.muted }}>
                وضعیت: {SETTLE_LABEL[m.settledStatus]}
                {m.paymentMethod ? ` — ${METHOD_LABEL[m.paymentMethod] || ''}${m.paymentMethod === 'CHECK' && m.checkDueDate ? ` (سررسید ${prettyJalali(m.checkDueDate)})` : ''}` : ''}
              </div>
            )}
          </div>
        </div>

        {/* باکس واریز بانکی */}
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <div style={{ background: '#FFFDF8', border: `1.5px solid ${C.line}`, borderRight: `5px solid ${C.green}`, borderRadius: 10, padding: '12px 18px' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.brown, marginBottom: 6 }}>اطلاعات واریز کارت به کارت</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 28px', fontSize: 13.5 }}>
              <div>شماره کارت: <b style={{ direction: 'ltr', unicodeBidi: 'embed', display: 'inline-block' }}>{ctx.bank.cardNumber}</b></div>
              <div>به نام: <b>{ctx.bank.accountName}</b></div>
              <div>{ctx.bank.bankName}</div>
            </div>
            <div style={{ fontSize: 13.5, marginTop: 4 }}>
              شماره شبا: <b style={{ direction: 'ltr', unicodeBidi: 'embed', display: 'inline-block', fontSize: 13 }}>{ctx.bank.sheba}</b>
            </div>
          </div>

          {/* فوتر */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTop: `1.5px solid ${C.line}`, fontSize: 12.5, color: C.muted }}>
            <div>با تشکر از خرید شما 🌸</div>
            <div>{ctx.phones.join('  |  ')}</div>
          </div>
        </div>
      </div>
    )
  },
)

function Cell({ w, children, style }: { w: string; children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ width: w, padding: '7px 12px', ...style }}>{children}</div>
  )
}

function Row({ label, value, big, strong }: { label: string; value: string; big?: boolean; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px 0' }}>
      <span style={{ fontSize: big ? 15 : 13, color: C.muted, fontWeight: strong || big ? 700 : 400 }}>{label}</span>
      <span style={{ fontSize: big ? 20 : 13.5, fontWeight: big ? 800 : strong ? 700 : 400, color: big ? C.green : C.ink }}>
        {value}
      </span>
    </div>
  )
}
