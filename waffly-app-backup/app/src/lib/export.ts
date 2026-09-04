// خروجی‌ها — اکسل (SheetJS)، CSV، PDF (html2canvas + jsPDF)، فایل متنی
import * as XLSX from 'xlsx'

export function downloadTextFile(content: string, filename: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** ردیف‌های آرایه‌ای را به فایل اکسل RTL تبدیل می‌کند */
export function exportRowsToExcel(filename: string, sheetName: string, header: string[], rows: (string | number)[][]) {
  const wsData = [header, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  // عرض ستون‌ها
  ws['!cols'] = header.map((h, i) => ({
    wch: Math.max(h.length + 4, ...rows.slice(0, 200).map(r => String(r[i] ?? '').length + 2), 10),
  }))
  const wb = XLSX.utils.book_new()
  wb.Workbook = { Views: [{ RTL: true }] }
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 30) || 'گزارش')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** CSV با BOM (پشتیبان اکسل) */
export function exportRowsToCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '\uFEFF' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n')
  downloadTextFile(csv, filename, 'text/csv;charset=utf-8')
}

/** اسکرین‌شات یک المان گزارش به PDF فارسی (بدون نیاز به فونت جاسازی‌شده) */
export async function exportElementToPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ])
  const canvas = await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
  } as Parameters<typeof html2canvas>[1])
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 8
  const imgW = pageW - margin * 2
  const imgH = (canvas.height * imgW) / canvas.width
  // اگر بلندتر از یک صفحه بود، چندصفحه‌ای برش بخورد
  if (imgH <= pageH - margin * 2) {
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, imgH)
  } else {
    const pxPerPage = Math.floor(((pageH - margin * 2) * canvas.width) / imgW)
    let y = 0
    let first = true
    while (y < canvas.height) {
      const sliceH = Math.min(pxPerPage, canvas.height - y)
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = sliceH
      const ctx = slice.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, slice.width, slice.height)
      ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
      if (!first) pdf.addPage()
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, (sliceH * imgW) / canvas.width)
      first = false
      y += sliceH
    }
  }
  pdf.save(filename)
}
