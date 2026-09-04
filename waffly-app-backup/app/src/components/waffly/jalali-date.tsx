'use client'

// پیکر تاریخ شمسی با react-multi-date-picker — مقدار رشته استاندارد 1404/06/07
import { useMemo } from 'react'
import DatePicker from 'react-multi-date-picker'
import persian from 'react-date-object/calendars/persian'
import persian_fa from 'react-date-object/locales/persian_fa'
import { Button } from '@/components/ui/button'
import { todayJalali, prettyJalali } from '@/lib/jalali'

export function JalaliDateInput({ value, onChange, disabled }: {
  value: string
  onChange: (jalaliStr: string) => void
  disabled?: boolean
}) {
  const calendar = useMemo(() => persian, [])
  const locale = useMemo(() => persian_fa, [])
  return (
    <div className="flex gap-2 items-center">
      <DatePicker
        value={value}
        onChange={(d) => {
          if (!d) return
          const obj = Array.isArray(d) ? d[0] : d
          if (!obj || !obj.isValid) return
          // همیشه ارقام لاتین ذخیره شود (لوکال فارسی ارقام فارسی تولید می‌کند)
          const s = obj.format('YYYY/MM/DD')
          onChange(toEnglishDigits(s))
        }}
        calendar={calendar}
        locale={locale}
        format="YYYY/MM/DD"
        calendarPosition="bottom-right"
        disabled={disabled}
        inputMode="search"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0"
        disabled={disabled}
        onClick={() => onChange(todayJalali())}
      >
        امروز
      </Button>
    </div>
  )
}

/** تبدیل ارقام فارسی/عربی به لاتین */
export function toEnglishDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

export function JalaliDatePretty({ value }: { value: string }) {
  return <span className="waffly-num">{prettyJalali(value)}</span>
}
