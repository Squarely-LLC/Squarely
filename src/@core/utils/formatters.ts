import { isToday } from './helpers'

const SYSTEM_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const avatarText = (value: string) => {
  if (!value)
    return ''
  const nameArray = value.split(' ')

  return nameArray.map(word => word.charAt(0).toUpperCase()).join('')
}

// TODO: Try to implement this: https://twitter.com/fireship_dev/status/1565424801216311297
export const kFormatter = (num: number) => {
  const regex = /\B(?=(\d{3})+(?!\d))/g

  return Math.abs(num) > 9999 ? `${Math.sign(num) * +((Math.abs(num) / 1000).toFixed(1))}k` : Math.abs(num).toFixed(0).replace(regex, ',')
}

/**
 * Format and return date in Humanize format
 * Intl docs: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/format
 * Intl Constructor: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat
 * @param {string} value date to format
 * @param {Intl.DateTimeFormatOptions} formatting Intl object to format with
 */
export const formatDate = (value: string, formatting: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (!value)
    return value

  if (
    formatting.month === 'short'
    && formatting.day === 'numeric'
    && formatting.year === 'numeric'
    && Object.keys(formatting).length === 3
  )
    return formatSystemDate(value)

  return new Intl.DateTimeFormat('en-US', formatting).format(new Date(value))
}

export const formatSystemDate = (value: string | number | Date) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return String(value)

  const day = String(date.getDate()).padStart(2, '0')
  const monthShort = SYSTEM_MONTHS[date.getMonth()]
  const yearShort = String(date.getFullYear()).slice(-2)

  return `${day}/${monthShort}/${yearShort}`
}

export const formatSystemDateTime = (value: string | number | Date) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return String(value)

  const time = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

  return `${formatSystemDate(date)} ${time}`
}

export const formatSystemMonthYear = (value: string | number | Date) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return String(value)

  return `${SYSTEM_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/**
 * Return short human friendly month representation of date
 * Can also convert date to only time if date is of today (Better UX)
 * @param {string} value date to format
 * @param {boolean} toTimeForCurrentDay Shall convert to time if day is today/current
 */
export const formatDateToMonthShort = (value: string, toTimeForCurrentDay = true) => {
  const date = new Date(value)
  let formatting: Record<string, string> = { month: 'short', day: 'numeric' }

  if (toTimeForCurrentDay && isToday(date))
    formatting = { hour: 'numeric', minute: 'numeric' }

  if (formatting.month === 'short' && formatting.day === 'numeric')
    return formatSystemDate(value)

  return new Intl.DateTimeFormat('en-US', formatting).format(new Date(value))
}

export const prefixWithPlus = (value: number) => value > 0 ? `+${value}` : value
