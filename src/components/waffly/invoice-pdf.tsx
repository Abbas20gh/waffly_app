'use client'

// v2.8 — خروجی PDF/PNG فاکتور از همان طراحی HTML (invoice-visual) با استک اثبات‌شدهٔ پروژه
// (html2canvas-pro + jsPDF — همان مکانیک خروجی حسابداری که روی وب و APK واقعی کار می‌کند)
// ⚠️ نکته: نود رندر باید «بیرون از صفحه» باشد ولی opacity/display نرمال داشته باشد —
// html2canvas روی نود opacity:0 گیر می‌کند؛ برای همین رندر موقت با left:-2000px انجام می‌شود.
import type { InvoiceModel } from '@/lib/invoice'
import { invoiceFilename } from '@/lib/invoice'

/** رندر طراحی فاکتور به canvas — نود موقت بیرون از صفحه ساخته و بعد از capture حذف می‌شود */
export async function captureInvoiceCanvas(model: InvoiceModel): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas-pro')
  const react = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { InvoiceVisual } = await import('./invoice-visual')

  const holder = document.createElement('div')
  holder.style.cssText = 'position:fixed;top:0;left:-2000px;z-index:-1;background:#FDF7EC;'
  document.body.appendChild(holder)
  try {
    const root = createRoot(holder)
    root.render(react.createElement(InvoiceVisual, { model }))
    // اجازهٔ رندر کامل React + فونت‌ها
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
    await new Promise(r => setTimeout(r, 150))
    const node = holder.firstElementChild as HTMLElement
    return await html2canvas(node, {
      backgroundColor: '#FDF7EC',
      scale: 2,
      useCORS: true,
      logging: false,
    } as Parameters<typeof html2canvas>[1])
  } finally {
    holder.remove()
  }
}

/** canvas → PNG Blob */
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('ساخت PNG شکست خورد'))), 'image/png')
  })
}

/** canvas → Blob فاکتور PDF تک‌صفحه‌ای A4 (در صورت بلندی، چندصفحه‌ای) */
export async function canvasToPdfBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 6
  const imgW = pageW - margin * 2
  const imgH = (canvas.height * imgW) / canvas.width
  if (imgH <= pageH - margin * 2) {
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', margin, margin, imgW, imgH)
  } else {
    // بلندتر از یک صفحه (فاکتور ترکیبی با فروش‌های زیاد) — برش چندصفحه‌ای
    const pxPerPage = Math.floor(((pageH - margin * 2) * canvas.width) / imgW)
    let y = 0
    let first = true
    while (y < canvas.height) {
      const sliceH = Math.min(pxPerPage, canvas.height - y)
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = sliceH
      const ctx = slice.getContext('2d')!
      ctx.fillStyle = '#FDF7EC'
      ctx.fillRect(0, 0, slice.width, slice.height)
      ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
      if (!first) pdf.addPage()
      pdf.addImage(slice.toDataURL('image/jpeg', 0.94), 'JPEG', margin, margin, imgW, (sliceH * imgW) / canvas.width)
      first = false
      y += sliceH
    }
  }
  return pdf.output('blob')
}

/** ساخت Blob فاکتور PDF — از دیالوگ: await renderInvoicePdf(model) */
export async function renderInvoicePdf(model: InvoiceModel): Promise<Blob> {
  return await canvasToPdfBlob(await captureInvoiceCanvas(model))
}

/** ساخت Blob PNG فاکتور */
export async function renderInvoicePng(model: InvoiceModel): Promise<Blob> {
  return await canvasToPngBlob(await captureInvoiceCanvas(model))
}

/** دانلود مستقیم فایل فاکتور */
export async function downloadInvoiceFile(model: InvoiceModel, kind: 'pdf' | 'png'): Promise<void> {
  const blob = kind === 'pdf' ? await renderInvoicePdf(model) : await renderInvoicePng(model)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = invoiceFilename(model, kind)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
